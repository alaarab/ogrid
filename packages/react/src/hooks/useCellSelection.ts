import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeSelectionRange } from '../types';
import { computeAutoScrollDelta, getSelectAllRange } from '@alaarab/ogrid-core';
import { rangesEqual } from '../utils';
import { createDragRangeMarker, dataCellAtPoint } from './dragRangeMarker';
import { useLatestRef } from './useLatestRef';
import type { ISelectionRange, IActiveCell } from '../types';

export interface UseCellSelectionParams {
  colOffset: number;
  rowCount: number;
  visibleColCount: number;
  setActiveCell: (cell: IActiveCell | null) => void;
  wrapperRef: React.RefObject<HTMLElement | null>;
  /**
   * Current active cell. Shift+click extends from it (the selection anchor) and
   * leaves it in place. Without it, Shift+click extends from the range's start.
   */
  activeCell?: IActiveCell | null;
  /** Grows every range the selection takes (e.g. to whole merged cells). */
  expandRange?: (range: ISelectionRange) => ISelectionRange;
}

export interface UseCellSelectionResult {
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  /** True while the user is drag-selecting cells (mousedown  to  mousemove  to  mouseup). */
  isDragging: boolean;
}

/** Auto-scroll config */
const AUTO_SCROLL_EDGE = 40;   // px from wrapper edge to trigger

/**
 * Manages cell selection range with drag-to-select and select-all support.
 * @param params - Row/col counts, active cell setter, and wrapper ref for auto-scroll.
 * @returns Selection range, setters, mouse/keyboard handlers, and drag state.
 */
