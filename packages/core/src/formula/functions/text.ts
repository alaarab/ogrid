import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber, toString, flattenArgs } from '../evaluator';

export function registerTextFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('CONCATENATE', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      const parts: string[] = [];
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        parts.push(toString(val));
      }
      return parts.join('');
    },
  });

  registry.set('CONCAT', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      const parts: string[] = [];
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        parts.push(toString(val));
      }
      return parts.join('');
    },
  });

  registry.set('UPPER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).toUpperCase();
    },
  });

  registry.set('LOWER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).toLowerCase();
    },
  });

  registry.set('TRIM', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).trim();
    },
  });

  registry.set('LEFT', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      let numChars = 1;
      if (args.length >= 2) {
        const rawNum = evaluator.evaluate(args[1], context);
        if (rawNum instanceof FormulaError) return rawNum;
        const n = toNumber(rawNum);
        if (n instanceof FormulaError) return n;
        numChars = Math.trunc(n);
      }

      if (numChars < 0) return new FormulaError('#VALUE!', 'LEFT num_chars must be >= 0');
      return text.substring(0, numChars);
    },
  });

  registry.set('RIGHT', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      let numChars = 1;
      if (args.length >= 2) {
        const rawNum = evaluator.evaluate(args[1], context);
        if (rawNum instanceof FormulaError) return rawNum;
        const n = toNumber(rawNum);
        if (n instanceof FormulaError) return n;
        numChars = Math.trunc(n);
      }

      if (numChars < 0) return new FormulaError('#VALUE!', 'RIGHT num_chars must be >= 0');
      return text.substring(Math.max(0, text.length - numChars));
    },
  });

  registry.set('MID', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      const rawStart = evaluator.evaluate(args[1], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startPos = toNumber(rawStart);
      if (startPos instanceof FormulaError) return startPos;

      const rawNum = evaluator.evaluate(args[2], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const numChars = toNumber(rawNum);
      if (numChars instanceof FormulaError) return numChars;

      const start = Math.trunc(startPos);
      const count = Math.trunc(numChars);

      if (start < 1) return new FormulaError('#VALUE!', 'MID start_num must be >= 1');
      if (count < 0) return new FormulaError('#VALUE!', 'MID num_chars must be >= 0');

      // startPos is 1-based
      return text.substring(start - 1, start - 1 + count);
    },
  });

  registry.set('LEN', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).length;
    },
  });

  registry.set('SUBSTITUTE', {
    minArgs: 3,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      const rawOld = evaluator.evaluate(args[1], context);
      if (rawOld instanceof FormulaError) return rawOld;
      const oldText = toString(rawOld);

      const rawNew = evaluator.evaluate(args[2], context);
      if (rawNew instanceof FormulaError) return rawNew;
      const newText = toString(rawNew);

      if (args.length >= 4) {
        const rawInstance = evaluator.evaluate(args[3], context);
        if (rawInstance instanceof FormulaError) return rawInstance;
        const instanceNum = toNumber(rawInstance);
        if (instanceNum instanceof FormulaError) return instanceNum;

        const n = Math.trunc(instanceNum);
        if (n < 1) return new FormulaError('#VALUE!', 'SUBSTITUTE instance_num must be >= 1');

        // Replace only the nth occurrence
        let count = 0;
        let result = '';
        let searchFrom = 0;
        while (searchFrom <= text.length) {
          const idx = text.indexOf(oldText, searchFrom);
          if (idx === -1) {
            result += text.substring(searchFrom);
            break;
          }
          count++;
          if (count === n) {
            result += text.substring(searchFrom, idx) + newText;
            result += text.substring(idx + oldText.length);
            break;
          } else {
            result += text.substring(searchFrom, idx + oldText.length);
            searchFrom = idx + oldText.length;
          }
        }
        return result;
      } else {
        // Replace all occurrences
        if (oldText === '') return text;
        return text.split(oldText).join(newText);
      }
    },
  });

  registry.set('FIND', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawFind = evaluator.evaluate(args[0], context);
      if (rawFind instanceof FormulaError) return rawFind;
      const findText = toString(rawFind);
      const rawWithin = evaluator.evaluate(args[1], context);
      if (rawWithin instanceof FormulaError) return rawWithin;
      const withinText = toString(rawWithin);
      let startNum = 1;
      if (args.length >= 3) {
        const rawStart = evaluator.evaluate(args[2], context);
        if (rawStart instanceof FormulaError) return rawStart;
        const s = toNumber(rawStart);
        if (s instanceof FormulaError) return s;
        startNum = Math.trunc(s);
      }
      if (startNum < 1) return new FormulaError('#VALUE!', 'FIND start_num must be >= 1');
      const idx = withinText.indexOf(findText, startNum - 1);
      if (idx === -1) return new FormulaError('#VALUE!', 'FIND text not found');
      return idx + 1; // 1-based
    },
  });

  registry.set('SEARCH', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawFind = evaluator.evaluate(args[0], context);
      if (rawFind instanceof FormulaError) return rawFind;
      const findText = toString(rawFind).toLowerCase();
      const rawWithin = evaluator.evaluate(args[1], context);
      if (rawWithin instanceof FormulaError) return rawWithin;
      const withinText = toString(rawWithin).toLowerCase();
      let startNum = 1;
      if (args.length >= 3) {
        const rawStart = evaluator.evaluate(args[2], context);
        if (rawStart instanceof FormulaError) return rawStart;
        const s = toNumber(rawStart);
        if (s instanceof FormulaError) return s;
        startNum = Math.trunc(s);
      }
      if (startNum < 1) return new FormulaError('#VALUE!', 'SEARCH start_num must be >= 1');
      const idx = withinText.indexOf(findText, startNum - 1);
      if (idx === -1) return new FormulaError('#VALUE!', 'SEARCH text not found');
      return idx + 1;
    },
  });

  registry.set('REPLACE', {
    minArgs: 4,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawText = evaluator.evaluate(args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      const text = toString(rawText);
      const rawStart = evaluator.evaluate(args[1], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startPos = toNumber(rawStart);
      if (startPos instanceof FormulaError) return startPos;
      const rawNum = evaluator.evaluate(args[2], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const numChars = toNumber(rawNum);
      if (numChars instanceof FormulaError) return numChars;
      const rawNew = evaluator.evaluate(args[3], context);
      if (rawNew instanceof FormulaError) return rawNew;
      const newText = toString(rawNew);
      const start = Math.trunc(startPos) - 1; // 1-based to 0-based
      const count = Math.trunc(numChars);
      return text.substring(0, start) + newText + text.substring(start + count);
    },
  });

  registry.set('REPT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawText = evaluator.evaluate(args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      const text = toString(rawText);
      const rawTimes = evaluator.evaluate(args[1], context);
      if (rawTimes instanceof FormulaError) return rawTimes;
      const times = toNumber(rawTimes);
      if (times instanceof FormulaError) return times;
      const n = Math.trunc(times);
      if (n < 0) return new FormulaError('#VALUE!', 'REPT number must be >= 0');
      return text.repeat(n);
    },
  });

  registry.set('EXACT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawA = evaluator.evaluate(args[0], context);
      if (rawA instanceof FormulaError) return rawA;
      const rawB = evaluator.evaluate(args[1], context);
      if (rawB instanceof FormulaError) return rawB;
      return toString(rawA) === toString(rawB);
    },
  });

  registry.set('PROPER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    },
  });

  registry.set('CLEAN', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      // Remove non-printable characters (ASCII 0-31)
      // eslint-disable-next-line no-control-regex
      return toString(val).replace(/[\x00-\x1F]/g, '');
    },
  });

  registry.set('CHAR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
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
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);
      if (text.length === 0) return new FormulaError('#VALUE!', 'CODE requires non-empty text');
      return text.charCodeAt(0);
    },
  });

  registry.set('TEXT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const rawFmt = evaluator.evaluate(args[1], context);
      if (rawFmt instanceof FormulaError) return rawFmt;
      const fmt = toString(rawFmt);
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return toString(rawVal);
      // Basic format support: 0, 0.00, #,##0, #,##0.00, 0%, 0.00%
      if (fmt.includes('%')) {
        const decimals = (fmt.match(/0/g) || []).length - 1;
        return (num * 100).toFixed(Math.max(0, decimals)) + '%';
      }
      const decimalMatch = fmt.match(/\.(0+)/);
      const decimals = decimalMatch ? decimalMatch[1].length : 0;
      const useCommas = fmt.includes(',');
      const result = num.toFixed(decimals);
      if (useCommas) {
        const [intPart, decPart] = result.split('.');
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
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      if (typeof val === 'number') return val;
      const raw = toString(val).trim();
      const isPercent = raw.endsWith('%');
      const text = raw.replace(/[,$%\s]/g, '');
      const n = Number(text);
      if (isNaN(n)) return new FormulaError('#VALUE!', 'VALUE cannot convert text to number');
      return isPercent ? n / 100 : n;
    },
  });

  registry.set('TEXTJOIN', {
    minArgs: 3,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDelim = evaluator.evaluate(args[0], context);
      if (rawDelim instanceof FormulaError) return rawDelim;
      const delimiter = toString(rawDelim);
      const rawIgnore = evaluator.evaluate(args[1], context);
      if (rawIgnore instanceof FormulaError) return rawIgnore;
      const ignoreEmpty = !!rawIgnore;
      const parts: string[] = [];
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (arg.kind === 'range') {
          const rangeData = context.getRangeValues({ start: arg.start, end: arg.end });
          for (const row of rangeData) {
            for (const cell of row) {
              if (cell instanceof FormulaError) return cell;
              const s = toString(cell);
              if (!ignoreEmpty || s !== '') parts.push(s);
            }
          }
        } else {
          const val = evaluator.evaluate(args[i], context);
          if (val instanceof FormulaError) return val;
          const s = toString(val);
          if (!ignoreEmpty || s !== '') parts.push(s);
        }
      }
      return parts.join(delimiter);
    },
  });

  // --- DOLLAR ---
  registry.set('DOLLAR', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      let decimals = 2;
      if (args.length >= 2) {
        const rawDec = evaluator.evaluate(args[1], context);
        if (rawDec instanceof FormulaError) return rawDec;
        const d = toNumber(rawDec);
        if (d instanceof FormulaError) return d;
        decimals = Math.trunc(d);
      }
      const absNum = Math.abs(num);
      const rounded = decimals >= 0
        ? absNum.toFixed(decimals)
        : (Math.round(absNum / Math.pow(10, -decimals)) * Math.pow(10, -decimals)).toFixed(0);
      const [intPart, decPart] = rounded.split('.');
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
      return num < 0 ? `($${formatted})` : `$${formatted}`;
    },
  });

  // --- FIXED ---
  registry.set('FIXED', {
    minArgs: 1,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      let decimals = 2;
      if (args.length >= 2) {
        const rawDec = evaluator.evaluate(args[1], context);
        if (rawDec instanceof FormulaError) return rawDec;
        const d = toNumber(rawDec);
        if (d instanceof FormulaError) return d;
        decimals = Math.trunc(d);
      }
      let noCommas = false;
      if (args.length >= 3) {
        const rawNoCommas = evaluator.evaluate(args[2], context);
        if (rawNoCommas instanceof FormulaError) return rawNoCommas;
        noCommas = !!rawNoCommas;
      }
      const absNum = Math.abs(num);
      const rounded = decimals >= 0
        ? absNum.toFixed(decimals)
        : (Math.round(absNum / Math.pow(10, -decimals)) * Math.pow(10, -decimals)).toFixed(0);
      if (noCommas) {
        return num < 0 ? `-${rounded}` : rounded;
      }
      const [intPart, decPart] = rounded.split('.');
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
      return num < 0 ? `-${formatted}` : formatted;
    },
  });

  // --- T ---
  registry.set('T', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return typeof val === 'string' ? val : '';
    },
  });

  // --- N ---
  registry.set('N', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val instanceof Date) return val.getTime();
      // string, null, undefined → 0
      return 0;
    },
  });

  // --- FORMULATEXT ---
  registry.set('FORMULATEXT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg.kind !== 'cellRef') {
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

  // --- NUMBERVALUE ---
  registry.set('NUMBERVALUE', {
    minArgs: 1,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawText = evaluator.evaluate(args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      if (typeof rawText === 'number') return rawText;
      let text = toString(rawText).trim();

      let decimalSep = '.';
      let groupSep = ','; // default
      const hasDecimalArg = args.length >= 2;
      const hasGroupArg = args.length >= 3;

      if (hasDecimalArg) {
        const rawDec = evaluator.evaluate(args[1], context);
        if (rawDec instanceof FormulaError) return rawDec;
        decimalSep = toString(rawDec);
        if (decimalSep.length !== 1) return new FormulaError('#VALUE!', 'NUMBERVALUE decimal separator must be 1 character');
        // When only decimal sep is specified, default group sep adjusts to avoid clash
        if (!hasGroupArg) {
          groupSep = decimalSep === ',' ? '.' : ',';
        }
      }
      if (hasGroupArg) {
        const rawGrp = evaluator.evaluate(args[2], context);
        if (rawGrp instanceof FormulaError) return rawGrp;
        groupSep = toString(rawGrp);
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
      if (isNaN(n)) return new FormulaError('#VALUE!', `NUMBERVALUE cannot parse "${toString(rawText)}"`);
      return isPercent ? n / 100 : n;
    },
  });

  // --- PHONETIC ---
  registry.set('PHONETIC', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // Phonetic reading is language-specific (Japanese furigana etc.)
      // Return the text as-is as a stub
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val);
    },
  });
}
