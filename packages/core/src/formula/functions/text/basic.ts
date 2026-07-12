import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, toString, flattenArgs, evalArg } from '../../evaluator';

/**
 * Core string manipulation: concatenation, casing, trimming, slicing, length,
 * repetition, comparison, and cleanup (CONCATENATE, UPPER, LEFT, MID, REPT, ...).
 */
export function registerBasicTextFunctions(registry: Map<string, IFormulaFunction>): void {
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
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).toUpperCase();
    },
  });

  registry.set('LOWER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).toLowerCase();
    },
  });

  registry.set('TRIM', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      // Excel TRIM removes leading/trailing spaces AND collapses runs of internal
      // spaces to a single space (only the space character, not tabs/newlines).
      return toString(val).replace(/ +/g, ' ').replace(/^ | $/g, '');
    },
  });

  registry.set('LEFT', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      let numChars = 1;
      if (args.length >= 2) {
        const rawNum = evalArg(evaluator, args[1], context);
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
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      let numChars = 1;
      if (args.length >= 2) {
        const rawNum = evalArg(evaluator, args[1], context);
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
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const text = toString(val);

      const rawStart = evalArg(evaluator, args[1], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startPos = toNumber(rawStart);
      if (startPos instanceof FormulaError) return startPos;

      const rawNum = evalArg(evaluator, args[2], context);
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
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).length;
    },
  });

  registry.set('REPT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawText = evalArg(evaluator, args[0], context);
      if (rawText instanceof FormulaError) return rawText;
      const text = toString(rawText);
      const rawTimes = evalArg(evaluator, args[1], context);
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
      const rawA = evalArg(evaluator, args[0], context);
      if (rawA instanceof FormulaError) return rawA;
      const rawB = evalArg(evaluator, args[1], context);
      if (rawB instanceof FormulaError) return rawB;
      return toString(rawA) === toString(rawB);
    },
  });

  registry.set('PROPER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return toString(val).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    },
  });

  registry.set('CLEAN', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      // Remove non-printable characters (ASCII 0-31)
      // eslint-disable-next-line no-control-regex
      return toString(val).replace(/[\x00-\x1F]/g, '');
    },
  });
}
