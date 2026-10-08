import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { IActiveCell, IColumnDef, IGridCellNavigator, ISelectionRange } from '../types';
import type { IFormulaRowMap, ISheetReferenceRange } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';

export interface UseSheetSelectionParams<T> {
  wrapperRef: React.RefObject<HTMLElement | null>;
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  rowCount: number;
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
  setSelectionRange: (range: ISelectionRange | null) => void;
  /** Flat (sheet) column of a column id; defaults to the visible index. */
  formulaCol?: (columnId: string) => number;
  formulaRowMap?: IFormulaRowMap;
  /** Sheet row of displayed row 0 when there is no row map (paging). */
  rowNumberOffset: number;
  /** Filled with the name box navigator. */
  cellNavigatorRef?: React.MutableRefObject<IGridCellNavigator | null>;
}

export interface UseSheetSelectionResult {
  /** Pointer down on a column letter header: select the column; Shift extends; drag extends. */
  handleColumnHeaderPointerDown: (e: React.PointerEvent, dataColIndex: number) => void;
  /** Pointer down on a row number cell: select the row; Shift extends; drag extends. */
  handleRowHeaderPointerDown: (e: React.PointerEvent, rowIndex: number) => void;
}

/** Marks column letter headers (value: visible data column index) for drag hit-testing. */
export const COLUMN_HEADER_INDEX_ATTR = 'data-col-header-index';
/** Marks row number cells (value: displayed row index) for drag hit-testing. */
export const ROW_HEADER_INDEX_ATTR = 'data-row-header-index';

/** Displayed row of the first body row below the header, so selecting a column doesn't scroll. */
function firstVisibleRow(wrapper: HTMLElement | null): number {
  if (!wrapper) return 0;
  const headerBottom = wrapper.querySelector('thead')?.getBoundingClientRect().bottom ?? wrapper.getBoundingClientRect().top;
  for (const tr of Array.from(wrapper.querySelectorAll<HTMLElement>('tbody tr[data-row-id]'))) {
    if (tr.getBoundingClientRect().bottom <= headerBottom + 1) continue;
    const cell = tr.querySelector<HTMLElement>('[data-row-index]');
    const row = Number(cell?.dataset.rowIndex);
    if (Number.isFinite(row)) return row;
  }
  return 0;
}

/** Index from the header under the pointer, read from `attr`. */
function headerIndexAt(x: number, y: number, attr: string): number | null {
  if (typeof document.elementFromPoint !== 'function') return null;
  const el = document.elementFromPoint(x, y)?.closest(`[${attr}]`);
  const value = Number(el?.getAttribute(attr));
  return el && Number.isFinite(value) ? value : null;
}

/**
 * Whole-row and whole-column selection from the sheet headers (column letters,
 * row numbers) and the name box's jump to a typed reference. Ranges are plain
 * cell ranges, so copy, delete, fill and the status bar work on them as usual.
 */
