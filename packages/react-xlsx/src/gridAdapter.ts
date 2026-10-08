// The one place this package touches grid features that are landing in
// @alaarab/ogrid-core / @alaarab/ogrid-react in parallel. Everything else in
// react-xlsx speaks the types below, so the hookup is local to this file.
//
// Pending upstream:
//   1. `mergedCells?: IMergedCell[]` and `frozenRows?: number` OGrid props.
//      gridLayoutProps() already passes both through; OGrid ignores unknown
//      props until they land. On merge: replace the local IMergedCell below
//      with `export type { IMergedCell } from '@alaarab/ogrid-core'`.
//   2. A range-selection read API. readSelection() reads the rendered cells'
//      data-in-range / data-active-cell attributes instead, so with row
//      virtualization a selection taller than the rendered window is clipped
//      to the rows on screen. Swap the body for the API call when one exists.

import type { RowId } from '@alaarab/ogrid-core';

/**
 * A merged block anchored at its top-left cell. Spans count displayed rows
 * and visible columns. Mirrors core's IMergedCell (pending; see above).
 */
export interface IMergedCell {
  rowId: RowId;
  columnId: string;
  rowSpan?: number;
  colSpan?: number;
}

/** Layout props for OGrid derived from a sheet. */
export function gridLayoutProps(layout: { mergedCells: IMergedCell[]; frozenRows: number }): {
  mergedCells?: IMergedCell[];
  frozenRows?: number;
} {
  return {
    ...(layout.mergedCells.length ? { mergedCells: layout.mergedCells } : {}),
    ...(layout.frozenRows > 0 ? { frozenRows: layout.frozenRows } : {}),
  };
}

/** The selected rectangle, in display order. */
export interface XlsxSelection {
  rowIds: RowId[];
  columnIds: string[];
}

/**
 * Read the grid's current cell selection (range, or just the active cell)
 * from the DOM under `root`. Row ids come from `tr[data-row-id]`; the grid
 * renders them with String(), so numeric ids are converted back via `toRowId`.
 */
export function readSelection(root: HTMLElement | null, toRowId: (attr: string) => RowId | undefined): XlsxSelection | null {
  if (!root) return null;
  let cells = root.querySelectorAll<HTMLElement>('[data-in-range="true"]');
  if (cells.length === 0) cells = root.querySelectorAll<HTMLElement>('[data-active-cell="true"]');
  if (cells.length === 0) return null;
  const rowIds: RowId[] = [];
  const columnIds: string[] = [];
  const seenRows = new Set<string>();
  const seenCols = new Set<string>();
  const rowOrder: Array<{ index: number; id: RowId }> = [];
  const colOrder: Array<{ index: number; id: string }> = [];
  for (const cell of cells) {
    const td = cell.closest('td');
    const tr = cell.closest('tr');
    const columnId = td?.getAttribute('data-column-id');
    const rowAttr = tr?.getAttribute('data-row-id');
    if (columnId == null || rowAttr == null) continue;
    const rowId = toRowId(rowAttr);
    if (rowId === undefined) continue;
    if (!seenRows.has(rowAttr)) {
      seenRows.add(rowAttr);
      rowOrder.push({ index: Number(cell.getAttribute('data-row-index') ?? rowOrder.length), id: rowId });
    }
    if (!seenCols.has(columnId)) {
      seenCols.add(columnId);
      colOrder.push({ index: Number(cell.getAttribute('data-col-index') ?? colOrder.length), id: columnId });
    }
  }
  for (const r of rowOrder.sort((a, b) => a.index - b.index)) rowIds.push(r.id);
  for (const c of colOrder.sort((a, b) => a.index - b.index)) columnIds.push(c.id);
  return rowIds.length && columnIds.length ? { rowIds, columnIds } : null;
}
