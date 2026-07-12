import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, toString, evalArg } from '../../evaluator';

/**
 * Substring search and replacement: SUBSTITUTE, FIND, SEARCH, REPLACE.
 */
export function registerTextSearchFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('SUBSTITUTE', {
    minArgs: 3,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      const rawOld = evalArg(evaluator, args[1], context);
      if (rawOld instanceof FormulaError) return rawOld;
      const oldText = toString(rawOld);

      const rawNew = evalArg(evaluator, args[2], context);
      if (rawNew instanceof FormulaError) return rawNew;
      const newText = toString(rawNew);

      if (args.length >= 4) {
        const rawInstance = evalArg(evaluator, args[3], context);
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
      const rawFind = evalArg(evaluator, args[0], context);
      if (rawFind instanceof FormulaError) return rawFind;
      const findText = toString(rawFind);
      const rawWithin = evalArg(evaluator, args[1], context);
      if (rawWithin instanceof FormulaError) return rawWithin;
      const withinText = toString(rawWithin);
      let startNum = 1;
      if (args.length >= 3) {
        const rawStart = evalArg(evaluator, args[2], context);
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
      const rawFind = evalArg(evaluator, args[0], context);
      if (rawFind instanceof FormulaError) return rawFind;
      const findText = toString(rawFind).toLowerCase();
      const rawWithin = evalArg(evaluator, args[1], context);
      if (rawWithin instanceof FormulaError) return rawWithin;
      const withinText = toString(rawWithin).toLowerCase();
      let startNum = 1;
      if (args.length >= 3) {
        const rawStart = evalArg(evaluator, args[2], context);
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
      const rawText = evalArg(evaluator, args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      const text = toString(rawText);
      const rawStart = evalArg(evaluator, args[1], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startPos = toNumber(rawStart);
      if (startPos instanceof FormulaError) return startPos;
      const rawNum = evalArg(evaluator, args[2], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const numChars = toNumber(rawNum);
      if (numChars instanceof FormulaError) return numChars;
      const rawNew = evalArg(evaluator, args[3], context);
      if (rawNew instanceof FormulaError) return rawNew;
      const newText = toString(rawNew);
      const start = Math.trunc(startPos) - 1; // 1-based to 0-based
      const count = Math.trunc(numChars);
      return text.substring(0, start) + newText + text.substring(start + count);
    },
  });
}
