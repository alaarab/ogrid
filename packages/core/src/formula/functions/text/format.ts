import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, toText, evalArg } from '../../evaluator';

/**
 * Character/number conversion and number-to-text formatting: CHAR, CODE, TEXT,
 * VALUE, TEXTJOIN, DOLLAR, FIXED, T, N, FORMULATEXT, NUMBERVALUE, PHONETIC.
 */
export function registerTextFormatFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('CHAR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evalArg(evaluator, args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      const n = Math.trunc(num);
      if (n < 1 || n > 65535) return new FormulaError('#VALUE!', 'CHAR number must be 1-65535');
      return String.fromCharCode(n);
    },
  });

  registry.set('CODE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toText(val);
      if (text.length === 0) return new FormulaError('#VALUE!', 'CODE requires non-empty text');
      return text.charCodeAt(0);
    },
  });

  registry.set('TEXT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evalArg(evaluator, args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const rawFmt = evalArg(evaluator, args[1], context);
      if (rawFmt instanceof FormulaError) return rawFmt;
      const fmt = toText(rawFmt);
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return toText(rawVal);
      // Basic format support: 0, 0.00, #,##0, #,##0.00, 0%, 0.00%
      if (fmt.includes('%')) {
        const decimals = (fmt.match(/0/g) || []).length - 1;
        return (num * 100).toFixed(Math.max(0, decimals)) + '%';
      }
      const decimalMatch = fmt.match(/\.(0+)/);
      const decimals = decimalMatch?.[1]?.length ?? 0;
      const useCommas = fmt.includes(',');
      const result = num.toFixed(decimals);
      if (useCommas) {
        const [intPart = '', decPart] = result.split('.');
        const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decPart ? withCommas + '.' + decPart : withCommas;
      }
      return result;
    },
  });

  registry.set('VALUE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      if (typeof val === 'number') return val;
      const raw = toText(val).trim();
      const isPercent = raw.endsWith('%');
      const text = raw.replace(/[,$%\s]/g, '');
      const n = Number(text);
      if (Number.isNaN(n)) return new FormulaError('#VALUE!', 'VALUE cannot convert text to number');
      return isPercent ? n / 100 : n;
    },
  });

  registry.set('TEXTJOIN', {
    minArgs: 3,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDelim = evalArg(evaluator, args[0], context);
      if (rawDelim instanceof FormulaError) return rawDelim;
      const delimiter = toText(rawDelim);
      const rawIgnore = evalArg(evaluator, args[1], context);
      if (rawIgnore instanceof FormulaError) return rawIgnore;
      const ignoreEmpty = !!rawIgnore;
      const parts: string[] = [];
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg === undefined) continue;
        if (arg.kind === 'range') {
          const rangeData = context.getRangeValues({ start: arg.start, end: arg.end });
          for (const row of rangeData) {
            for (const cell of row) {
              if (cell instanceof FormulaError) return cell;
              const s = toText(cell);
              if (!ignoreEmpty || s !== '') parts.push(s);
            }
          }
        } else {
          const val = evalArg(evaluator, args[i], context);
          if (val instanceof FormulaError) return val;
          const s = toText(val);
          if (!ignoreEmpty || s !== '') parts.push(s);
        }
      }
      return parts.join(delimiter);
    },
  });

  registry.set('DOLLAR', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      let decimals = 2;
      if (args.length >= 2) {
        const rawDec = evalArg(evaluator, args[1], context);
        if (rawDec instanceof FormulaError) return rawDec;
        const d = toNumber(rawDec);
        if (d instanceof FormulaError) return d;
        decimals = Math.trunc(d);
      }
      const absNum = Math.abs(num);
      const rounded = decimals >= 0
        ? absNum.toFixed(decimals)
        : (Math.round(absNum / 10 ** -decimals) * 10 ** -decimals).toFixed(0);
      const [intPart = '', decPart] = rounded.split('.');
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
      return num < 0 ? `($${formatted})` : `$${formatted}`;
    },
  });

  registry.set('FIXED', {
    minArgs: 1,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      let decimals = 2;
      if (args.length >= 2) {
        const rawDec = evalArg(evaluator, args[1], context);
        if (rawDec instanceof FormulaError) return rawDec;
        const d = toNumber(rawDec);
        if (d instanceof FormulaError) return d;
        decimals = Math.trunc(d);
      }
      let noCommas = false;
      if (args.length >= 3) {
        const rawNoCommas = evalArg(evaluator, args[2], context);
        if (rawNoCommas instanceof FormulaError) return rawNoCommas;
        noCommas = !!rawNoCommas;
      }
      const absNum = Math.abs(num);
      const rounded = decimals >= 0
        ? absNum.toFixed(decimals)
        : (Math.round(absNum / 10 ** -decimals) * 10 ** -decimals).toFixed(0);
      if (noCommas) {
        return num < 0 ? `-${rounded}` : rounded;
      }
      const [intPart = '', decPart] = rounded.split('.');
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
      return num < 0 ? `-${formatted}` : formatted;
    },
  });

  registry.set('T', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return typeof val === 'string' ? val : '';
    },
  });

  registry.set('N', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val instanceof Date) return val.getTime();
      // string, null, undefined  to  0
      return 0;
    },
  });

  registry.set('FORMULATEXT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg === undefined || arg.kind !== 'cellRef') {
        return new FormulaError('#N/A', 'FORMULATEXT requires a cell reference');
      }
      if (!context.getCellFormula) {
        return new FormulaError('#N/A', 'FORMULATEXT not supported in this context');
      }
      const formula = context.getCellFormula(arg.address);
      if (formula === undefined) {
        return new FormulaError('#N/A', 'Cell does not contain a formula');
      }
      return formula;
    },
  });

  registry.set('NUMBERVALUE', {
    minArgs: 1,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawText = evalArg(evaluator, args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      if (typeof rawText === 'number') return rawText;
      let text = toText(rawText).trim();

      let decimalSep = '.';
      let groupSep = ','; // default
      const hasDecimalArg = args.length >= 2;
      const hasGroupArg = args.length >= 3;

      if (hasDecimalArg) {
        const rawDec = evalArg(evaluator, args[1], context);
        if (rawDec instanceof FormulaError) return rawDec;
        decimalSep = toText(rawDec);
        if (decimalSep.length !== 1) return new FormulaError('#VALUE!', 'NUMBERVALUE decimal separator must be 1 character');
        // When only decimal sep is specified, default group sep adjusts to avoid clash
        if (!hasGroupArg) {
          groupSep = decimalSep === ',' ? '.' : ',';
        }
      }
      if (hasGroupArg) {
        const rawGrp = evalArg(evaluator, args[2], context);
        if (rawGrp instanceof FormulaError) return rawGrp;
        groupSep = toText(rawGrp);
        if (groupSep.length !== 1) return new FormulaError('#VALUE!', 'NUMBERVALUE group separator must be 1 character');
      }
      if (decimalSep === groupSep) return new FormulaError('#VALUE!', 'NUMBERVALUE separators must be different');

      // Remove percent sign (will divide by 100 at end)
      const isPercent = text.endsWith('%');
      if (isPercent) text = text.slice(0, -1).trim();

      // Remove group separators using RegExp, replace decimal separator with '.'
      const escapedGroup = groupSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(escapedGroup, 'g'), '');
      if (decimalSep !== '.') {
        const escapedDec = decimalSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(escapedDec), '.');
      }

      const n = Number(text);
      if (Number.isNaN(n)) return new FormulaError('#VALUE!', `NUMBERVALUE cannot parse "${toText(rawText)}"`);
      return isPercent ? n / 100 : n;
    },
  });

  registry.set('PHONETIC', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // PHONETIC returns the furigana (phonetic guide) Excel stores alongside a
      // cell's text. OGrid has no furigana metadata to draw from, so by design it
      // returns the source text unchanged. This is an intentional, documented
      // limitation, not an incomplete implementation.
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return toText(val);
    },
  });
}
