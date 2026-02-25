import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';

export function registerInfoFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('ISBLANK', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      return val === null || val === undefined || val === '';
    },
  });

  registry.set('ISNUMBER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      return typeof val === 'number' && !isNaN(val);
    },
  });

  registry.set('ISTEXT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      return typeof val === 'string';
    },
  });

  registry.set('ISERROR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      return val instanceof FormulaError;
    },
  });

  registry.set('ISNA', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      return val instanceof FormulaError && val.type === '#N/A';
    },
  });

  registry.set('TYPE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return 16; // Error
      if (typeof val === 'number') return 1;
      if (typeof val === 'string') return 2;
      if (typeof val === 'boolean') return 4;
      if (val === null || val === undefined) return 1; // Blank treated as number (0) in Excel
      return 1;
    },
  });
}
