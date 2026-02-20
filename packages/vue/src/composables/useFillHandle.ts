import { shallowRef, watch, isRef, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange, applyFillValues } from '@alaarab/ogrid-core';
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
  colOffset: Ref<number> | number;
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
    wrapperRef,
    beginBatch,
    endBatch,
    visibleRange,
  } = params;
  const getColOffset = () => isRef(params.colOffset) ? params.colOffset.value : params.colOffset;

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

  watch(fillDrag, (drag, _oldDrag, onCleanup) => {
    // Guard early before setting up any state
    if (!drag || editable.value === false || !onCellValueChanged.value || !wrapperRef.value) {
      // Still cleanup if transitioning from active to inactive
      cleanup();
      return;
    }

    fillDragEnd = { endRow: drag.startRow, endCol: drag.startCol };
    liveFillRange = null;

    /** Set of currently drag-marked HTMLElements — avoids O(n) full DOM scan on clear. */
    const markedCells = new Set<Element>();

    /** Cell lookup index built on drag start — O(1) lookups per frame. */
    let fillCellIndex: Map<string, HTMLElement> | null = null;

    const buildFillCellIndex = () => {
      const wrapper = wrapperRef.value;
      if (!wrapper) return;
      fillCellIndex = new Map<string, HTMLElement>();
      const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
      for (let i = 0; i < cells.length; i++) {
        const el = cells[i] as HTMLElement;
        const r = el.getAttribute('data-row-index') ?? '';
        const c = el.getAttribute('data-col-index') ?? '';
        fillCellIndex.set(`${r},${c}`, el);
      }
    };

    // Build the index once at fill drag start
    buildFillCellIndex();

    const applyDragAttrs = (range: ISelectionRange) => {
      const wrapper = wrapperRef.value;
      if (!wrapper) return;
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);
      const colOff = getColOffset();

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
          let el = fillCellIndex?.get(key);
          // Handle virtual scroll recycling — if element is stale, rebuild index once
          if (el && !el.isConnected) {
            buildFillCellIndex();
            el = fillCellIndex?.get(key);
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
      fillCellIndex = null;
    };

    let lastFillMousePos: { cx: number; cy: number } | null = null;

    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      if (!cell || !wrapperRef.value?.contains(cell)) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      const colOffset = getColOffset();
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
      setActiveCell({ rowIndex: end.endRow, columnIndex: end.endCol + getColOffset() });

      const currentItems = items.value;
      const currentCols = visibleCols.value;
      const callback = onCellValueChanged.value;
      if (callback) {
        const fillEvents = applyFillValues(norm, drag.startRow, drag.startCol, currentItems, currentCols);
        if (fillEvents.length > 0) {
          beginBatch?.();
          for (const evt of fillEvents) callback(evt);
          endBatch?.();
        }
      }
      fillDrag.value = null;
      liveFillRange = null;
      cleanup();
    };

    window.addEventListener('mousemove', moveListener, true);
    window.addEventListener('mouseup', upListener, true);

    // Register cleanup via onCleanup — Vue calls this BEFORE next watch run
    // and on unmount. Compatible with Vue 3.3+ (unlike return-value cleanup
    // which requires Vue 3.5+).
    onCleanup(() => {
      cleanup();
    });
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
