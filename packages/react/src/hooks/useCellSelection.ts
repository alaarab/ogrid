import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeSelectionRange } from '../types';
import { rangesEqual, computeAutoScrollSpeed, buildCellIndex } from '../utils';
import { useLatestRef } from './useLatestRef';
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
  /** True while the user is drag-selecting cells (mousedown  to  mousemove  to  mouseup). */
  isDragging: boolean;
}

/** DOM attribute names used for drag-range highlighting (bypasses React). */
const DRAG_ATTR = 'data-drag-range';
const DRAG_ANCHOR_ATTR = 'data-drag-anchor';

/** Auto-scroll config */
const AUTO_SCROLL_EDGE = 40;   // px from wrapper edge to trigger
const AUTO_SCROLL_INTERVAL = 16; // ~60fps

/**
 * Manages cell selection range with drag-to-select and select-all support.
 * @param params - Row/col counts, active cell setter, and wrapper ref for auto-scroll.
 * @returns Selection range, setters, mouse/keyboard handlers, and drag state.
 */
export function useCellSelection(params: UseCellSelectionParams): UseCellSelectionResult {
  const { colOffset, rowCount, visibleColCount, setActiveCell, wrapperRef } = params;

  // Use ref for colOffset to prevent drag restart mid-drag when colOffset changes
  const colOffsetRef = useLatestRef(colOffset);

  const [selectionRange, _setSelectionRange] = useState<ISelectionRange | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  /** True once a pointermove has been seen during the current drag gesture. */
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const rafRef = useRef(0);
  /** Live drag range kept in a ref  -  only committed to React state on pointerup. */
  const liveDragRangeRef = useRef<ISelectionRange | null>(null);
  /** Auto-scroll interval during drag. */
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref mirror of selectionRange  -  lets handleCellMouseDown read current value
  // without adding selectionRange to its useCallback deps (keeps it stable).
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  // Deduplicating setter  -  skips re-render when the range hasn't actually changed.
  const setSelectionRange = useCallback((next: ISelectionRange | null) => {
    if (rangesEqual(selectionRangeRef.current, next)) return;
    _setSelectionRange(next);
  }, []);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      // Only handle primary (left) button  -  let middle-click scroll and right-click context menu work natively
      if (e.button !== 0) return;
      const colOff = colOffsetRef.current;
      if (globalColIndex < colOff) return;
      // Prevent native text selection during cell drag
      e.preventDefault();
      const dataColIndex = globalColIndex - colOff;
      const currentRange = selectionRangeRef.current;
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
        dragStartRef.current = { row: rowIndex, col: dataColIndex };
        dragMovedRef.current = false;
        const initial: ISelectionRange = {
          startRow: rowIndex,
          startCol: dataColIndex,
          endRow: rowIndex,
          endCol: dataColIndex,
        };
        setSelectionRange(initial);
        liveDragRangeRef.current = initial;
        setActiveCell({ rowIndex, columnIndex: globalColIndex });
        // Mark drag as "started" but don't set isDragging state yet  - 
        // setIsDragging(true) is deferred to the first mousemove to avoid
        // a true to false toggle on simple clicks (which causes 2 extra renders).
        isDraggingRef.current = true;
        // Apply drag attrs immediately for the initial cell so the anchor styling shows
        // even before the first mousemove. This ensures instant visual feedback.
        setTimeout(() => applyDragAttrsRef.current?.(initial), 0);
      }
    },
    [setActiveCell, colOffsetRef, setSelectionRange]
  );

  const handleSelectAllCells = useCallback(() => {
    if (rowCount === 0 || visibleColCount === 0) return;
    setSelectionRange({
      startRow: 0,
      startCol: 0,
      endRow: rowCount - 1,
      endCol: visibleColCount - 1,
    });
    setActiveCell({ rowIndex: 0, columnIndex: colOffsetRef.current });
  }, [rowCount, visibleColCount, setActiveCell, colOffsetRef, setSelectionRange]);

  /** Last known pointer position during drag  -  used by pointerUp to flush pending RAF work. */
  const lastMousePosRef = useRef<{ cx: number; cy: number } | null>(null);

  // Ref to expose applyDragAttrs outside useEffect so it can be called from pointerDown
  const applyDragAttrsRef = useRef<((range: ISelectionRange) => void) | null>(null);

  // Window pointer move/up for drag selection (supports mouse + touch via Pointer Events API).
  // Performance: during drag, we update a ref + toggle DOM attributes via rAF.
  // React state is only committed on pointerup (single re-render instead of 60-120/s).
  useEffect(() => {

    /** Set of currently drag-marked HTMLElements  -  avoids O(n) full DOM scan on each frame. */
    const markedCells = new Set<HTMLElement>();

    /** Cell lookup index built on drag start  -  O(1) lookups per frame instead of querySelectorAll. */
    let cellIndex: Map<string, HTMLElement> | null = null;

    /** Single overlay div for the drag-selection border (replaces per-cell box-shadows). */
    let overlayEl: HTMLDivElement | null = null;
    let overlayContainer: HTMLElement | null = null;

    /** Apply data attributes to a single in-range cell (background highlight). */
    const styleCellInRange = (
      el: HTMLElement, r: number, _c: number,
      _minR: number, _maxR: number, _minC: number, _maxC: number,
      anchor: { row: number; col: number } | null
    ) => {
      if (!el.hasAttribute(DRAG_ATTR)) el.setAttribute(DRAG_ATTR, '');
      const isAnchor = anchor && r === anchor.row && _c === anchor.col;
      if (isAnchor) {
        if (!el.hasAttribute(DRAG_ANCHOR_ATTR)) el.setAttribute(DRAG_ANCHOR_ATTR, '');
      } else {
        if (el.hasAttribute(DRAG_ANCHOR_ATTR)) el.removeAttribute(DRAG_ANCHOR_ATTR);
      }
      markedCells.add(el);
    };

    /** Remove drag styling from a single cell. */
    const unstyleCell = (el: HTMLElement) => {
      el.removeAttribute(DRAG_ATTR);
      el.removeAttribute(DRAG_ANCHOR_ATTR);
    };

    /** Position a single overlay div over the drag range for a continuous border. */
    const positionOverlay = (
      minR: number, maxR: number, minC: number, maxC: number, colOff: number
    ) => {
      const topLeftEl = cellIndex?.get(`${minR},${minC + colOff}`);
      const bottomRightEl = cellIndex?.get(`${maxR},${maxC + colOff}`);
      if (!topLeftEl || !bottomRightEl) return;

      // Measure from <td> parents for full cell coverage (no gaps at borders)
      const topLeftTd = topLeftEl.closest('td') as HTMLElement | null;
      const bottomRightTd = bottomRightEl.closest('td') as HTMLElement | null;
      if (!topLeftTd || !bottomRightTd) return;

      // Find positioned container (tableWidthAnchor) on first use
      if (!overlayContainer) {
        overlayContainer = topLeftEl.closest('table')?.parentElement as HTMLElement | null;
        if (!overlayContainer) return;
      }

      // Create overlay element on first use
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.style.position = 'absolute';
        overlayEl.style.border = '2px solid var(--ogrid-selection, #217346)';
        overlayEl.style.pointerEvents = 'none';
        overlayEl.style.zIndex = '4';
        overlayEl.style.boxSizing = 'border-box';
        overlayContainer.appendChild(overlayEl);
      }

      const cRect = overlayContainer.getBoundingClientRect();
      const tlRect = topLeftTd.getBoundingClientRect();
      const brRect = bottomRightTd.getBoundingClientRect();

      overlayEl.style.top = `${Math.round(tlRect.top - cRect.top)}px`;
      overlayEl.style.left = `${Math.round(tlRect.left - cRect.left)}px`;
      overlayEl.style.width = `${Math.round(brRect.right - tlRect.left)}px`;
      overlayEl.style.height = `${Math.round(brRect.bottom - tlRect.top)}px`;
      overlayEl.style.display = 'block';
    };

    const hideOverlay = () => {
      if (overlayEl) overlayEl.style.display = 'none';
    };

    const removeOverlay = () => {
      overlayEl?.remove();
      overlayEl = null;
      overlayContainer = null;
    };

    /** Toggle DRAG_ATTR on cells to show the range highlight via CSS.
     *  Uses a cell index Map for O(1) lookups per cell in the range instead of scanning all cells.
     *  Positions a single overlay div for a continuous green border around the selection range,
     *  and marks the anchor cell with DRAG_ANCHOR_ATTR (white background). */
    const applyDragAttrs = (range: ISelectionRange) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || !isDraggingRef.current) return;
      const minR = Math.min(range.startRow, range.endRow);
      const maxR = Math.max(range.startRow, range.endRow);
      const minC = Math.min(range.startCol, range.endCol);
      const maxC = Math.max(range.startCol, range.endCol);
      const anchor = dragStartRef.current;
      const colOff = colOffsetRef.current;

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
      if (!cellIndex) cellIndex = buildCellIndex(wrapperRef.current);

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
            cellIndex = buildCellIndex(wrapperRef.current);
            el = cellIndex?.get(key);
          }
          if (el && el.isConnected) {
            styleCellInRange(el, r, c, minR, maxR, minC, maxC, anchor);
          }
        }
      }

      // 3. Position a single overlay div for the continuous selection border
      positionOverlay(minR, maxR, minC, maxC, colOff);
    };

    // Expose applyDragAttrs via ref so mouseDown can access it
    applyDragAttrsRef.current = applyDragAttrs;

    /** Clear all drag styling using the tracked set  -  O(marked) not O(all cells). */
    const clearDragAttrs = () => {
      for (const el of markedCells) {
        unstyleCell(el);
      }
      markedCells.clear();
      cellIndex = null;
      hideOverlay();
    };

    /** Resolve pointer coordinates to a cell range (shared by RAF callback and pointerUp flush). */
    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      if (!dragStartRef.current) return null;
      const target = document.elementFromPoint(cx, cy);
      const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
      if (!cell) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      const colOff = colOffsetRef.current;
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

    /** Start or update auto-scroll interval based on pointer position relative to wrapper edges. */
    const updateAutoScroll = () => {
      const wrapper = wrapperRef.current;
      const pos = lastMousePosRef.current;
      if (!wrapper || !pos || !isDraggingRef.current) {
        stopAutoScroll();
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      let dx = 0;
      let dy = 0;

      if (pos.cy < rect.top + AUTO_SCROLL_EDGE) {
        dy = -computeAutoScrollSpeed(rect.top + AUTO_SCROLL_EDGE - pos.cy);
      } else if (pos.cy > rect.bottom - AUTO_SCROLL_EDGE) {
        dy = computeAutoScrollSpeed(pos.cy - (rect.bottom - AUTO_SCROLL_EDGE));
      }

      if (pos.cx < rect.left + AUTO_SCROLL_EDGE) {
        dx = -computeAutoScrollSpeed(rect.left + AUTO_SCROLL_EDGE - pos.cx);
      } else if (pos.cx > rect.right - AUTO_SCROLL_EDGE) {
        dx = computeAutoScrollSpeed(pos.cx - (rect.right - AUTO_SCROLL_EDGE));
      }

      if (dx === 0 && dy === 0) {
        stopAutoScroll();
        return;
      }

      // Start interval if not already running
      if (!autoScrollRef.current) {
        autoScrollRef.current = setInterval(() => {
          const w = wrapperRef.current;
          const p = lastMousePosRef.current;
          if (!w || !p || !isDraggingRef.current) { stopAutoScroll(); return; }

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

          // After scrolling, re-resolve the cell under the pointer and update drag range
          const newRange = resolveRange(p.cx, p.cy);
          if (newRange) {
            liveDragRangeRef.current = newRange;
            applyDragAttrs(newRange);
          }
        }, AUTO_SCROLL_INTERVAL);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      // Promote to a real drag on first pointermove (deferred from pointerDown
      // to avoid a true to false toggle on simple clicks).
      if (!dragMovedRef.current) {
        dragMovedRef.current = true;
        setIsDragging(true);
        // Build cell index once at drag start for O(1) lookups during drag
        cellIndex = buildCellIndex(wrapperRef.current);
      }

      // Always store latest position so pointerUp can flush if RAF hasn't executed
      lastMousePosRef.current = { cx: e.clientX, cy: e.clientY };

      // Update auto-scroll based on pointer proximity to edges
      updateAutoScroll();

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
        // DOM-only highlighting  -  no React state update until pointerup
        applyDragAttrs(newRange);
      });
    };

    const onUp = () => {
      if (!isDraggingRef.current) return;

      stopAutoScroll();

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      isDraggingRef.current = false;
      const wasDrag = dragMovedRef.current;

      if (wasDrag) {
        // Flush: if the last RAF hasn't executed yet, resolve the range now from the
        // last known pointer position so the final committed range is always accurate.
        const pos = lastMousePosRef.current;
        if (pos) {
          const flushed = resolveRange(pos.cx, pos.cy);
          if (flushed) liveDragRangeRef.current = flushed;
        }

        // Commit final range to React state (triggers a single re-render)
        const finalRange = liveDragRangeRef.current;
        if (finalRange) {
          setSelectionRange(finalRange);
          // Keep the active cell at the drag anchor (start), not the endpoint.
          // Excel behavior: the anchor cell stays white while the rest of the range is tinted.
          const anchor = dragStartRef.current;
          if (anchor) {
            setActiveCell({
              rowIndex: anchor.row,
              columnIndex: anchor.col + colOffsetRef.current,
            });
          }
        }
      }
      // For simple clicks (no drag movement), pointerDown already set
      // selectionRange + activeCell  -  skip redundant state updates.

      liveDragRangeRef.current = null;
      lastMousePosRef.current = null;
      dragStartRef.current = null;
      if (wasDrag) setIsDragging(false);

      // Defer DOM attr cleanup by one rAF so React's re-render (which paints the
      // CSS-module selection classes) happens before we remove the drag highlights.
      // Clearing synchronously leaves a frame where neither drag attrs nor React
      // classes are present — causing the "stutter" flash on the anchor cell.
      requestAnimationFrame(() => {
        clearDragAttrs();
      });
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopAutoScroll();
      removeOverlay();
    };
  }, [setActiveCell, colOffsetRef, setSelectionRange, wrapperRef]);

  return {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown,
    handleSelectAllCells,
    isDragging,
  };
}
