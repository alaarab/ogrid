import { shallowRef, watch, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange, getCellValue, parseValue } from '@alaarab/ogrid-core';
import type { ISelectionRange, IActiveCell, IColumnDef, ICellValueChangedEvent } from '../types';
import type { IVisibleRange } from '@alaarab/ogrid-core';

export interface UseFillHandleParams<T> {
  items: Ref<T[]>;
  visibleCols: Ref<IColumnDef<T>[]>;
  editable: Ref<boolean | undefined>;
  onCellValueChanged: Ref<((event: ICellValueChangedEvent<T>) => void) | undefined>;
  selectionRange: Ref<ISelectionRange | null> | ShallowRef<ISelectionRange | null>;
  setSelectionRange: (range: ISelectionRange | null) => void;
  setActiveCell: (cell: IActiveCell | null) => void;
  colOffset: number;
  wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
  beginBatch?: () => void;
  endBatch?: () => void;
  visibleRange?: Ref<IVisibleRange | null>;
}

export interface UseFillHandleResult {
  fillDrag: ShallowRef<{ startRow: number; startCol: number } | null>;
  setFillDrag: (value: { startRow: number; startCol: number } | null) => void;
  handleFillHandleMouseDown: (e: MouseEvent) => void;
}

const DRAG_ATTR = 'data-drag-range';

/**
 * Manages Excel-style fill handle drag-to-fill for cell ranges.
 */
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
    visibleRange,
  } = params;

  const fillDrag = shallowRef<{ startRow: number; startCol: number } | null>(null);
  let fillDragEnd = { endRow: 0, endCol: 0 };
  let rafId = 0;
  let liveFillRange: ISelectionRange | null = null;
  let moveListener: ((e: MouseEvent) => void) | null = null;
  let upListener: (() => void) | null = null;

  const setFillDrag = (value: { startRow: number; startCol: number } | null) => {
    fillDrag.value = value;
  };

  const cleanup = () => {
    if (moveListener) {
      window.removeEventListener('mousemove', moveListener, true);
      moveListener = null;
    }
    if (upListener) {
      window.removeEventListener('mouseup', upListener, true);
      upListener = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  watch(fillDrag, (drag) => {
    // Guard early before setting up any state
    if (!drag || editable.value === false || !onCellValueChanged.value || !wrapperRef.value) {
      // Still cleanup if transitioning from active to inactive
      cleanup();
      return;
    }

    fillDragEnd = { endRow: drag.startRow, endCol: drag.startCol };
    liveFillRange = null;

    const applyDragAttrs = (range: ISelectionRange) => {
      const wrapper = wrapperRef.value;
      if (!wrapper) return;
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);
      const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
      for (let i = 0; i < cells.length; i++) {
        const el = cells[i];
        const r = parseInt(el.getAttribute('data-row-index')!, 10);
        const c = parseInt(el.getAttribute('data-col-index')!, 10) - colOffset;
        const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
        if (inRange) {
          if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
        } else {
          if (el.hasAttribute(DRAG_ATTR)) el.removeAttribute(DRAG_ATTR);
        }
      }
    };

    const clearDragAttrs = () => {
      const wrapper = wrapperRef.value;
      if (!wrapper) return;
      const marked = wrapper.querySelectorAll(`[${DRAG_ATTR}]`);
      for (let i = 0; i < marked.length; i++) marked[i].removeAttribute(DRAG_ATTR);
    };

    let lastFillMousePos: { cx: number; cy: number } | null = null;

    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      if (!cell || !wrapperRef.value?.contains(cell)) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOffset) return null;
      const dataCol = c - colOffset;
      return normalizeSelectionRange({
        startRow: drag.startRow,
        startCol: drag.startCol,
        endRow: r,
        endCol: dataCol,
      });
    };

    moveListener = (e: MouseEvent) => {
      lastFillMousePos = { cx: e.clientX, cy: e.clientY };
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!lastFillMousePos) return;
        const newRange = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (!newRange) return;

        const prev = liveFillRange;
        if (prev && prev.startRow === newRange.startRow && prev.startCol === newRange.startCol && prev.endRow === newRange.endRow && prev.endCol === newRange.endCol) return;

        liveFillRange = newRange;
        fillDragEnd = { endRow: newRange.endRow, endCol: newRange.endCol };
        applyDragAttrs(newRange);
      });
    };

    upListener = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }

      if (lastFillMousePos) {
        const flushed = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (flushed) {
          liveFillRange = flushed;
          fillDragEnd = { endRow: flushed.endRow, endCol: flushed.endCol };
        }
      }

      clearDragAttrs();

      const end = fillDragEnd;
      const norm = normalizeSelectionRange({
        startRow: drag.startRow,
        startCol: drag.startCol,
        endRow: end.endRow,
        endCol: end.endCol,
      });

      // Clamp fill range to visible + overscan when virtual scrolling is active
      const vr = visibleRange?.value;
      if (vr) {
        norm.startRow = Math.max(norm.startRow, vr.startIndex);
        norm.endRow = Math.min(norm.endRow, vr.endIndex);
      }

      setSelectionRange(norm);
      setActiveCell({ rowIndex: end.endRow, columnIndex: end.endCol + colOffset });

      const currentItems = items.value;
      const currentCols = visibleCols.value;
      const callback = onCellValueChanged.value;
      const startItem = currentItems[norm.startRow];
      const startColDef = currentCols[norm.startCol];
      if (startItem && startColDef && callback) {
        const startValue = getCellValue(startItem as T, startColDef);
        beginBatch?.();
        for (let row = norm.startRow; row <= norm.endRow; row++) {
          for (let col = norm.startCol; col <= norm.endCol; col++) {
            if (row === drag.startRow && col === drag.startCol) continue;
            if (row >= currentItems.length || col >= currentCols.length) continue;
            const item = currentItems[row];
            const colDef = currentCols[col];
            const colEditable =
              colDef.editable === true ||
              (typeof colDef.editable === 'function' && colDef.editable(item));
            if (!colEditable) continue;
            const oldValue = getCellValue(item, colDef);
            const result = parseValue(startValue, oldValue, item, colDef);
            if (!result.valid) continue;
            callback({ item, columnId: colDef.columnId, oldValue, newValue: result.value, rowIndex: row });
          }
        }
        endBatch?.();
      }
      fillDrag.value = null;
      liveFillRange = null;
      cleanup();
    };

    window.addEventListener('mousemove', moveListener, true);
    window.addEventListener('mouseup', upListener, true);

    // Return cleanup function - Vue will call this BEFORE next watch run
    return () => {
      cleanup();
    };
  });

  onUnmounted(() => cleanup());

  const handleFillHandleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const range = selectionRange.value;
    if (!range) return;
    fillDrag.value = { startRow: range.startRow, startCol: range.startCol };
  };

  return { fillDrag, setFillDrag, handleFillHandleMouseDown };
}