export function useSheetSelection<T>(params: UseSheetSelectionParams<T>): UseSheetSelectionResult {
  const p = useLatestRef(params);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  /** Select the rectangle between two header indexes; the active cell goes to `active`. */
  const startHeaderSelection = useCallback((e: React.PointerEvent, axis: 'col' | 'row', index: number) => {
    if (e.button !== 0) return;
    const { wrapperRef, activeCell, colOffset, rowCount, visibleCols, setActiveCell, setSelectionRange } = p.current;
    if (rowCount === 0 || visibleCols.length === 0) return;
    e.preventDefault();
    const lastRow = rowCount - 1;
    const lastCol = visibleCols.length - 1;
    const activeDataCol = activeCell ? activeCell.columnIndex - colOffset : -1;
    // Shift extends from the active cell's column / row and leaves the active cell in place.
    const extend = e.shiftKey && activeCell != null && activeDataCol >= 0;
    const anchor = extend ? (axis === 'col' ? activeDataCol : activeCell.rowIndex) : index;
    const select = (to: number) => {
      const lo = Math.min(anchor, to);
      const hi = Math.max(anchor, to);
      setSelectionRange(axis === 'col'
        ? { startRow: 0, endRow: lastRow, startCol: lo, endCol: hi }
        : { startRow: lo, endRow: hi, startCol: 0, endCol: lastCol });
    };
    wrapperRef.current?.focus({ preventScroll: true });
    select(index);
    if (!extend) {
      setActiveCell(axis === 'col'
        ? { rowIndex: firstVisibleRow(wrapperRef.current), columnIndex: index + colOffset }
        : { rowIndex: index, columnIndex: (activeDataCol >= 0 ? activeDataCol : 0) + colOffset });
    }

    // Drag across headers extends the selection.
    dragCleanupRef.current?.();
    const attr = axis === 'col' ? COLUMN_HEADER_INDEX_ATTR : ROW_HEADER_INDEX_ATTR;
    let last = index;
    const onMove = (ev: PointerEvent) => {
      const at = headerIndexAt(ev.clientX, ev.clientY, attr);
      if (at == null || at === last) return;
      last = at;
      select(at);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', cleanup, true);
      window.removeEventListener('pointercancel', cleanup, true);
      dragCleanupRef.current = null;
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', cleanup, true);
    window.addEventListener('pointercancel', cleanup, true);
    dragCleanupRef.current = cleanup;
  }, [p]);

  const handleColumnHeaderPointerDown = useCallback(
    (e: React.PointerEvent, dataColIndex: number) => startHeaderSelection(e, 'col', dataColIndex),
    [startHeaderSelection]
  );
  const handleRowHeaderPointerDown = useCallback(
    (e: React.PointerEvent, rowIndex: number) => startHeaderSelection(e, 'row', rowIndex),
    [startHeaderSelection]
  );

  const navigator = useMemo<IGridCellNavigator>(() => ({
    selectRange: (ref: ISheetReferenceRange) => {
      const { visibleCols, formulaCol, formulaRowMap, rowNumberOffset, rowCount, colOffset, setActiveCell, setSelectionRange, wrapperRef } = p.current;
      if (rowCount === 0 || visibleCols.length === 0) return false;
      // Visible columns whose sheet column is in range (a bounding box when columns are reordered).
      let c0 = -1;
      let c1 = -1;
      visibleCols.forEach((col, i) => {
        const sheetCol = formulaCol ? formulaCol(col.columnId) : i;
        if (ref.startCol != null && (sheetCol < ref.startCol || sheetCol > (ref.endCol ?? ref.startCol))) return;
        if (c0 < 0) c0 = i;
        c1 = i;
      });
      // Displayed rows whose sheet row is in range.
      let r0 = -1;
      let r1 = -1;
      if (ref.startRow == null) {
        r0 = 0;
        r1 = rowCount - 1;
      } else if (formulaRowMap) {
        const end = ref.endRow ?? ref.startRow;
        for (let d = 0; d < rowCount; d++) {
          const s = formulaRowMap.toSheetRow(d);
          if (s < ref.startRow || s > end) continue;
          if (r0 < 0) r0 = d;
          r1 = d;
        }
      } else {
        r0 = Math.max(0, ref.startRow - rowNumberOffset);
        r1 = Math.min(rowCount - 1, (ref.endRow ?? ref.startRow) - rowNumberOffset);
        if (r0 > r1) r0 = r1 = -1;
      }
      if (c0 < 0 || r0 < 0) return false;
      setSelectionRange({ startRow: r0, startCol: c0, endRow: r1, endCol: c1 });
      setActiveCell({ rowIndex: r0, columnIndex: c0 + colOffset });
      // The wrapper holds focus until the active cell takes it after the render.
      wrapperRef.current?.focus({ preventScroll: true });
      return true;
    },
    focusActiveCell: () => {
      const wrapper = p.current.wrapperRef.current;
      if (!wrapper) return;
      const cell = wrapper.querySelector<HTMLElement>('tbody td[tabindex="0"]');
      (cell ?? wrapper).focus({ preventScroll: true });
    },
  }), [p]);

  const { cellNavigatorRef } = params;
  useEffect(() => {
    if (!cellNavigatorRef) return;
    cellNavigatorRef.current = navigator;
    return () => {
      if (cellNavigatorRef.current === navigator) cellNavigatorRef.current = null;
    };
  }, [cellNavigatorRef, navigator]);

  return { handleColumnHeaderPointerDown, handleRowHeaderPointerDown };
}
