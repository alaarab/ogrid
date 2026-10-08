import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { mapArrays } from '../arrays';
import { FormulaError } from '../types';
import { evalArg, logicalValue, toNumber, compareValues, flattenArgs as expandArgs } from '../evaluator';

function logicalArgs(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): boolean[] | FormulaError {
  const result: boolean[] = [];
  for (const arg of args) {
    const values = expandArgs([arg], context, evaluator);
    const reference = arg.kind === 'range' || arg.kind === 'cellRef' || arg.kind === 'functionCall' && ['INDIRECT', 'OFFSET'].includes(arg.name);
    for (const value of values) {
      if (value instanceof FormulaError) return value;
      if (reference && (value === null || value === undefined || typeof value === 'string')) continue;
      const logical = logicalValue(value);
      if (logical instanceof FormulaError) return logical;
      result.push(logical);
    }
  }
  return result.length ? result : new FormulaError('#VALUE!', 'No logical values');
}

export function registerLogicalFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('IF', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const test = evalArg(evaluator, args[0], context);
      if (Array.isArray(test)) {
        const yes = evalArg(evaluator, args[1], context);
        const no = args[2] ? evalArg(evaluator, args[2], context) : false;
        return mapArrays([test, yes, no], context, ([t, y, n]) => {
          const logical = logicalValue(t);
          return logical instanceof FormulaError ? logical : logical ? y : n;
        });
      }
      const condition = logicalValue(test);
      if (condition instanceof FormulaError) return condition;

      // Short-circuit: only evaluate the needed branch
      if (condition) {
        return evalArg(evaluator, args[1], context);
      } else {
        if (args.length >= 3) {
          return evalArg(evaluator, args[2], context);
        }
        return false;
      }
    },
  });

  registry.set('AND', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = logicalArgs(args, context, evaluator);
      if (values instanceof FormulaError) return values;
      for (const val of values) {
        if (!val) return false;
      }
      return true;
    },
  });

  registry.set('OR', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = logicalArgs(args, context, evaluator);
      if (values instanceof FormulaError) return values;
      for (const val of values) {
        if (val) return true;
      }
      return false;
    },
  });

  registry.set('NOT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = logicalValue(evalArg(evaluator, args[0], context));
      if (val instanceof FormulaError) return val;
      return !val;
    },
  });

  registry.set('IFERROR', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (Array.isArray(val)) return mapArrays([val, evalArg(evaluator, args[1], context)], context, ([v, fallback]) => v instanceof FormulaError ? fallback : v);
      if (val instanceof FormulaError) {
        return evalArg(evaluator, args[1], context);
      }
      return val;
    },
  });

  registry.set('IFNA', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (Array.isArray(val)) return mapArrays([val, evalArg(evaluator, args[1], context)], context, ([v, fallback]) => v instanceof FormulaError && v.type === '#N/A' ? fallback : v);
      if (val instanceof FormulaError && val.type === '#N/A') {
        return evalArg(evaluator, args[1], context);
      }
      return val;
    },
  });

  registry.set('IFS', {
    minArgs: 2,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // IFS(cond1, val1, cond2, val2, ...)
      if (args.length % 2 !== 0) {
        return new FormulaError('#VALUE!', 'IFS requires pairs of condition, value');
      }
      for (let i = 0; i < args.length; i += 2) {
        const condition = logicalValue(evalArg(evaluator, args[i], context));
        if (condition instanceof FormulaError) return condition;
        if (condition) {
          return evalArg(evaluator, args[i + 1], context);
        }
      }
      return new FormulaError('#N/A', 'IFS no condition was TRUE');
    },
  });

  registry.set('SWITCH', {
    minArgs: 3,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // SWITCH(expr, val1, result1, val2, result2, ..., [default])
      const expr = evalArg(evaluator, args[0], context);
      if (expr instanceof FormulaError) return expr;
      const hasDefault = (args.length - 1) % 2 !== 0;
      const pairCount = hasDefault ? (args.length - 2) / 2 : (args.length - 1) / 2;
      for (let i = 0; i < pairCount; i++) {
        const caseVal = evalArg(evaluator, args[1 + i * 2], context);
        if (caseVal instanceof FormulaError) return caseVal;
        if (compareValues(expr, caseVal) === 0) {
          return evalArg(evaluator, args[2 + i * 2], context);
        }
      }
      if (hasDefault) {
        return evalArg(evaluator, args[args.length - 1], context);
      }
      return new FormulaError('#N/A', 'SWITCH no match found');
    },
  });

  registry.set('CHOOSE', {
    minArgs: 2,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawIdx = evalArg(evaluator, args[0], context);
      if (rawIdx instanceof FormulaError) return rawIdx;
      const number = toNumber(rawIdx);
      if (number instanceof FormulaError) return number;
      const idx = Math.trunc(number);
      if (idx < 1 || idx >= args.length) {
        return new FormulaError('#VALUE!', 'CHOOSE index out of range');
      }
      return evalArg(evaluator, args[idx], context);
    },
  });

  registry.set('XOR', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = logicalArgs(args, context, evaluator);
      if (values instanceof FormulaError) return values;
      let trueCount = 0;
      for (const val of values) {
        if (val) trueCount++;
      }
      return trueCount % 2 === 1;
    },
  });
}
