import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import { applyFillValues, buildCellIndex } from '../utils';
import type { IFillFormulaOptions } from '../utils';
import { useLatestRef } from './useLatestRef';

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
  /** Optional formula-aware fill options. When provided, cells with formulas adjust references during fill. */
  formulaOptions?: IFillFormulaOptions<T>;
}

export interface UseFillHandleResult {
  fillDrag: { startRow: number; startCol: number } | null;
  setFillDrag: (value: { startRow: number; startCol: number } | null) => void;
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;
  /** Fill the current selection down from the top row (Ctrl+D). No-op if no selection or editable=false. */
  fillDown: () => void;
}

/** DOM attribute name for fill-drag range highlighting (same as cell selection drag). */
const DRAG_ATTR = 'data-drag-range';

/**
 * Manages Excel-style fill handle drag-to-fill for cell ranges.
 * @param params - Items, columns, selection range, editability, and value change callback.
 * @returns Fill drag state, setter, and mousedown handler for the fill handle.
 */
export function useFillHandle<T>(params: UseFillHandleParams<T>): UseFillHandleResult {
  const {
    items,
    visibleCols,
    editable,
    onCellValueChanged: onCellValueChangedProp,
    selectionRange,
    setSelectionRange,
    setActiveCell,
    colOffset,
    wrapperRef,
    beginBatch,
    endBatch,
    formulaOptions,
  } = params;

  const onCellValueChangedRef = useLatestRef(onCellValueChangedProp);
  const [fillDrag, setFillDrag] = useState<{ startRow: number; startCol: number } | null>(null);
  const fillDragEndRef = useRef<{ endRow: number; endCol: number }>({ endRow: 0, endCol: 0 });
  const rafRef = useRef(0);
  const liveFillRangeRef = useRef<ISelectionRange | null>(null);
  const colOffsetRef = useLatestRef(colOffset);
  const itemsRef = useLatestRef(items);
  const visibleColsRef = useLatestRef(visibleCols);
  const formulaOptionsRef = useLatestRef(formulaOptions);

  useEffect(() => {
    if (!fillDrag || editable === false || !onCellValueChangedRef.current || !wrapperRef.current) return;
    fillDragEndRef.current = { endRow: fillDrag.startRow, endCol: fillDrag.startCol };
    liveFillRangeRef.current = null;

    /** Set of currently drag-marked HTMLElements — avoids O(n) full DOM scan on clear. */
    const markedCells = new Set<Element>();

    /** Cell lookup index built on drag start — O(1) lookups per frame. */
    let cellIndex = buildCellIndex(wrapperRef.current);

    const applyDragAttrs = (range: ISelectionRange) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);
      const colOff = colOffsetRef.current;

      // Un-mark cells no longer in range
      for (const el of markedCells) {
        const r = parseInt(el.getAttribute('data-row-index') ?? '', 10);
        const c = parseInt(el.getAttribute('data-col-index') ?? '', 10) - colOff;
        if (!(r >= minR && r <= maxR && c >= minC && c <= maxC)) {
          el.removeAttribute(DRAG_ATTR);
          markedCells.delete(el);
        }
      }

      // Look up only cells in the new range — O(range size) via Map lookup
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = `${r},${c + colOff}`;
          let el = cellIndex?.get(key);
          // Handle virtual scroll recycling — if element is stale, rebuild index once
          if (el && !el.isConnected) {
            cellIndex = buildCellIndex(wrapperRef.current);
            el = cellIndex.get(key);
          }
          if (el) {
            if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
            markedCells.add(el);
          }
        }
      }
    };

    const clearDragAttrs = () => {
      for (const el of markedCells) {
        el.removeAttribute(DRAG_ATTR);
      }
      markedCells.clear();
    };

    let lastFillMousePos: { cx: number; cy: number } | null = null;

    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      if (!cell || !wrapperRef.current?.contains(cell)) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOffsetRef.current) return null;
      const dataCol = c - colOffsetRef.current;
      return normalizeSelectionRange({
        startRow: fillDrag.startRow,
        startCol: fillDrag.startCol,
        endRow: r,
        endCol: dataCol,
      });
    };

    const onMove = (e: PointerEvent) => {
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
      setActiveCell({ rowIndex: fillDrag.startRow, columnIndex: fillDrag.startCol + colOffsetRef.current });

      // Apply fill values
      const fillEvents = applyFillValues(norm, fillDrag.startRow, fillDrag.startCol, items, visibleCols, formulaOptionsRef.current);
      if (fillEvents.length > 0) {
        beginBatch?.();
        for (const evt of fillEvents) onCellValueChangedRef.current?.(evt);
        endBatch?.();
      }
      setFillDrag(null);
      liveFillRangeRef.current = null;
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    fillDrag,
    editable,
    items,
    visibleCols,
    setSelectionRange,
    setActiveCell,
    beginBatch,
    endBatch,
    colOffsetRef,
    wrapperRef,
    onCellValueChangedRef,
    formulaOptionsRef,
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

  const fillDown = useCallback(() => {
    const range = selectionRangeRef.current;
    if (!range || editable === false || !onCellValueChangedRef.current) return;
    const norm = normalizeSelectionRange(range);
    const fillEvents = applyFillValues(
      norm,
      norm.startRow,
      norm.startCol,
      itemsRef.current,
      visibleColsRef.current,
      formulaOptionsRef.current
    );
    if (fillEvents.length > 0) {
      beginBatch?.();
      for (const evt of fillEvents) onCellValueChangedRef.current(evt);
      endBatch?.();
    }
  }, [editable, beginBatch, endBatch, onCellValueChangedRef, itemsRef, visibleColsRef, formulaOptionsRef]);

  return { fillDrag, setFillDrag, handleFillHandleMouseDown, fillDown };
}
