import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { evalArg } from '../evaluator';

function flattenArgs(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown[] {
  const result: unknown[] = [];
  for (const arg of args) {
    if (arg.kind === 'range') {
      const values = context.getRangeValues({ start: arg.start, end: arg.end });
      for (const row of values) {
        for (const cell of row) {
          result.push(cell);
        }
      }
    } else {
      result.push(evaluator.evaluate(arg, context));
    }
  }
  return result;
}

export function registerLogicalFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('IF', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const condition = evalArg(evaluator, args[0], context);
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
      const values = flattenArgs(args, context, evaluator);
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (!val) return false;
      }
      return true;
    },
  });

  registry.set('OR', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (val) return true;
      }
      return false;
    },
  });

  registry.set('NOT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      return !val;
    },
  });

  registry.set('IFERROR', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
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
        const condition = evalArg(evaluator, args[i], context);
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
        if (expr === caseVal) {
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
      if (typeof rawIdx !== 'number') return new FormulaError('#VALUE!', 'CHOOSE index must be a number');
      const idx = Math.trunc(rawIdx);
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
      const values = flattenArgs(args, context, evaluator);
      let trueCount = 0;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (val) trueCount++;
      }
      return trueCount % 2 === 1;
    },
  });
}
