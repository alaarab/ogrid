import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { checkArraySize } from '../../arrays';
import { toNumber, toText, evalArg, logicalValue } from '../../evaluator';

interface Match { start: number; end: number }

/** Non-overlapping delimiter matches, scanning left to right (or right to left). */
function findMatches(text: string, delimiter: string, ignoreCase: boolean, fromEnd: boolean): Match[] {
  const haystack = ignoreCase ? text.toLowerCase() : text;
  const needle = ignoreCase ? delimiter.toLowerCase() : delimiter;
  const matches: Match[] = [];
  if (fromEnd) {
    let pos = haystack.length;
    while (pos >= needle.length) {
      const idx = haystack.lastIndexOf(needle, pos - needle.length);
      if (idx < 0) break;
      matches.push({ start: idx, end: idx + needle.length });
      pos = idx;
    }
  } else {
    let pos = 0;
    while (pos <= haystack.length - needle.length) {
      const idx = haystack.indexOf(needle, pos);
      if (idx < 0) break;
      matches.push({ start: idx, end: idx + needle.length });
      pos = idx + needle.length;
    }
  }
  return matches;
}

function split(text: string, delimiter: string, ignoreCase: boolean): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const match of findMatches(text, delimiter, ignoreCase, false)) {
    parts.push(text.slice(last, match.start));
    last = match.end;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Evaluates optional numeric argument `index`, or returns `fallback` when absent. */
function optionalNumber(args: ASTNode[], index: number, fallback: number, context: IFormulaContext, evaluator: IEvaluator): number | FormulaError {
  if (args.length <= index) return fallback;
  const raw = evalArg(evaluator, args[index], context);
  if (raw instanceof FormulaError) return raw;
  const n = toNumber(raw);
  return n instanceof FormulaError ? n : Math.trunc(n);
}

/**
 * TEXTBEFORE / TEXTAFTER(text, delimiter, [instance_num=1], [match_mode=0],
 * [match_end=0], [if_not_found=#N/A]). A negative instance_num counts from the
 * end; match_end treats the end of the text (or the start, for negative
 * instances) as a delimiter.
 */
function textAround(after: boolean): IFormulaFunction {
  return {
    minArgs: 2,
    maxArgs: 6,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawText = evalArg(evaluator, args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      const text = toText(rawText);
      const rawDelimiter = evalArg(evaluator, args[1], context);
      if (rawDelimiter instanceof FormulaError) return rawDelimiter;
      const delimiter = toText(rawDelimiter);
      const instance = optionalNumber(args, 2, 1, context, evaluator);
      if (instance instanceof FormulaError) return instance;
      const matchMode = optionalNumber(args, 3, 0, context, evaluator);
      if (matchMode instanceof FormulaError) return matchMode;
      const matchEnd = optionalNumber(args, 4, 0, context, evaluator);
      if (matchEnd instanceof FormulaError) return matchEnd;
      if (instance === 0 || Math.abs(instance) > Math.max(text.length, 1)) return new FormulaError('#VALUE!', 'instance_num out of range');
      if (matchMode !== 0 && matchMode !== 1) return new FormulaError('#VALUE!', 'match_mode must be 0 or 1');
      if (matchEnd !== 0 && matchEnd !== 1) return new FormulaError('#VALUE!', 'match_end must be 0 or 1');

      const fromEnd = instance < 0;
      let matches: Match[];
      if (delimiter === '') {
        // An empty delimiter matches immediately: at the start, or at the end for negative instances.
        matches = [fromEnd ? { start: text.length, end: text.length } : { start: 0, end: 0 }];
      } else {
        matches = findMatches(text, delimiter, matchMode === 1, fromEnd);
        if (matchEnd === 1) matches.push(fromEnd ? { start: 0, end: 0 } : { start: text.length, end: text.length });
      }
      const match = matches[Math.abs(instance) - 1];
      if (match === undefined) {
        if (args.length >= 6) return evalArg(evaluator, args[5], context);
        return new FormulaError('#N/A', 'Delimiter not found');
      }
      return after ? text.slice(match.end) : text.slice(0, match.start);
    },
  };
}

/**
 * Delimiter-based text splitting: TEXTSPLIT, TEXTBEFORE, TEXTAFTER.
 */
export function registerTextSplitFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('TEXTBEFORE', textAround(false));
  registry.set('TEXTAFTER', textAround(true));

  // TEXTSPLIT(text, col_delimiter, [row_delimiter], [ignore_empty=FALSE], [match_mode=0], [pad_with])
  registry.set('TEXTSPLIT', {
    minArgs: 2,
    maxArgs: 6,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values: unknown[] = [];
      for (let i = 0; i < args.length; i++) {
        const value = evalArg(evaluator, args[i], context);
        if (i !== 5 && value instanceof FormulaError) return value;
        values.push(value);
      }
      const text = toText(values[0]);
      const colDelimiter = toText(values[1]);
      const rowDelimiter = values.length > 2 ? toText(values[2]) : '';
      const ignoreEmpty = values[3] !== undefined ? logicalValue(values[3]) : false;
      if (ignoreEmpty instanceof FormulaError) return ignoreEmpty;
      const rawMode = values[4] !== undefined ? toNumber(values[4]) : 0;
      if (rawMode instanceof FormulaError) return rawMode;
      const matchMode = Math.trunc(rawMode);
      if (matchMode !== 0 && matchMode !== 1) return new FormulaError('#VALUE!', 'match_mode must be 0 or 1');
      if (colDelimiter === '' && rowDelimiter === '') return new FormulaError('#VALUE!', 'TEXTSPLIT needs a delimiter');
      const ignoreCase = matchMode === 1;

      const keep = (part: string) => !ignoreEmpty || part !== '';
      const rows = rowDelimiter === '' ? [text] : split(text, rowDelimiter, ignoreCase).filter(keep);
      const cells = rows.map(row => colDelimiter === '' ? [row] : split(row, colDelimiter, ignoreCase).filter(keep));
      const width = Math.max(0, ...cells.map(row => row.length));
      if (!cells.length || width === 0) return new FormulaError('#CALC!', 'Empty array');
      checkArraySize(cells.length, width, context);
      const padding = values.length > 5 ? values[5] : new FormulaError('#N/A');
      return cells.map(row => Array.from({ length: width }, (_, c) => c < row.length ? row[c] : padding));
    },
  });
}
