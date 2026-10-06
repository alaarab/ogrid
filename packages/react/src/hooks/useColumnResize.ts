import { useCallback, useEffect, useRef } from 'react';
import { measureColumnContentWidth, ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_MIN_WIDTH } from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';
import { useLatestRef } from './useLatestRef';

/** Width change per Arrow key press on a focused resize handle (px). */
export const KEYBOARD_RESIZE_STEP = 10;
/** Width change per Shift+Arrow key press on a focused resize handle (px). */
export const KEYBOARD_RESIZE_FINE_STEP = 1;

export interface UseColumnResizeParams {
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  minWidth?: number;
  defaultWidth?: number;
  /** Called when a column resize completes (mouseup, or each keyboard step). */
  onColumnResized?: (columnId: string, width: number) => void;
}

export interface UseColumnResizeResult<T> {
  handleResizeStart: (e: React.MouseEvent | React.PointerEvent, col: IColumnDef<T>) => void;
  handleResizeDoubleClick: (e: React.MouseEvent, col: IColumnDef<T>) => void;
  /** Focus handler for the resize handle: remembers the width Escape restores. */
  handleResizeFocus: (e: React.FocusEvent, col: IColumnDef<T>) => void;
  /** Keyboard handler for the focused resize handle (Arrow / Home / Enter / Escape). */
  handleResizeKeyDown: (e: React.KeyboardEvent, col: IColumnDef<T>) => void;
  getColumnWidth: (col: IColumnDef<T>) => number;
  /** The smallest width a resize (pointer or keyboard) lets the column reach. */
  getColumnMinWidth: (col: IColumnDef<T>) => number;
}

/**
 * Manages column resize interactions: pointer drags with RAF-throttled state
 * updates, double-click autosize, and keyboard resizing on the focused handle.
 * @param params - Sizing overrides, setter, min/default widths, and resize callback.
 * @returns Resize handlers and column width getters.
 */