export function useCellSelection(params: UseCellSelectionParams): UseCellSelectionResult {
  const { colOffset, rowCount, visibleColCount, setActiveCell, wrapperRef, activeCell } = params;

  // Use ref for colOffset to prevent drag restart mid-drag when colOffset changes
  const colOffsetRef = useLatestRef(colOffset);
  const activeCellRef = useLatestRef(activeCell);
  const expandRangeRef = useLatestRef(params.expandRange);

  const [selectionRange, _setSelectionRange] = useState<ISelectionRange | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  /** True once a pointermove has been seen during the current drag gesture. */
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const rafRef = useRef(0);
  /** Live drag range kept in a ref  -  only committed to React state on pointerup. */
  const liveDragRangeRef = useRef<ISelectionRange | null>(null);
  /** Auto-scroll rAF handle during drag. */
  const autoScrollRef = useRef<number | null>(null);

  // Ref mirror of selectionRange  -  lets handleCellMouseDown read current value
  // without adding selectionRange to its useCallback deps (keeps it stable).
  const selectionRangeRef = useRef(selectionRange);
  selectionRangeRef.current = selectionRange;

  // Deduplicating setter  -  skips re-render when the range hasn't actually changed.
  const setSelectionRange = useCallback((range: ISelectionRange | null) => {
    const expand = expandRangeRef.current;
    const next = range && expand ? expand(range) : range;
    if (rangesEqual(selectionRangeRef.current, next)) return;
    _setSelectionRange(next);
  }, [expandRangeRef]);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      // Only handle primary (left) button  -  let middle-click scroll and right-click context menu work natively
      if (e.button !== 0) return;
      // A custom cell widget marked with data-ogrid-allow-drag owns its pointer
      // press (native HTML5 drag), so it never starts a range selection.
      const dragSource = (e.target as Element | null)?.closest?.('[data-ogrid-allow-drag]');
      if (dragSource) return;
      const colOff = colOffsetRef.current;
      if (globalColIndex < colOff) return;
      // Prevent native text selection during cell drag
      e.preventDefault();
      const dataColIndex = globalColIndex - colOff;
      const currentRange = selectionRangeRef.current;
      if (e.shiftKey && currentRange != null) {
        // Extend from the anchor (the active cell), not the normalized range's
        // top-left corner, and keep the anchor active (Excel behavior).
        const anchor = activeCellRef.current;
        const hasAnchor = anchor != null && anchor.columnIndex >= colOff;
        setSelectionRange(
          normalizeSelectionRange({
            startRow: hasAnchor ? anchor.rowIndex : currentRange.startRow,
            startCol: hasAnchor ? anchor.columnIndex - colOff : currentRange.startCol,
            endRow: rowIndex,
            endCol: dataColIndex,
          })
        );
        if (!hasAnchor) setActiveCell({ rowIndex, columnIndex: globalColIndex });
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
        attachDragListenersRef.current?.();
        // Apply drag attrs synchronously so the anchor cell styling is in place
        // before React commits its re-render and before the next browser paint.
        // Using setTimeout here caused a 1-frame flicker: React would paint the
        // origin cell with a green outline (data-active-cell + data-in-range) before
        // the timeout fired and added data-drag-anchor (which suppresses the outline).
        applyDragAttrsRef.current?.(initial);
      }
    },
    [setActiveCell, colOffsetRef, activeCellRef, setSelectionRange]
  );

  const handleSelectAllCells = useCallback(() => {
    const all = getSelectAllRange(rowCount, visibleColCount);
    if (!all) return;
    setSelectionRange(all);
    setActiveCell({ rowIndex: 0, columnIndex: colOffsetRef.current });
  }, [rowCount, visibleColCount, setActiveCell, colOffsetRef, setSelectionRange]);

  /** Last known pointer position during drag  -  used by pointerUp to flush pending RAF work. */
  const lastMousePosRef = useRef<{ cx: number; cy: number } | null>(null);

  // Ref to expose applyDragAttrs outside useEffect so it can be called from pointerDown
  const applyDragAttrsRef = useRef<((range: ISelectionRange) => void) | null>(null);
  // Attaches the window drag listeners; called from pointerDown when a drag starts.
  const attachDragListenersRef = useRef<(() => void) | null>(null);

  // Window pointer move/up for drag selection (supports mouse + touch via Pointer Events API).
  // Performance: during drag, we update a ref + toggle DOM attributes via rAF.
  // React state is only committed on pointerup (single re-render instead of 60-120/s).
  useEffect(() => {

    /** Drag-range cell marking (shared with the fill handle's drag). */
    const marker = createDragRangeMarker(() => wrapperRef.current, () => colOffsetRef.current);

    /** Single overlay div for the drag-selection border (replaces per-cell box-shadows). */
    let overlayEl: HTMLDivElement | null = null;
    let overlayContainer: HTMLElement | null = null;

    /** Position a single overlay div over the drag range for a continuous border. */
    const positionOverlay = (minR: number, maxR: number, minC: number, maxC: number) => {
      const topLeftEl = marker.cellAt(minR, minC);
      const bottomRightEl = marker.cellAt(maxR, maxC);
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
        overlayEl.style.border = '2px solid var(--ogrid-selection, var(--ogrid-selection-color, #217346))';
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

    /** Show the range: mark its cells (the anchor cell stays white via CSS) and
     *  position a single overlay div for a continuous border around it. */
    const applyDragAttrs = (range: ISelectionRange) => {
      if (!wrapperRef.current || !isDraggingRef.current) return;
      marker.mark(range, dragStartRef.current);
      positionOverlay(
        Math.min(range.startRow, range.endRow),
        Math.max(range.startRow, range.endRow),
        Math.min(range.startCol, range.endCol),
        Math.max(range.startCol, range.endCol)
      );
    };

    // Expose applyDragAttrs via ref so mouseDown can access it
    applyDragAttrsRef.current = applyDragAttrs;

    /** Clear all drag styling. */
    const clearDragAttrs = () => {
      marker.clear();
      hideOverlay();
    };

    /** Resolve pointer coordinates to a cell range (shared by RAF callback and pointerUp flush). */
    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      if (!dragStartRef.current) return null;
      // Probe inside the visible body: while auto-scrolling, the pointer sits over
      // the sticky header (or outside the grid), where no cell would resolve.
      let px = cx;
      let py = cy;
      const wrapper = wrapperRef.current;
      const wr = wrapper?.getBoundingClientRect();
      if (wrapper && wr && wr.width > 0 && wr.height > 0) {
        const headerBottom = wrapper.querySelector('thead')?.getBoundingClientRect().bottom ?? wr.top;
        px = Math.min(Math.max(cx, wr.left + 1), wr.right - 1);
        py = Math.min(Math.max(cy, Math.max(wr.top, headerBottom) + 1), wr.bottom - 1);
      }
      const cell = dataCellAtPoint(wrapper, px, py, colOffsetRef.current);
      if (!cell) return null;
      const start = dragStartRef.current;
      const range = normalizeSelectionRange({
        startRow: start.row,
        startCol: start.col,
        endRow: cell.row,
        endCol: cell.col,
      });
      const expand = expandRangeRef.current;
      return expand ? expand(range) : range;
    };

    /** rAF-synced auto-scroll loop.  Reads layout once per frame, then writes. */
    const autoScrollLoop = () => {
      const w = wrapperRef.current;
      const p = lastMousePosRef.current;
      if (!w || !p || !isDraggingRef.current) { autoScrollRef.current = null; return; }

      // Layout read first, then writes
      const { dx, dy } = computeAutoScrollDelta(w.getBoundingClientRect(), p.cx, p.cy, AUTO_SCROLL_EDGE);
      if (dx === 0 && dy === 0) { autoScrollRef.current = null; return; }
      w.scrollTop += dy;
      w.scrollLeft += dx;

      // After scrolling, re-resolve the cell under the pointer and update drag range
      const newRange = resolveRange(p.cx, p.cy);
      if (newRange) {
        liveDragRangeRef.current = newRange;
        applyDragAttrs(newRange);
      }

      // Continue the loop, synced to the next paint frame
      autoScrollRef.current = requestAnimationFrame(autoScrollLoop);
    };

    /** Start or update rAF auto-scroll based on pointer position relative to wrapper edges. */
    const updateAutoScroll = () => {
      const wrapper = wrapperRef.current;
      const pos = lastMousePosRef.current;
      if (!wrapper || !pos || !isDraggingRef.current) {
        stopAutoScroll();
        return;
      }

      const { dx, dy } = computeAutoScrollDelta(wrapper.getBoundingClientRect(), pos.cx, pos.cy, AUTO_SCROLL_EDGE);

      if (dx === 0 && dy === 0) {
        stopAutoScroll();
        return;
      }

      // Start rAF loop if not already running
      if (!autoScrollRef.current) {
        autoScrollRef.current = requestAnimationFrame(autoScrollLoop);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
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
        marker.reindex();
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
      detachListeners();
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

    // Window listeners exist only for the duration of a drag (pointerDown to
    // pointerUp), so idle grids add no global per-pointermove work.
    let listening = false;
    function attachListeners() {
      if (listening) return;
      listening = true;
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      // A cancelled pointer (touch pan takeover) or a lost window never sends
      // pointerup; end the drag at the last range instead of staying stuck.
      window.addEventListener('pointercancel', onUp, true);
      window.addEventListener('blur', onUp);
    }
    function detachListeners() {
      if (!listening) return;
      listening = false;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('blur', onUp);
    }
    attachDragListenersRef.current = attachListeners;
    // Effect re-ran mid-drag: keep listening so the drag can still end.
    if (isDraggingRef.current) attachListeners();
    return () => {
      detachListeners();
      attachDragListenersRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopAutoScroll();
      removeOverlay();
    };
  }, [setActiveCell, colOffsetRef, setSelectionRange, wrapperRef, expandRangeRef]);

  return {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown,
    handleSelectAllCells,
    isDragging,
  };
}
