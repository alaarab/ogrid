import { shallowRef, ref, computed, onMounted, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell } from '../types';
import { useLatestRef } from './useLatestRef';

/** Compares two selection ranges by value. */
function rangesEqual(a: ISelectionRange | null, b: ISelectionRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.startRow === b.startRow && a.endRow === b.endRow &&
         a.startCol === b.startCol && a.endCol === b.endCol;
}

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

/** DOM attribute name used for drag-range highlighting (bypasses Vue). */
const DRAG_ATTR = 'data-drag-range';

/** Auto-scroll config */
const AUTO_SCROLL_EDGE = 40;
const AUTO_SCROLL_MIN_SPEED = 2;
const AUTO_SCROLL_MAX_SPEED = 20;
const AUTO_SCROLL_INTERVAL = 16;

function autoScrollSpeed(distance: number): number {
  const t = Math.min(distance / AUTO_SCROLL_EDGE, 1);
  return AUTO_SCROLL_MIN_SPEED + t * (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED);
}

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
      dy = -autoScrollSpeed(rect.top + AUTO_SCROLL_EDGE - lastMousePos.cy);
    } else if (lastMousePos.cy > rect.bottom - AUTO_SCROLL_EDGE) {
      dy = autoScrollSpeed(lastMousePos.cy - (rect.bottom - AUTO_SCROLL_EDGE));
    }

    if (lastMousePos.cx < rect.left + AUTO_SCROLL_EDGE) {
      dx = -autoScrollSpeed(rect.left + AUTO_SCROLL_EDGE - lastMousePos.cx);
    } else if (lastMousePos.cx > rect.right - AUTO_SCROLL_EDGE) {
      dx = autoScrollSpeed(lastMousePos.cx - (rect.right - AUTO_SCROLL_EDGE));
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
        if (p.cy < r.top + AUTO_SCROLL_EDGE) sdy = -autoScrollSpeed(r.top + AUTO_SCROLL_EDGE - p.cy);
        else if (p.cy > r.bottom - AUTO_SCROLL_EDGE) sdy = autoScrollSpeed(p.cy - (r.bottom - AUTO_SCROLL_EDGE));
        if (p.cx < r.left + AUTO_SCROLL_EDGE) sdx = -autoScrollSpeed(r.left + AUTO_SCROLL_EDGE - p.cx);
        else if (p.cx > r.right - AUTO_SCROLL_EDGE) sdx = autoScrollSpeed(p.cx - (r.right - AUTO_SCROLL_EDGE));

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

  onMounted(() => {
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
  });

  onUnmounted(() => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mouseup', onUp, true);
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
