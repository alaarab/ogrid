import { FormulaError, type IFormulaContext } from './types';
import { MAX_RANGE_CELLS } from './limits';

export function asArray(value: unknown): unknown[][] {
  return Array.isArray(value) ? value : [[value]];
}

/** Charge before allocating generated arrays, including singleton broadcasting. */
export function checkArraySize(rows: number, cols: number, context: IFormulaContext): void {
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(cols) || rows < 1 || cols < 1 || rows * cols > Math.min(MAX_RANGE_CELLS, context.maxArrayCells ?? MAX_RANGE_CELLS)) {
    throw new FormulaError('#VALUE!', 'Array too large or invalid dimensions');
  }
  context.consumeWork?.(rows * cols);
}

/** Excel broadcasts a scalar or singleton axis; unmatched cells return #N/A. */
export function mapArrays(values: unknown[], context: IFormulaContext, calculate: (cells: unknown[]) => unknown): unknown {
  if (!values.some(Array.isArray)) return calculate(values);
  const arrays = values.map(asArray);
  const rows = Math.max(...arrays.map(a => a.length));
  const cols = Math.max(...arrays.map(a => a[0]?.length ?? 0));
  checkArraySize(rows, cols, context);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => calculate(arrays.map(a => {
    const row = a[a.length === 1 ? 0 : r];
    return row && (row.length === 1 || c < row.length) ? row[row.length === 1 ? 0 : c] : new FormulaError('#N/A');
  }))));
}

export function transpose(array: unknown[][]): unknown[][] {
  return Array.from({ length: array[0]?.length ?? 0 }, (_, c) => array.map(row => row[c]));
}
