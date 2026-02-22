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
  /** True while the user is drag-selecting cells (mousedown → mousemove → mouseup). */
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
  /** True once a mousemove has been seen during the current drag gesture. */
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const rafRef = useRef(0);
  /** Live drag range kept in a ref — only committed to React state on mouseup. */
  const liveDragRangeRef = useRef<ISelectionRange | null>(null);
  /** Auto-scroll interval during drag. */
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref mirror of selectionRange — lets handleCellMouseDown read current value
  // without adding selectionRange to its useCallback deps (keeps it stable).
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  // Deduplicating setter — skips re-render when the range hasn't actually changed.
  const setSelectionRange = useCallback((next: ISelectionRange | null) => {
    if (rangesEqual(selectionRangeRef.current, next)) return;
    _setSelectionRange(next);
  }, []);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      // Only handle primary (left) button — let middle-click scroll and right-click context menu work natively
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
        // Mark drag as "started" but don't set isDragging state yet —
        // setIsDragging(true) is deferred to the first mousemove to avoid
        // a true→false toggle on simple clicks (which causes 2 extra renders).
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

  /** Last known mouse position during drag — used by mouseUp to flush pending RAF work. */
  const lastMousePosRef = useRef<{ cx: number; cy: number } | null>(null);

  // Ref to expose applyDragAttrs outside useEffect so it can be called from mouseDown
  const applyDragAttrsRef = useRef<((range: ISelectionRange) => void) | null>(null);

  // Window mouse move/up for drag selection.
  // Performance: during drag, we update a ref + toggle DOM attributes via rAF.
  // React state is only committed on mouseup (single re-render instead of 60-120/s).
  useEffect(() => {

    /** Set of currently drag-marked HTMLElements — avoids O(n) full DOM scan on each frame. */
    const markedCells = new Set<HTMLElement>();

    /** Cell lookup index built on drag start — O(1) lookups per frame instead of querySelectorAll. */
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
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
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

      // 2. Look up only the cells in the new range — O(range size) via Map lookup.
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = `${r},${c + colOff}`;
          let el = cellIndex?.get(key);
          // Handle virtual scroll recycling — if element is stale, rebuild index once
          if (el && !el.isConnected) {
            cellIndex = buildCellIndex(wrapperRef.current);
            el = cellIndex?.get(key);
          }
          if (el) {
            styleCellInRange(el, r, c, minR, maxR, minC, maxC, anchor);
          }
        }
      }
    };

    // Expose applyDragAttrs via ref so mouseDown can access it
    applyDragAttrsRef.current = applyDragAttrs;

    /** Clear all drag styling using the tracked set — O(marked) not O(all cells). */
    const clearDragAttrs = () => {
      for (const el of markedCells) {
        unstyleCell(el);
      }
      markedCells.clear();
      cellIndex = null;
    };

    /** Resolve mouse coordinates to a cell range (shared by RAF callback and mouseUp flush). */
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

    /** Start or update auto-scroll interval based on mouse position relative to wrapper edges. */
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

          // After scrolling, re-resolve the cell under the mouse and update drag range
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

    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      // Promote to a real drag on first mousemove (deferred from mouseDown
      // to avoid a true→false toggle on simple clicks).
      if (!dragMovedRef.current) {
        dragMovedRef.current = true;
        setIsDragging(true);
        // Build cell index once at drag start for O(1) lookups during drag
        cellIndex = buildCellIndex(wrapperRef.current);
      }

      // Always store latest position so mouseUp can flush if RAF hasn't executed
      lastMousePosRef.current = { cx: e.clientX, cy: e.clientY };

      // Update auto-scroll based on mouse proximity to edges
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
        // DOM-only highlighting — no React state update until mouseup
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
            columnIndex: finalRange.endCol + colOffsetRef.current,
          });
        }
      }
      // For simple clicks (no drag movement), mouseDown already set
      // selectionRange + activeCell — skip redundant state updates.

      // Clean up DOM attributes — React will apply CSS-module classes on the same paint
      clearDragAttrs();
      liveDragRangeRef.current = null;
      lastMousePosRef.current = null;
      dragStartRef.current = null;
      if (wasDrag) setIsDragging(false);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopAutoScroll();
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
