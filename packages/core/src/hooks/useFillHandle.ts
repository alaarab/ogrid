import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import { getCellValue } from '../utils';
import { parseValue } from '../utils/valueParsers';

export interface UseFillHandleParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  setActiveCell: (cell: IActiveCell | null) => void;
  colOffset: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
  beginBatch?: () => void;
  endBatch?: () => void;
}

export interface UseFillHandleResult {
  fillDrag: { startRow: number; startCol: number } | null;
  setFillDrag: (value: { startRow: number; startCol: number } | null) => void;
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;
}

/** DOM attribute name for fill-drag range highlighting (same as cell selection drag). */
const DRAG_ATTR = 'data-drag-range';

export function useFillHandle<T>(params: UseFillHandleParams<T>): UseFillHandleResult {
  const {
    items,
    visibleCols,
    editable,
    onCellValueChanged,
    selectionRange,
    setSelectionRange,
    setActiveCell,
    colOffset,
    wrapperRef,
    beginBatch,
    endBatch,
  } = params;

  const [fillDrag, setFillDrag] = useState<{ startRow: number; startCol: number } | null>(null);
  const fillDragEndRef = useRef<{ endRow: number; endCol: number }>({ endRow: 0, endCol: 0 });
  const rafRef = useRef(0);
  const liveFillRangeRef = useRef<ISelectionRange | null>(null);

  useEffect(() => {
    if (!fillDrag || editable === false || !onCellValueChanged || !wrapperRef.current) return;
    fillDragEndRef.current = { endRow: fillDrag.startRow, endCol: fillDrag.startCol };
    liveFillRangeRef.current = null;

    const colOff = colOffset;

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

    let lastFillMousePos: { cx: number; cy: number } | null = null;

    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      if (!cell || !wrapperRef.current?.contains(cell)) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOff) return null;
      const dataCol = c - colOff;
      return normalizeSelectionRange({
        startRow: fillDrag.startRow,
        startCol: fillDrag.startCol,
        endRow: r,
        endCol: dataCol,
      });
    };

    const onMove = (e: MouseEvent) => {
      lastFillMousePos = { cx: e.clientX, cy: e.clientY };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!lastFillMousePos) return;
        const newRange = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (!newRange) return;

        // Skip if unchanged
        const prev = liveFillRangeRef.current;
        if (
          prev &&
          prev.startRow === newRange.startRow &&
          prev.startCol === newRange.startCol &&
          prev.endRow === newRange.endRow &&
          prev.endCol === newRange.endCol
        ) {
          return;
        }

        liveFillRangeRef.current = newRange;
        fillDragEndRef.current = { endRow: newRange.endRow, endCol: newRange.endCol };
        applyDragAttrs(newRange);
      });
    };

    const onUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      // Flush: resolve final position if RAF hasn't executed yet
      if (lastFillMousePos) {
        const flushed = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (flushed) {
          liveFillRangeRef.current = flushed;
          fillDragEndRef.current = { endRow: flushed.endRow, endCol: flushed.endCol };
        }
      }

      clearDragAttrs();

      const end = fillDragEndRef.current;
      const norm = normalizeSelectionRange({
        startRow: fillDrag.startRow,
        startCol: fillDrag.startCol,
        endRow: end.endRow,
        endCol: end.endCol,
      });

      // Commit range to React state
      setSelectionRange(norm);
      setActiveCell({ rowIndex: end.endRow, columnIndex: end.endCol + colOff });

      // Apply fill values
      const startItem = items[norm.startRow];
      const startColDef = visibleCols[norm.startCol];
      if (startItem && startColDef) {
        const startValue = getCellValue(startItem, startColDef);
        beginBatch?.();
        for (let row = norm.startRow; row <= norm.endRow; row++) {
          for (let col = norm.startCol; col <= norm.endCol; col++) {
            if (row === fillDrag.startRow && col === fillDrag.startCol) continue;
            if (row >= items.length || col >= visibleCols.length) continue;
            const item = items[row];
            const colDef = visibleCols[col];
            const colEditable =
              colDef.editable === true ||
              (typeof colDef.editable === 'function' && colDef.editable(item));
            if (!colEditable) continue;
            const oldValue = getCellValue(item, colDef);
            const result = parseValue(startValue, oldValue, item, colDef);
            if (!result.valid) continue;
            onCellValueChanged({
              item,
              columnId: colDef.columnId,
              field: colDef.columnId,
              oldValue,
              newValue: result.value,
              rowIndex: row,
            });
          }
        }
        endBatch?.();
      }
      setFillDrag(null);
      liveFillRangeRef.current = null;
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    fillDrag,
    editable,
    colOffset,
    items,
    visibleCols,
    setSelectionRange,
    setActiveCell,
    onCellValueChanged,
    wrapperRef,
    beginBatch,
    endBatch,
  ]);

  // Ref mirror — keeps handleFillHandleMouseDown stable across selection changes
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  const handleFillHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const range = selectionRangeRef.current;
      if (!range) return;
      setFillDrag({
        startRow: range.startRow,
        startCol: range.startCol,
      });
    },
    []
  );

  return { fillDrag, setFillDrag, handleFillHandleMouseDown };
}
