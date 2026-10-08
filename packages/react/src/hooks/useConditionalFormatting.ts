import { useMemo } from 'react';
import { createConditionalFormatter, getCellValue } from '@alaarab/ogrid-core';
import type { ICellConditionalFormat, IColumnDef, IConditionalFormatRule } from '@alaarab/ogrid-core';
import type { UseFormulaEngineResult } from './useFormulaEngine';

export interface UseConditionalFormattingParams<T> {
  /** The rules. Memoize the array: a new one recomputes every cell's format. */
  rules: IConditionalFormatRule<T>[] | undefined;
  /** Rows the rules cover, in sheet order (row N is formula row N). */
  items: T[];
  /** Flat leaf columns (column N is formula column N). */
  columns: IColumnDef<T>[];
  /** Formula engine: formula cells are judged by their results, and `formula` rules evaluate through it. */
  formulaEngine?: Pick<UseFormulaEngineResult, 'enabled' | 'hasFormula' | 'getFormulaValue' | 'createDetachedEvaluator'> & Partial<Pick<UseFormulaEngineResult, 'getSpillRange'>>;
  /** Bumped on every formula recalculation; recomputes formats that read formula results. */
  formulaVersion?: number;
}

/**
 * Conditional formatting for a grid: returns `(item, columnId) => format`, or
 * undefined when there are no rules. Statistics are computed once per data,
 * rules or formula change (not per cell), and per-cell results are cached.
 * Pass the result as DataGridTable's `conditionalFormat` prop; OGrid does this
 * for its `conditionalFormats` prop.
 */
export function useConditionalFormatting<T>(
  params: UseConditionalFormattingParams<T>,
): ((item: T, columnId: string) => ICellConditionalFormat | undefined) | undefined {
  const { rules, items, columns, formulaEngine, formulaVersion } = params;
  const engineOn = formulaEngine?.enabled === true;
  const hasFormula = formulaEngine?.hasFormula;
  const getFormulaValue = formulaEngine?.getFormulaValue;
  const getSpillRange = formulaEngine?.getSpillRange;
  const createDetachedEvaluator = formulaEngine?.createDetachedEvaluator;
  // biome-ignore lint/correctness/useExhaustiveDependencies: formulaVersion is the deliberate trigger: a recalc changes formula results the formats read
  return useMemo(() => {
    if (!rules || rules.length === 0) return undefined;
    const formatter = createConditionalFormatter(rules, {
      items,
      columns,
      getValue: engineOn && hasFormula && getFormulaValue
        ? (item, column, row, col) => (row >= 0 && (hasFormula(col, row) || getSpillRange?.(col, row)) ? getFormulaValue(col, row) : getCellValue(item, column))
        : undefined,
      evaluateFormula: engineOn ? createDetachedEvaluator?.() : undefined,
    });
    return formatter ? (item: T, columnId: string) => formatter.getCellFormat(item, columnId) : undefined;
  }, [rules, items, columns, engineOn, hasFormula, getFormulaValue, getSpillRange, createDetachedEvaluator, formulaVersion]);
}
