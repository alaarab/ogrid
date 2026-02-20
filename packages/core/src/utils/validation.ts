import type { IColumnDef } from '../types/columnTypes';
import type { RowId } from '../types/dataGridTypes';

/**
 * Validate column definitions at grid initialization.
 * Called once (not per render). Warns on empty/missing/duplicate columnIds.
 */
export function validateColumns<T>(columns: IColumnDef<T>[]): void {
  if (!Array.isArray(columns) || columns.length === 0) {
    console.warn('[OGrid] columns prop is empty or not an array');
    return;
  }
  const ids = new Set<string>();
  for (const col of columns) {
    if (!col.columnId) {
      console.warn('[OGrid] Column missing columnId:', col);
    }
    if (ids.has(col.columnId)) {
      console.warn(`[OGrid] Duplicate columnId: "${col.columnId}"`);
    }
    ids.add(col.columnId);
  }
}

/**
 * Validate that getRowId returns unique, non-null values.
 * Dev-only (skipped in production). Samples the first 100 rows.
 * Called once on first data render via a hasValidated flag in the caller.
 */
export function validateRowIds<T>(items: T[], getRowId: (item: T) => RowId): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;
  const ids = new Set<RowId>();
  const limit = Math.min(items.length, 100);
  for (let i = 0; i < limit; i++) {
    const id = getRowId(items[i]);
    if (id == null) {
      console.warn(`[OGrid] getRowId returned null/undefined for row ${i}`);
      return;
    }
    if (ids.has(id)) {
      console.warn(
        `[OGrid] Duplicate row ID "${id}" at index ${i}. getRowId must return unique values.`
      );
      return;
    }
    ids.add(id);
  }
}
