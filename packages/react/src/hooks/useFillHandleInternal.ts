import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import { applyFillValues, buildCellIndex, cellIndexKey, computeFillRange } from '../utils';
import { computeFillDragEdits } from '@alaarab/ogrid-core';
import type { IFillFormulaOptions } from '../utils';
import { useLatestRef } from './useLatestRef';

export interface UseFillHandleInternalParams<T> {
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

export interface UseFillHandleInternalResult {
  /** Top-left of the source selection; `endRow`/`endCol` (bottom-right) are set when the source is a multi-cell range. */
  fillDrag: { startRow: number; startCol: number; endRow?: number; endCol?: number } | null;
  setFillDrag: (value: { startRow: number; startCol: number; endRow?: number; endCol?: number } | null) => void;
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;
  /** Fill the current selection down from the top row (Ctrl+D). No-op if no selection or editable=false. */
  fillDown: () => void;
}

/** DOM attribute name for fill-drag range highlighting (same as cell selection drag). */
const DRAG_ATTR = 'data-drag-range';

/**
 * Manages Excel-style fill handle drag-to-fill for cell ranges.
 *
 * While dragging, the fill range is the source selection extended along one
 * axis only, the one the pointer is farther outside the block on (rows vs
 * columns); a pointer inside the block fills nothing. See `computeFillRange`.
 * @param params - Items, columns, selection range, editability, and value change callback.
 * @returns Fill drag state, setter, and mousedown handler for the fill handle.
 */
export function useFillHandleInternal<T>(params: UseFillHandleInternalParams<T>): UseFillHandleInternalResult {
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
  const [fillDrag, setFillDrag] = useState<{ startRow: number; startCol: number; endRow?: number; endCol?: number } | null>(null);
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

    /** Set of currently drag-marked HTMLElements  -  avoids O(n) full DOM scan on clear. */
    const markedCells = new Set<Element>();

    /** Cell lookup index built on drag start  -  O(1) lookups per frame. */
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

      // Look up only cells in the new range  -  O(range size) via Map lookup
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = cellIndexKey(r, c + colOff);
          let el = cellIndex?.get(key);
          // Handle virtual scroll recycling  -  if element is stale, rebuild index once
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

    // The original selection is the source block; the fill extends it along
    // one axis only (Excel): see computeFillRange.
    const source: ISelectionRange = {
      startRow: fillDrag.startRow,
      startCol: fillDrag.startCol,
      endRow: fillDrag.endRow ?? fillDrag.startRow,
      endCol: fillDrag.endCol ?? fillDrag.startCol,
    };
    let moved = false;

    // Returns the normalized fill range plus the raw cell under the pointer:
    // the drag end must be the raw cell, or dragging up/left (where the
    // normalized end is the source itself) collapses the fill to nothing.
    const resolveRange = (cx: number, cy: number): { range: ISelectionRange; endRow: number; endCol: number } | null => {
      const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      if (!cell || !wrapperRef.current?.contains(cell)) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOffsetRef.current) return null;
      const dataCol = c - colOffsetRef.current;
      return { range: computeFillRange(source, r, dataCol), endRow: r, endCol: dataCol };
    };

    const onMove = (e: PointerEvent) => {
      lastFillMousePos = { cx: e.clientX, cy: e.clientY };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (!lastFillMousePos) return;
        const resolved = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (!resolved) return;
        const newRange = resolved.range;

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

        moved = true;
        liveFillRangeRef.current = newRange;
        fillDragEndRef.current = { endRow: resolved.endRow, endCol: resolved.endCol };
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
          moved = true;
          liveFillRangeRef.current = flushed.range;
          fillDragEndRef.current = { endRow: flushed.endRow, endCol: flushed.endCol };
        }
      }

      clearDragAttrs();

      // A click without movement leaves the selection untouched (no collapse to the top-left cell).
      if (!moved) {
        setFillDrag(null);
        liveFillRangeRef.current = null;
        return;
      }

      const end = fillDragEndRef.current;

      // Commit range to React state
      setSelectionRange(computeFillRange(source, end.endRow, end.endCol));
      setActiveCell({ rowIndex: fillDrag.startRow, columnIndex: fillDrag.startCol + colOffsetRef.current });

      // Tile the original selection over the extension (the commit the headless
      // useFillHandle shares). The batch also covers formulas the fill writes,
      // so one undo reverts the whole fill.
      beginBatch?.();
      try {
        const { events } = computeFillDragEdits(source, end.endRow, end.endCol, itemsRef.current, visibleColsRef.current, formulaOptionsRef.current);
        for (const evt of events) onCellValueChangedRef.current?.(evt);
      } finally {
        // Always close the batch, or a throwing handler leaves undo stuck.
        endBatch?.();
      }
      setFillDrag(null);
      liveFillRangeRef.current = null;
    };

    // Pointer cancelled (touch pan takeover) or window lost: abandon the fill
    // without writing anything.
    const onCancel = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      clearDragAttrs();
      setFillDrag(null);
      liveFillRangeRef.current = null;
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('blur', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('blur', onCancel);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    fillDrag,
    editable,
    itemsRef,
    visibleColsRef,
    setSelectionRange,
    setActiveCell,
    beginBatch,
    endBatch,
    colOffsetRef,
    wrapperRef,
    onCellValueChangedRef,
    formulaOptionsRef,
  ]);

  // Ref mirror  -  keeps handleFillHandleMouseDown stable across selection changes
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  const handleFillHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.button > 0) return; // only the primary button starts a fill
      const range = selectionRangeRef.current;
      if (!range) return;
      const norm = normalizeSelectionRange(range);
      const multi = norm.endRow !== norm.startRow || norm.endCol !== norm.startCol;
      setFillDrag(
        multi
          ? { startRow: norm.startRow, startCol: norm.startCol, endRow: norm.endRow, endCol: norm.endCol }
          : { startRow: norm.startRow, startCol: norm.startCol }
      );
    },
    []
  );

  const fillDown = useCallback(() => {
    const range = selectionRangeRef.current;
    if (!range || editable === false || !onCellValueChangedRef.current) return;
    const norm = normalizeSelectionRange(range);
    // Ctrl+D copies each column's top cell down that column. The batch also
    // covers formulas the fill writes, so one undo reverts the whole fill.
    beginBatch?.();
    try {
      const fillEvents = applyFillValues(
        norm,
        norm.startRow,
        norm.startCol,
        itemsRef.current,
        visibleColsRef.current,
        formulaOptionsRef.current,
        { ...norm, endRow: norm.startRow }
      );
      for (const evt of fillEvents) onCellValueChangedRef.current(evt);
    } finally {
      endBatch?.();
    }
  }, [editable, beginBatch, endBatch, onCellValueChangedRef, itemsRef, visibleColsRef, formulaOptionsRef]);

  return { fillDrag, setFillDrag, handleFillHandleMouseDown, fillDown };
}
