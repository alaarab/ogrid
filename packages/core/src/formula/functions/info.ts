import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber, evalArg } from '../evaluator';

export function registerInfoFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('ISBLANK', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      // A grid cell cleared to '' is empty; the literal ISBLANK("") is not.
      return val === null || val === undefined || (val === '' && args[0]?.kind === 'cellRef');
    },
  });

  registry.set('COUNTBLANK', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext): unknown {
      const arg = args[0];
      if (!arg || (arg.kind !== 'range' && arg.kind !== 'cellRef')) return new FormulaError('#VALUE!', 'COUNTBLANK requires a reference');
      if (arg.kind === 'cellRef') { const value = context.getCellValue(arg.address); return value === null || value === undefined || value === '' ? 1 : 0; }
      const data = context.getRangeValues({ start: arg.start, end: arg.end });
      const total = (Math.abs(arg.end.row - arg.start.row) + 1) * (Math.abs(arg.end.col - arg.start.col) + 1);
      let nonblank = 0;
      for (const row of data) for (const value of row) if (value !== null && value !== undefined && value !== '') nonblank++;
      return total - nonblank;
    },
  });

  registry.set('ISNUMBER', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      return typeof val === 'number' && !Number.isNaN(val);
    },
  });

  registry.set('ISTEXT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      return typeof val === 'string';
    },
  });

  registry.set('ISERROR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      return val instanceof FormulaError;
    },
  });

  registry.set('ISNA', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      return val instanceof FormulaError && val.type === '#N/A';
    },
  });

  registry.set('TYPE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return 16; // Error
      if (typeof val === 'number') return 1;
      if (typeof val === 'string') return 2;
      if (typeof val === 'boolean') return 4;
      if (val === null || val === undefined) return 1; // Blank treated as number (0) in Excel
      return 1;
    },
  });

  // --- ISODD ---
  registry.set('ISODD', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      if (typeof val === 'boolean') return new FormulaError('#VALUE!', 'ISODD requires a number');
      const n = toNumber(val);
      if (n instanceof FormulaError) return n;
      return Math.trunc(n) % 2 !== 0;
    },
  });

  // --- ISEVEN ---
  registry.set('ISEVEN', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      if (typeof val === 'boolean') return new FormulaError('#VALUE!', 'ISEVEN requires a number');
      const n = toNumber(val);
      if (n instanceof FormulaError) return n;
      return Math.trunc(n) % 2 === 0;
    },
  });

  // --- ISFORMULA ---
  registry.set('ISFORMULA', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      const arg = args[0];
      if (arg === undefined || arg.kind !== 'cellRef') return false;
      if (!context.getCellFormula) return false;
      const formula = context.getCellFormula(arg.address);
      return formula !== undefined;
    },
  });

  // --- ISLOGICAL ---
  registry.set('ISLOGICAL', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return false;
      return typeof val === 'boolean';
    },
  });

  // --- ISNONTEXT ---
  registry.set('ISNONTEXT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return true; // errors are non-text
      return typeof val !== 'string';
    },
  });

  // --- ISREF ---
  registry.set('ISREF', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], _context: IFormulaContext, _evaluator: IEvaluator): unknown {
      // In formula engine context: TRUE if the argument is a cell or range reference node
      const arg = args[0];
      return arg !== undefined && (arg.kind === 'cellRef' || arg.kind === 'range');
    },
  });
}
