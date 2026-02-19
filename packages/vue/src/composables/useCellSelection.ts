import { shallowRef, ref, computed, onMounted, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange, rangesEqual, computeAutoScrollSpeed } from '@alaarab/ogrid-core';
import type { ISelectionRange, IActiveCell } from '../types';
import { useLatestRef } from './useLatestRef';

export interface UseCellSelectionParams {
  colOffset: number;
  rowCount: Ref<number>;
  visibleColCount: Ref<number>;
  setActiveCell: (cell: IActiveCell | null) => void;
  wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
}

export interface UseCellSelectionResult {
  selectionRange: ShallowRef<ISelectionRange | null>;
  setSelectionRange: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: MouseEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  isDragging: Ref<boolean>;
}

/** DOM attribute names used for drag-range highlighting (bypasses Vue). */
const DRAG_ATTR = 'data-drag-range';
const DRAG_ANCHOR_ATTR = 'data-drag-anchor';

/** Auto-scroll config */
const AUTO_SCROLL_EDGE = 40;
const AUTO_SCROLL_INTERVAL = 16;

/**
 * Manages cell selection range with drag-to-select and select-all support.
 */
export function useCellSelection(params: UseCellSelectionParams): UseCellSelectionResult {
  // Store latest params in a ref for stable handler references
  const paramsRef = useLatestRef(computed(() => params));
  const { colOffset, wrapperRef, setActiveCell } = params; // These are stable, safe to destructure

  const selectionRange = shallowRef<ISelectionRange | null>(null);
  const isDragging = ref(false);  // boolean primitive, ref is fine
  let isDraggingInternal = false;
  let dragMoved = false;
  let dragStart: { row: number; col: number } | null = null;
  let rafId = 0;
  let liveDragRange: ISelectionRange | null = null;
  let autoScrollInterval: ReturnType<typeof setInterval> | null = null;
  let lastMousePos: { cx: number; cy: number } | null = null;

  const setSelectionRange = (next: ISelectionRange | null) => {
    if (rangesEqual(selectionRange.value, next)) return;
    selectionRange.value = next;
  };

  const handleCellMouseDown = (e: MouseEvent, rowIndex: number, globalColIndex: number) => {
    if (e.button !== 0) return;
    if (globalColIndex < colOffset) return;
    e.preventDefault();
    const dataColIndex = globalColIndex - colOffset;
    const currentRange = selectionRange.value;
    if (e.shiftKey && currentRange != null) {
      setSelectionRange(
        normalizeSelectionRange({
          startRow: currentRange.startRow,
          startCol: currentRange.startCol,
          endRow: rowIndex,
          endCol: dataColIndex,
        })
      );
      setActiveCell({ rowIndex, columnIndex: globalColIndex });
    } else {
      dragStart = { row: rowIndex, col: dataColIndex };
      dragMoved = false;
      const initial: ISelectionRange = {
        startRow: rowIndex,
        startCol: dataColIndex,
        endRow: rowIndex,
        endCol: dataColIndex,
      };
      setSelectionRange(initial);
      liveDragRange = initial;
      setActiveCell({ rowIndex, columnIndex: globalColIndex });
      isDraggingInternal = true;
      // Apply drag attrs immediately for the initial cell so the anchor styling shows
      // even before the first mousemove. This ensures instant visual feedback.
      setTimeout(() => applyDragAttrs(initial), 0);
    }
  };

  const handleSelectAllCells = () => {
    const { rowCount, visibleColCount } = paramsRef.value;
    if (rowCount.value === 0 || visibleColCount.value === 0) return;
    setSelectionRange({
      startRow: 0,
      startCol: 0,
      endRow: rowCount.value - 1,
      endCol: visibleColCount.value - 1,
    });
    setActiveCell({ rowIndex: 0, columnIndex: colOffset });
  };

  // --- Window mouse move/up for drag selection ---

  /** Toggle DRAG_ATTR on cells to show the range highlight via CSS.
   *  Also sets edge box-shadows for a green border around the selection range,
   *  and marks the anchor cell with DRAG_ANCHOR_ATTR (white background). */
  const applyDragAttrs = (range: ISelectionRange) => {
    const wrapper = wrapperRef.value;
    if (!wrapper) return;
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    const anchor = dragStart;
    const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i] as HTMLElement;
      const r = parseInt(el.getAttribute('data-row-index')!, 10);
      const c = parseInt(el.getAttribute('data-col-index')!, 10) - colOffset;
      const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      if (inRange) {
        if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
        // Anchor cell gets white background instead of green
        const isAnchor = anchor && r === anchor.row && c === anchor.col;
        if (isAnchor) {
          if (!el.hasAttribute(DRAG_ANCHOR_ATTR)) el.setAttribute(DRAG_ANCHOR_ATTR, '');
        } else {
          if (el.hasAttribute(DRAG_ANCHOR_ATTR)) el.removeAttribute(DRAG_ANCHOR_ATTR);
        }
        // Edge borders via inset box-shadow (no layout shift)
        const shadows: string[] = [];
        if (r === minR) shadows.push('inset 0 2px 0 0 var(--ogrid-selection, #217346)');
        if (r === maxR) shadows.push('inset 0 -2px 0 0 var(--ogrid-selection, #217346)');
        if (c === minC) shadows.push('inset 2px 0 0 0 var(--ogrid-selection, #217346)');
        if (c === maxC) shadows.push('inset -2px 0 0 0 var(--ogrid-selection, #217346)');
        el.style.boxShadow = shadows.length > 0 ? shadows.join(', ') : '';
      } else {
        if (el.hasAttribute(DRAG_ATTR)) el.removeAttribute(DRAG_ATTR);
        if (el.hasAttribute(DRAG_ANCHOR_ATTR)) el.removeAttribute(DRAG_ANCHOR_ATTR);
        if (el.style.boxShadow) el.style.boxShadow = '';
      }
    }
  };

  const clearDragAttrs = () => {
    const wrapper = wrapperRef.value;
    if (!wrapper) return;
    const marked = wrapper.querySelectorAll(`[${DRAG_ATTR}]`);
    for (let i = 0; i < marked.length; i++) {
      const el = marked[i] as HTMLElement;
      el.removeAttribute(DRAG_ATTR);
      el.removeAttribute(DRAG_ANCHOR_ATTR);
      el.style.boxShadow = '';
    }
  };

  const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
    if (!dragStart) return null;
    const target = document.elementFromPoint(cx, cy);
    const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
    if (!cell) return null;
    const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
    const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
    if (Number.isNaN(r) || Number.isNaN(c) || c < colOffset) return null;
    const dataCol = c - colOffset;
    return normalizeSelectionRange({
      startRow: dragStart.row,
      startCol: dragStart.col,
      endRow: r,
      endCol: dataCol,
    });
  };

  const stopAutoScroll = () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  };

  const updateAutoScroll = () => {
    const wrapper = wrapperRef.value;
    if (!wrapper || !lastMousePos || !isDraggingInternal) {
      stopAutoScroll();
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    let dx = 0;
    let dy = 0;

    if (lastMousePos.cy < rect.top + AUTO_SCROLL_EDGE) {
      dy = -computeAutoScrollSpeed(rect.top + AUTO_SCROLL_EDGE - lastMousePos.cy);
    } else if (lastMousePos.cy > rect.bottom - AUTO_SCROLL_EDGE) {
      dy = computeAutoScrollSpeed(lastMousePos.cy - (rect.bottom - AUTO_SCROLL_EDGE));
    }

    if (lastMousePos.cx < rect.left + AUTO_SCROLL_EDGE) {
      dx = -computeAutoScrollSpeed(rect.left + AUTO_SCROLL_EDGE - lastMousePos.cx);
    } else if (lastMousePos.cx > rect.right - AUTO_SCROLL_EDGE) {
      dx = computeAutoScrollSpeed(lastMousePos.cx - (rect.right - AUTO_SCROLL_EDGE));
    }

    if (dx === 0 && dy === 0) {
      stopAutoScroll();
      return;
    }

    if (!autoScrollInterval) {
      autoScrollInterval = setInterval(() => {
        const w = wrapperRef.value;
        const p = lastMousePos;
        if (!w || !p || !isDraggingInternal) { stopAutoScroll(); return; }

        const r = w.getBoundingClientRect();
        let sdx = 0;
        let sdy = 0;
        if (p.cy < r.top + AUTO_SCROLL_EDGE) sdy = -computeAutoScrollSpeed(r.top + AUTO_SCROLL_EDGE - p.cy);
        else if (p.cy > r.bottom - AUTO_SCROLL_EDGE) sdy = computeAutoScrollSpeed(p.cy - (r.bottom - AUTO_SCROLL_EDGE));
        if (p.cx < r.left + AUTO_SCROLL_EDGE) sdx = -computeAutoScrollSpeed(r.left + AUTO_SCROLL_EDGE - p.cx);
        else if (p.cx > r.right - AUTO_SCROLL_EDGE) sdx = computeAutoScrollSpeed(p.cx - (r.right - AUTO_SCROLL_EDGE));

        if (sdx === 0 && sdy === 0) { stopAutoScroll(); return; }

        w.scrollTop += sdy;
        w.scrollLeft += sdx;

        const newRange = resolveRange(p.cx, p.cy);
        if (newRange) {
          liveDragRange = newRange;
          applyDragAttrs(newRange);
        }
      }, AUTO_SCROLL_INTERVAL);
    }
  };

  const onMove = (e: MouseEvent) => {
    if (!isDraggingInternal || !dragStart) return;

    if (!dragMoved) {
      dragMoved = true;
      isDragging.value = true;
    }

    lastMousePos = { cx: e.clientX, cy: e.clientY };
    updateAutoScroll();

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!lastMousePos) return;
      const newRange = resolveRange(lastMousePos.cx, lastMousePos.cy);
      if (!newRange) return;

      const prev = liveDragRange;
      if (
        prev &&
        prev.startRow === newRange.startRow &&
        prev.startCol === newRange.startCol &&
        prev.endRow === newRange.endRow &&
        prev.endCol === newRange.endCol
      ) {
        return;
      }

      liveDragRange = newRange;
      applyDragAttrs(newRange);
    });
  };

  const onUp = () => {
    if (!isDraggingInternal) return;

    stopAutoScroll();

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    isDraggingInternal = false;
    const wasDrag = dragMoved;

    if (wasDrag) {
      if (lastMousePos) {
        const flushed = resolveRange(lastMousePos.cx, lastMousePos.cy);
        if (flushed) liveDragRange = flushed;
      }

      const finalRange = liveDragRange;
      if (finalRange) {
        setSelectionRange(finalRange);
        setActiveCell({
          rowIndex: finalRange.endRow,
          columnIndex: finalRange.endCol + colOffset,
        });
      }
    }

    clearDragAttrs();
    liveDragRange = null;
    lastMousePos = null;
    dragStart = null;
    if (wasDrag) isDragging.value = false;
  };

  let isUnmounted = false;

  const onMoveSafe = (e: MouseEvent) => {
    if (isUnmounted) return;
    onMove(e);
  };

  const onUpSafe = () => {
    if (isUnmounted) return;
    onUp();
  };

  onMounted(() => {
    window.addEventListener('mousemove', onMoveSafe, true);
    window.addEventListener('mouseup', onUpSafe, true);
  });

  onUnmounted(() => {
    isUnmounted = true;
    window.removeEventListener('mousemove', onMoveSafe, true);
    window.removeEventListener('mouseup', onUpSafe, true);
    if (rafId) cancelAnimationFrame(rafId);
    stopAutoScroll();
  });

  return {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown,
    handleSelectAllCells,
    isDragging,
  };
}
