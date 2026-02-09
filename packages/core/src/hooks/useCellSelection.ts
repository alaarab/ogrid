import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';

export interface UseCellSelectionParams {
  colOffset: number;
  rowCount: number;
  visibleColCount: number;
  setActiveCell: (cell: IActiveCell | null) => void;
  wrapperRef: React.RefObject<HTMLElement | null>;
}

export interface UseCellSelectionResult {
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  /** True while the user is drag-selecting cells (mousedown → mousemove → mouseup). */
  isDragging: boolean;
}

/** DOM attribute name used for drag-range highlighting (bypasses React). */
const DRAG_ATTR = 'data-drag-range';

export function useCellSelection(params: UseCellSelectionParams): UseCellSelectionResult {
  const { colOffset, rowCount, visibleColCount, setActiveCell, wrapperRef } = params;

  const [selectionRange, setSelectionRange] = useState<ISelectionRange | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const rafRef = useRef(0);
  /** Live drag range kept in a ref — only committed to React state on mouseup. */
  const liveDragRangeRef = useRef<ISelectionRange | null>(null);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      // Only handle primary (left) button — let middle-click scroll and right-click context menu work natively
      if (e.button !== 0) return;
      if (globalColIndex < colOffset) return;
      // Prevent native text selection during cell drag
      e.preventDefault();
      const dataColIndex = globalColIndex - colOffset;
      if (e.shiftKey && selectionRange != null) {
        setSelectionRange(
          normalizeSelectionRange({
            startRow: selectionRange.startRow,
            startCol: selectionRange.startCol,
            endRow: rowIndex,
            endCol: dataColIndex,
          })
        );
        setActiveCell({ rowIndex, columnIndex: globalColIndex });
      } else {
        dragStartRef.current = { row: rowIndex, col: dataColIndex };
        const initial: ISelectionRange = {
          startRow: rowIndex,
          startCol: dataColIndex,
          endRow: rowIndex,
          endCol: dataColIndex,
        };
        setSelectionRange(initial);
        liveDragRangeRef.current = initial;
        setActiveCell({ rowIndex, columnIndex: globalColIndex });
        isDraggingRef.current = true;
        setIsDragging(true);
      }
    },
    [colOffset, selectionRange, setActiveCell]
  );

  const handleSelectAllCells = useCallback(() => {
    if (rowCount === 0 || visibleColCount === 0) return;
    setSelectionRange({
      startRow: 0,
      startCol: 0,
      endRow: rowCount - 1,
      endCol: visibleColCount - 1,
    });
    setActiveCell({ rowIndex: 0, columnIndex: colOffset });
  }, [rowCount, visibleColCount, colOffset, setActiveCell]);

  /** Last known mouse position during drag — used by mouseUp to flush pending RAF work. */
  const lastMousePosRef = useRef<{ cx: number; cy: number } | null>(null);

  // Window mouse move/up for drag selection.
  // Performance: during drag, we update a ref + toggle DOM attributes via rAF.
  // React state is only committed on mouseup (single re-render instead of 60-120/s).
  useEffect(() => {
    const colOff = colOffset; // capture for closure

    /** Toggle DRAG_ATTR on cell-content divs to show the range highlight via CSS. */
    const applyDragAttrs = (range: ISelectionRange) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);
      const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
      for (let i = 0; i < cells.length; i++) {
        const el = cells[i];
        const r = parseInt(el.getAttribute('data-row-index')!, 10);
        const c = parseInt(el.getAttribute('data-col-index')!, 10) - colOff;
        const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
        if (inRange) {
          if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
        } else {
          if (el.hasAttribute(DRAG_ATTR)) el.removeAttribute(DRAG_ATTR);
        }
      }
    };

    const clearDragAttrs = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const marked = wrapper.querySelectorAll(`[${DRAG_ATTR}]`);
      for (let i = 0; i < marked.length; i++) marked[i].removeAttribute(DRAG_ATTR);
    };

    /** Resolve mouse coordinates to a cell range (shared by RAF callback and mouseUp flush). */
    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      if (!dragStartRef.current) return null;
      const target = document.elementFromPoint(cx, cy);
      const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
      if (!cell) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOff) return null;
      const dataCol = c - colOff;
      const start = dragStartRef.current;
      return normalizeSelectionRange({
        startRow: start.row,
        startCol: start.col,
        endRow: r,
        endCol: dataCol,
      });
    };

    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      // Always store latest position so mouseUp can flush if RAF hasn't executed
      lastMousePosRef.current = { cx: e.clientX, cy: e.clientY };

      // Cancel previous pending frame
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const pos = lastMousePosRef.current;
        if (!pos) return;
        const newRange = resolveRange(pos.cx, pos.cy);
        if (!newRange) return;

        // Skip if range unchanged
        const prev = liveDragRangeRef.current;
        if (
          prev &&
          prev.startRow === newRange.startRow &&
          prev.startCol === newRange.startCol &&
          prev.endRow === newRange.endRow &&
          prev.endCol === newRange.endCol
        ) {
          return;
        }

        liveDragRangeRef.current = newRange;
        // DOM-only highlighting — no React state update until mouseup
        applyDragAttrs(newRange);
      });
    };

    const onUp = () => {
      if (!isDraggingRef.current) return;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      isDraggingRef.current = false;

      // Flush: if the last RAF hasn't executed yet, resolve the range now from the
      // last known mouse position so the final committed range is always accurate.
      const pos = lastMousePosRef.current;
      if (pos) {
        const flushed = resolveRange(pos.cx, pos.cy);
        if (flushed) liveDragRangeRef.current = flushed;
      }

      // Commit final range to React state (triggers a single re-render)
      const finalRange = liveDragRangeRef.current;
      if (finalRange) {
        setSelectionRange(finalRange);
        setActiveCell({
          rowIndex: finalRange.endRow,
          columnIndex: finalRange.endCol + colOff,
        });
      }

      // Clean up DOM attributes — React will apply CSS-module classes on the same paint
      clearDragAttrs();
      liveDragRangeRef.current = null;
      lastMousePosRef.current = null;
      dragStartRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [colOffset, setActiveCell, wrapperRef]);

  return {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown,
    handleSelectAllCells,
    isDragging,
  };
}
