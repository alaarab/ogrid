import { shallowRef, ref, isRef, onMounted, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange, rangesEqual, computeAutoScrollSpeed, buildCellIndex } from '@alaarab/ogrid-core';
import type { ISelectionRange, IActiveCell } from '../types';
import { useLatestRef } from './useLatestRef';

export interface UseCellSelectionParams {
  colOffset: Ref<number> | number;
  rowCount: Ref<number>;
  visibleColCount: Ref<number>;
  setActiveCell: (cell: IActiveCell | null) => void;
  wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
}

export interface UseCellSelectionResult {
  selectionRange: ShallowRef<ISelectionRange | null>;
  setSelectionRange: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: PointerEvent, rowIndex: number, globalColIndex: number) => void;
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
  const paramsRef = useLatestRef(params);
  const { wrapperRef, setActiveCell } = params; // These are stable, safe to destructure
  const getColOffset = () => isRef(params.colOffset) ? params.colOffset.value : params.colOffset;

  const selectionRange = shallowRef<ISelectionRange | null>(null);
  const isDragging = ref(false);  // boolean primitive, ref is fine
  const isDraggingInternal = ref(false); // ref so event handlers always read current value
  const isUnmounted = ref(false); // ref for clean unmount tracking
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

  const handleCellMouseDown = (e: PointerEvent, rowIndex: number, globalColIndex: number) => {
    if (e.button !== 0) return;
    const colOffset = getColOffset();
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
      isDraggingInternal.value = true;
      // Apply drag attrs synchronously so the anchor cell styling is in place
      // before Vue commits its re-render and before the next browser paint.
      // Using setTimeout here caused a 1-frame flicker: Vue would paint the
      // origin cell with a green tint (data-in-range) before the timeout fired
      // and added data-drag-anchor (which overrides it with white background).
      applyDragAttrs(initial);
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
    setActiveCell({ rowIndex: 0, columnIndex: getColOffset() });
  };

  // --- Window mouse move/up for drag selection ---

  /** Set of currently drag-marked HTMLElements  -  avoids O(n) full DOM scan on each frame. */
  const markedCells = new Set<HTMLElement>();

  /** Cell lookup index built on drag start  -  O(1) lookups per frame instead of querySelectorAll. */
  let cellIndex: Map<string, HTMLElement> | null = null;

  /** Apply styling to a single in-range cell (attrs + box-shadow). */
  const styleCellInRange = (
    el: HTMLElement, r: number, c: number,
    minR: number, maxR: number, minC: number, maxC: number,
    anchor: { row: number; col: number } | null
  ) => {
    if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
    const isAnchor = anchor && r === anchor.row && c === anchor.col;
    if (isAnchor) {
      if (!el.hasAttribute(DRAG_ANCHOR_ATTR)) el.setAttribute(DRAG_ANCHOR_ATTR, '');
    } else {
      if (el.hasAttribute(DRAG_ANCHOR_ATTR)) el.removeAttribute(DRAG_ANCHOR_ATTR);
    }
    const shadows: string[] = [];
    if (r === minR) shadows.push('inset 0 2px 0 0 var(--ogrid-selection, #217346)');
    if (r === maxR) shadows.push('inset 0 -2px 0 0 var(--ogrid-selection, #217346)');
    if (c === minC) shadows.push('inset 2px 0 0 0 var(--ogrid-selection, #217346)');
    if (c === maxC) shadows.push('inset -2px 0 0 0 var(--ogrid-selection, #217346)');
    el.style.boxShadow = shadows.length > 0 ? shadows.join(', ') : '';
    markedCells.add(el);
  };

  /** Remove drag styling from a single cell. */
  const unstyleCell = (el: HTMLElement) => {
    el.removeAttribute(DRAG_ATTR);
    el.removeAttribute(DRAG_ANCHOR_ATTR);
    el.style.boxShadow = '';
  };

  /** Toggle DRAG_ATTR on cells to show the range highlight via CSS.
   *  Uses a cell index Map for O(1) lookups per cell in the range instead of scanning all cells.
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
    const colOff = getColOffset();

    // 1. Un-mark cells that are no longer in the new range (iterate the small set, not all DOM)
    for (const el of markedCells) {
      const r = parseInt(el.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(el.getAttribute('data-col-index') ?? '', 10) - colOff;
      const stillInRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      if (!stillInRange) {
        unstyleCell(el);
        markedCells.delete(el);
      }
    }

    // Build index on first call if not yet initialized
    if (!cellIndex) cellIndex = buildCellIndex(wrapperRef.value);

    // 2. Look up only the cells in the new range  -  O(range size) via Map lookup.
    //    If a stale (disconnected) element is found, rebuild the index once per
    //    applyDragAttrs call and retry  -  avoids per-cell rebuilds during fast scrolling.
    let rebuilt = false;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r},${c + colOff}`;
        let el = cellIndex?.get(key);
        if (el && !el.isConnected && !rebuilt) {
          rebuilt = true;
          cellIndex = buildCellIndex(wrapperRef.value);
          el = cellIndex?.get(key);
        }
        if (el && el.isConnected) {
          styleCellInRange(el, r, c, minR, maxR, minC, maxC, anchor);
        }
      }
    }
  };

  /** Clear all drag styling using the tracked set  -  O(marked) not O(all cells). */
  const clearDragAttrs = () => {
    for (const el of markedCells) {
      unstyleCell(el);
    }
    markedCells.clear();
    cellIndex = null;
  };

  const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
    if (!dragStart) return null;
    const target = document.elementFromPoint(cx, cy);
    const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
    if (!cell) return null;
    const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
    const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
    const colOffset = getColOffset();
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
    if (!wrapper || !lastMousePos || !isDraggingInternal.value) {
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
        if (!w || !p || !isDraggingInternal.value) { stopAutoScroll(); return; }

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

  const onMove = (e: PointerEvent) => {
    if (!isDraggingInternal.value || !dragStart) return;

    if (!dragMoved) {
      dragMoved = true;
      isDragging.value = true;
      // Build cell index once at drag start for O(1) lookups during drag
      cellIndex = buildCellIndex(wrapperRef.value);
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
    if (!isDraggingInternal.value) return;

    stopAutoScroll();

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    isDraggingInternal.value = false;
    const wasDrag = dragMoved;

    if (wasDrag) {
      if (lastMousePos) {
        const flushed = resolveRange(lastMousePos.cx, lastMousePos.cy);
        if (flushed) liveDragRange = flushed;
      }

      const finalRange = liveDragRange;
      if (finalRange) {
        setSelectionRange(finalRange);
        // Keep the active cell at the drag anchor (start), not the endpoint.
        const anchor = dragStart;
        if (anchor) {
          setActiveCell({
            rowIndex: anchor.row,
            columnIndex: anchor.col + getColOffset(),
          });
        }
      }
    }

    clearDragAttrs();
    liveDragRange = null;
    lastMousePos = null;
    dragStart = null;
    if (wasDrag) isDragging.value = false;
  };

  const onMoveSafe = (e: PointerEvent) => {
    if (isUnmounted.value) return;
    onMove(e);
  };

  const onUpSafe = () => {
    if (isUnmounted.value) return;
    onUp();
  };

  onMounted(() => {
    window.addEventListener('pointermove', onMoveSafe, true);
    window.addEventListener('pointerup', onUpSafe, true);
  });

  onUnmounted(() => {
    isUnmounted.value = true;
    window.removeEventListener('pointermove', onMoveSafe, true);
    window.removeEventListener('pointerup', onUpSafe, true);
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
