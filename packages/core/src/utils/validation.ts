import type { IColumnDef } from '../types/columnTypes';
import type { RowId, IVirtualScrollConfig } from '../types/dataGridTypes';

/**
 * Validate column definitions at grid initialization.
 * Called once (not per render). Warns on empty/missing/duplicate columnIds.
 * In development mode, also warns when editable=true but no cellEditor is defined.
 */
export function validateColumns<T>(columns: IColumnDef<T>[]): void {
  if (!Array.isArray(columns) || columns.length === 0) {
    console.warn('[OGrid] columns prop is empty or not an array');
    return;
  }
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  const ids = new Set<string>();
  for (const col of columns) {
    if (!col.columnId) {
      console.warn('[OGrid] Column missing columnId:', col);
    }
    if (ids.has(col.columnId)) {
      console.warn(`[OGrid] Duplicate columnId: "${col.columnId}"`);
    }
    ids.add(col.columnId);
    if (isDev && col.editable === true && col.cellEditor == null) {
      console.warn(
        `[OGrid] Column "${col.columnId}" has editable=true but no cellEditor defined. ` +
        `Cells will not open an editor on double-click. Set cellEditor to 'text', 'select', 'checkbox', 'date', or a custom component.`
      );
    }
  }
}

/**
 * Validate virtual scroll configuration.
 * Dev-only warning when enabled=true but rowHeight is missing or <= 0.
 */
export function validateVirtualScrollConfig(config: IVirtualScrollConfig): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  if (config.enabled !== true) return;
  if (!config.rowHeight || config.rowHeight <= 0) {
    console.warn(
      '[OGrid] virtualScroll.enabled is true but rowHeight is missing or <= 0. ' +
      'Set a positive rowHeight (e.g. virtualScroll: { enabled: true, rowHeight: 36 }) ' +
      'for correct virtual scrolling behavior.'
    );
  }
}

/**
 * Validate that getRowId returns unique, non-null values.
 * Dev-only (skipped in production). Samples the first 100 rows.
 * Called once on first data render via a hasValidated flag in the caller.
 */
export function validateRowIds<T>(items: T[], getRowId: ((item: T) => RowId) | null | undefined): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;
  if (!getRowId) return;
  const ids = new Set<RowId>();
  const limit = Math.min(items.length, 100);
  for (let i = 0; i < limit; i++) {
    const item = items[i];
    if (item === undefined) continue;
    const id = getRowId(item);
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