export function useColumnResize<T>({
  columnSizingOverrides,
  setColumnSizingOverrides,
  minWidth = 80,
  defaultWidth = 120,
  onColumnResized,
}: UseColumnResizeParams): UseColumnResizeResult<T> {
  const rafRef = useRef(0);
  const onColumnResizedRef = useRef(onColumnResized);
  onColumnResizedRef.current = onColumnResized;
  const columnSizingOverridesRef = useLatestRef(columnSizingOverrides);
  // Width the focused handle's column had when focus arrived; Escape restores it.
  const focusStartRef = useRef<{ columnId: string; width: number } | null>(null);

  // Track active drag listeners so we can clean up on unmount
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const getColumnMinWidth = useCallback((col: IColumnDef<T>) => {
    return col.columnId === ROW_NUMBER_COLUMN_ID ? ROW_NUMBER_COLUMN_MIN_WIDTH : (col.minWidth ?? minWidth);
  }, [minWidth]);

  const getConfiguredWidth = useCallback((col: IColumnDef<T>) => {
    return columnSizingOverridesRef.current[col.columnId]?.widthPx
      ?? col.idealWidth
      ?? col.defaultWidth
      ?? defaultWidth;
  }, [columnSizingOverridesRef, defaultWidth]);

  /**
   * Lock every column to its current DOM width the first time one is resized, and set
   * the resized column to `width`. With table-layout:auto, resizing one column lets the
   * browser compress the others; snapshotting pins them so only the target changes.
   */
  const lockColumnWidths = useCallback((thEl: HTMLElement | null, columnId: string, width: number) => {
    const allThs = thEl?.closest('thead')?.querySelectorAll<HTMLElement>('th[data-column-id]');
    setColumnSizingOverrides((prev) => {
      const next = { ...prev };
      allThs?.forEach((th) => {
        const colId = th.dataset.columnId;
        if (colId && !next[colId]) {
          next[colId] = { widthPx: th.getBoundingClientRect().width };
        }
      });
      next[columnId] = { widthPx: width };
      return next;
    });
  }, [setColumnSizingOverrides]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.PointerEvent, col: IColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();

    // Clean up any in-progress drag before starting a new one
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const startX = e.clientX;
    const columnId = col.columnId;

    // Measure the actual rendered width from the DOM. With table-layout: auto,
    // the browser may have auto-sized the column wider than the config values.
    // The resize handle is a direct child of <th>, so parentElement is the header cell.
    // Use closest('th') instead of parentElement to handle frameworks (e.g. Fluent UI)
    // that wrap header cell children in an internal <button> element.
    const thEl = (e.currentTarget as HTMLElement).closest('th');
    const startWidth = thEl
      ? thEl.getBoundingClientRect().width
      : getConfiguredWidth(col);
    let latestWidth = startWidth;

    if (thEl?.closest('thead')) {
      lockColumnWidths(thEl, columnId, startWidth);
    }

    // Lock cursor and prevent text selection during drag
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const flushWidth = () => {
      setColumnSizingOverrides((prev) => ({
        ...prev,
        [columnId]: { widthPx: latestWidth },
      }));
    };

    const effectiveMinWidth = getColumnMinWidth(col);

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      latestWidth = Math.max(effectiveMinWidth, startWidth + deltaX);

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          flushWidth();
        });
      }
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      cleanupRef.current = null;

      // Restore cursor and user-select
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;

      // Cancel pending RAF and flush final width synchronously
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    const onUp = () => {
      cleanup();
      flushWidth();

      // Remove any rogue :focus-visible outlines that appeared during the drag.
      // Re-focus the grid wrapper so keyboard navigation still works.
      const wrapper = thEl?.closest('[tabindex]') as HTMLElement | null;
      if (wrapper) {
        wrapper.focus({ preventScroll: true });
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      if (onColumnResizedRef.current) {
        onColumnResizedRef.current(columnId, latestWidth);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    // A cancelled pointer (touch pan takeover) or a lost window never sends
    // pointerup; finish the resize at the last width instead of staying stuck.
    document.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    cleanupRef.current = cleanup;
  }, [getColumnMinWidth, getConfiguredWidth, lockColumnWidths, setColumnSizingOverrides]);

  const handleResizeDoubleClick = useCallback((e: React.MouseEvent, col: IColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();
    const columnId = col.columnId;
    const thEl = (e.currentTarget as HTMLElement).closest('th');
    const container = thEl?.closest('table')?.parentElement ?? undefined;
    const idealWidth = measureColumnContentWidth(columnId, col.minWidth ?? minWidth, container);
    setColumnSizingOverrides((prev) => ({
      ...prev,
      [columnId]: { widthPx: idealWidth },
    }));
    if (onColumnResizedRef.current) {
      onColumnResizedRef.current(columnId, idealWidth);
    }
  }, [minWidth, setColumnSizingOverrides]);

  // Width the keyboard path starts from: an override is the rendered width (it's the
  // inline style), otherwise the rendered width when there is a layout, else the config.
  const getCurrentWidth = useCallback((thEl: HTMLElement | null, col: IColumnDef<T>) => {
    const override = columnSizingOverridesRef.current[col.columnId]?.widthPx;
    if (override != null) return override;
    const measured = thEl?.getBoundingClientRect().width ?? 0;
    return measured > 0 ? measured : getConfiguredWidth(col);
  }, [columnSizingOverridesRef, getConfiguredWidth]);

  const handleResizeFocus = useCallback((e: React.FocusEvent, col: IColumnDef<T>) => {
    const thEl = (e.currentTarget as HTMLElement).closest('th');
    focusStartRef.current = { columnId: col.columnId, width: getCurrentWidth(thEl, col) };
  }, [getCurrentWidth]);

  const handleResizeKeyDown = useCallback((e: React.KeyboardEvent, col: IColumnDef<T>) => {
    const handle = e.currentTarget as HTMLElement;
    const thEl = handle.closest('th');
    const columnId = col.columnId;
    const effectiveMinWidth = getColumnMinWidth(col);
    const currentWidth = getCurrentWidth(thEl, col);

    // Same state path as a pointer resize: lock the other columns on the first change,
    // write the override, and report the new width so column state/persistence follow.
    const commitWidth = (width: number) => {
      const next = Math.max(effectiveMinWidth, Math.round(width));
      if (next === currentWidth) return;
      lockColumnWidths(thEl, columnId, next);
      onColumnResizedRef.current?.(columnId, next);
    };

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const step = e.shiftKey ? KEYBOARD_RESIZE_FINE_STEP : KEYBOARD_RESIZE_STEP;
        commitWidth(currentWidth + (e.key === 'ArrowRight' ? step : -step));
        break;
      }
      case 'Home':
        commitWidth(effectiveMinWidth);
        break;
      case 'Enter': {
        // Commit: the width is already applied, so just hand focus back to the grid.
        const wrapper = thEl?.closest('[tabindex]') as HTMLElement | null;
        if (wrapper) wrapper.focus({ preventScroll: true });
        else handle.blur();
        break;
      }
      case 'Escape': {
        const start = focusStartRef.current;
        if (start && start.columnId === columnId) commitWidth(start.width);
        break;
      }
      default:
        return;
    }
    // Handled: keep the grid's own keyboard navigation (and page scroll) out of it.
    e.preventDefault();
    e.stopPropagation();
  }, [getColumnMinWidth, getCurrentWidth, lockColumnWidths]);

  const getColumnWidth = useCallback((col: IColumnDef<T>) => {
    return columnSizingOverrides[col.columnId]?.widthPx
      ?? col.idealWidth
      ?? col.defaultWidth
      ?? defaultWidth;
  }, [columnSizingOverrides, defaultWidth]);

  return { handleResizeStart, handleResizeDoubleClick, handleResizeFocus, handleResizeKeyDown, getColumnWidth, getColumnMinWidth };
}
