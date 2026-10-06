/**
 * Pure derivations behind useDataGridTableOrchestration's slices: layout,
 * pinning, virtualization and sheet coordinates. Each is unit-tested on its own.
 */
import { formatCellReference, ROW_NUMBER_COLUMN_ID } from '@alaarab/ogrid-core';
import type { FormulaReference, IFormulaRowMap } from '@alaarab/ogrid-core';
import type { IVirtualScrollConfig, PageSize, RowId } from '../types';

/**
 * Row number of the first displayed row minus one. Only a paged grid with a
 * row-number column has an offset; a windowed source scrolls every row in one
 * viewport, so it never has one.
 */
export function resolveRowNumberOffset(
  hasRowNumbersCol: boolean,
  windowed: boolean,
  currentPage: number,
  pageSize: PageSize,
): number {
  return hasRowNumbersCol && !windowed && pageSize !== 'all' ? (currentPage - 1) * pageSize : 0;
}

/** Horizontal scrolling is on once the table can't fit its container (and isn't suppressed). */
export function resolveAllowOverflowX(
  suppressHorizontalScroll: boolean | undefined,
  containerWidth: number,
  minTableWidth: number,
  desiredTableWidth: number,
): boolean {
  return !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);
}

export interface VirtualScrollSettings {
  enabled: boolean;
  rowHeight: number;
  columnVirtualization: boolean;
  totalRows: number;
  threshold: number | undefined;
}

/**
 * A windowed (lazy) data source is always virtualized (the grid never holds
 * its full dataset), so it forces virtual scrolling on regardless of the prop,
 * scrolls `rowCount` rows, and drops the activation threshold to 0. The row
 * height prop wins over the virtual scroll config, then 36px.
 */
export function resolveVirtualScrollSettings(
  virtualScroll: IVirtualScrollConfig | undefined,
  windowedRowCount: number | null,
  rowHeight: number | undefined,
  itemCount: number,
): VirtualScrollSettings {
  const windowed = windowedRowCount !== null;
  return {
    enabled: virtualScroll?.enabled === true || windowed,
    rowHeight: rowHeight ?? virtualScroll?.rowHeight ?? 36,
    columnVirtualization: virtualScroll?.columns === true,
    totalRows: windowed ? windowedRowCount : itemCount,
    threshold: windowed ? 0 : virtualScroll?.threshold,
  };
}

/** Widths of the unpinned visible columns, in order: what horizontal virtualization scrolls. */
export function collectUnpinnedColumnWidths<C extends { columnId: string }>(
  visibleCols: readonly C[],
  pinnedColumns: Record<string, 'left' | 'right'> | undefined,
  getColumnWidth: (col: C) => number,
): number[] {
  const widths: number[] = [];
  for (const col of visibleCols) {
    if (!pinnedColumns?.[col.columnId]) widths.push(getColumnWidth(col));
  }
  return widths;
}

/** The row-number column is grid chrome, not a column: its resizes are not reported. */
export function isReportableColumnResize(columnId: string): boolean {
  return columnId !== ROW_NUMBER_COLUMN_ID;
}

/** Row-number label of a displayed row: its sheet row when mapped, else the page offset. */
export function toRowNumberLabel(formulaRowMap: IFormulaRowMap, rowNumberOffset: number, rowIndex: number): number {
  const sheetRow = formulaRowMap.toSheetRow(rowIndex);
  return sheetRow >= 0 ? sheetRow + 1 : rowNumberOffset + rowIndex + 1;
}

/**
 * A1 reference of the active cell, named the way formulas address it: flat
 * column index and sheet row. `null` when there is no active data cell (or it
 * maps outside the sheet).
 */
export function resolveActiveCellReference(
  ac: { rowIndex: number; columnIndex: number } | null,
  visibleCols: readonly { columnId: string }[],
  colOffset: number,
  formulaCol: ((columnId: string) => number) | undefined,
  formulaRowMap: IFormulaRowMap | undefined,
  rowNumberOffset: number,
): string | null {
  const col = ac ? visibleCols[ac.columnIndex - colOffset] : undefined;
  if (!ac || !col) return null;
  const sheetCol = formulaCol ? formulaCol(col.columnId) : ac.columnIndex - colOffset;
  const sheetRow = formulaRowMap ? formulaRowMap.toSheetRow(ac.rowIndex) : rowNumberOffset + ac.rowIndex;
  return sheetCol >= 0 && sheetRow >= 0 ? formatCellReference(sheetCol, sheetRow + 1) : null;
}

/**
 * Translate formula references (flat columns, sheet rows) to the visible
 * columns and displayed rows the overlay measures. A range whose cells are
 * scattered by sorting or column order is outlined by its bounding box.
 */
export function mapFormulaReferencesToView(
  refs: FormulaReference[] | undefined,
  visibleCols: readonly { columnId: string }[],
  formulaCol: ((columnId: string) => number) | undefined,
  rowMap: IFormulaRowMap | undefined,
  rowCount: number,
): FormulaReference[] | undefined {
  if (!refs || refs.length === 0) return refs;
  const out: FormulaReference[] = [];
  for (const ref of refs) {
    const c0 = Math.min(ref.col, ref.endCol ?? ref.col);
    const c1 = Math.max(ref.col, ref.endCol ?? ref.col);
    const r0 = Math.min(ref.row, ref.endRow ?? ref.row);
    const r1 = Math.max(ref.row, ref.endRow ?? ref.row);
    let minCol = -1;
    let maxCol = -1;
    for (let i = 0; i < visibleCols.length; i++) {
      const col = visibleCols[i];
      const flat = col && formulaCol ? formulaCol(col.columnId) : i;
      if (flat < c0 || flat > c1) continue;
      if (minCol < 0) minCol = i;
      maxCol = i;
    }
    let minRow = -1;
    let maxRow = -1;
    if (!rowMap) {
      minRow = r0;
      maxRow = r1;
    } else if (r0 === r1) {
      minRow = maxRow = rowMap.toDisplayRow(r0);
    } else {
      for (let i = 0; i < rowCount; i++) {
        const sheetRow = rowMap.toSheetRow(i);
        if (sheetRow < r0 || sheetRow > r1) continue;
        if (minRow < 0) minRow = i;
        maxRow = i;
      }
    }
    if (minCol < 0 || minRow < 0) continue;
    out.push(minCol === maxCol && minRow === maxRow
      ? { type: 'cell', col: minCol, row: minRow, colorIndex: ref.colorIndex }
      : { type: 'range', col: minCol, row: minRow, endCol: maxCol, endRow: maxRow, colorIndex: ref.colorIndex });
  }
  return out;
}

/** Reads a delegated cell's coordinates from its data attributes. */
export function parseCellCoords(el: Element | null): { row: number; col: number } | null {
  if (!el) return null;
  const r = parseInt(el.getAttribute('data-row-index') ?? '', 10);
  const c = parseInt(el.getAttribute('data-col-index') ?? '', 10);
  return (!Number.isNaN(r) && !Number.isNaN(c)) ? { row: r, col: c } : null;
}

/** Single-row selection toggle: clicking the selected row clears it, any other row selects only that row. */
export function toggleSingleRowSelection(selected: ReadonlySet<RowId>, rowId: RowId): Set<RowId> {
  return selected.has(rowId) ? new Set() : new Set([rowId]);
}
