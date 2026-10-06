/**
 * useCellClipboard — headless copy/cut/paste for OGrid ranges.
 *
 * Pairs with `useRangeSelection`. Copies the active range to the OS
 * clipboard as TSV (Excel/Sheets compatible), supports cut + paste with
 * marching-ants tracking, and runs paste values through each column's
 * `valueParser` for validation. The consumer's `onCellEdit` receives one
 * event per accepted paste cell.
 *
 * Example:
 *
 *   const range = useRangeSelection({ rowCount, colCount });
 *   const clipboard = useCellClipboard({
 *     rangeSelection: range,
 *     rows: grid.rows,
 *     columns: grid.columns,
 *     onCellEdit: (events) => events.forEach(applyOneEdit),
 *   });
 *
 *   // On the focusable grid container. Ctrl/Cmd+V is left to the browser: the
 *   // native `paste` event that follows carries the text, and `onPaste` reads
 *   // it without the clipboard-read permission `pasteRange()` needs.
 *   <div
 *     tabIndex={0}
 *     onPaste={clipboard.onPaste}
 *     onKeyDown={(e) => {
 *       const mod = e.metaKey || e.ctrlKey;
 *       if (mod && e.key === 'c') clipboard.copyRange();
 *       if (mod && e.key === 'x') clipboard.cutRange();
 *     }}
 *   >
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizeSelectionRange,
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  applyCutClear,
} from '@alaarab/ogrid-core';
import type {
  ISelectionRange,
  ICellValueChangedEvent,
  RowId,
} from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';
import type { UseRangeSelectionResult } from './useRangeSelection';
import { useLatestRef } from './useLatestRef';

export interface UseCellClipboardParams<T> {
  /** Current range selection. Copy/cut/paste targets resolve from here. */
  rangeSelection: UseRangeSelectionResult;
  /** Rows currently rendered (post-filter, post-page). */
  rows: T[];
  /** Stable row identity for a pending cut across row replacements or sorting. */
  getRowId?: (item: T) => RowId;
  /** Visible columns. */
  columns: IColumnDef<T>[];
  /**
   * Called with cell-change events when a paste or cut commits. Apply each
   * event to your data store.
   */
  onCellEdit: (events: ICellValueChangedEvent<T>[]) => void;
  /**
   * Override the clipboard read/write target. Defaults to `navigator.clipboard`.
   * Useful for testing.
   */
  clipboard?: {
    readText: () => Promise<string>;
    writeText: (text: string) => Promise<void>;
  };
  /**
   * Called when the clipboard read/write fails (e.g. permission denied).
   * Copy/cut/paste resolve instead of rejecting either way.
   */
  onClipboardError?: (error: unknown) => void;
}

/** What `onPaste` reads from a native or React `ClipboardEvent`. */
export type CellClipboardPasteEvent = {
  clipboardData: Pick<DataTransfer, 'getData'> | null;
  preventDefault: () => void;
  target?: EventTarget | null;
  currentTarget?: EventTarget | null;
};

export interface UseCellClipboardResult {
  /** Copy the current range to the OS clipboard as TSV. No-op if no range. */
  copyRange: () => Promise<void>;
  /**
   * Mark the current range as cut. Range stays visible (marching ants) until
   * paste or `clearClipboard()`. Cleared cells are emptied at paste time.
   */
  cutRange: () => Promise<void>;
  /**
   * Paste the OS clipboard (TSV) at the current range's anchor cell, reading
   * it programmatically through `clipboard.readText` (a toolbar button or
   * context menu). Validates each cell via `valueParser`. If a cut range was
   * active and paste lands elsewhere, the cut range is cleared.
   *
   * For the keyboard shortcut, attach `onPaste` to the container instead.
   */
  pasteRange: () => Promise<void>;
  /**
   * Native `paste` event handler for the grid container (`onPaste={clipboard.onPaste}`).
   * Reads `event.clipboardData` (no permission prompt, works on plain http and
   * in Firefox/Safari where `readText` is denied), calls `preventDefault()` and
   * applies the same paste as `pasteRange`. Ignored when the event targets an
   * input, textarea or contenteditable inside the container, so cell editors
   * keep their own paste, and when the event carries no text or there is no
   * range. Do not also call `pasteRange()` on Ctrl/Cmd+V: that pastes twice.
   */
  onPaste: (event: CellClipboardPasteEvent) => void;
  /**
   * True if `pasteRange()` can read the OS clipboard programmatically
   * (`navigator.clipboard.readText` exists). Gate paste buttons and menu
   * items on it; `onPaste` works regardless.
   * Always false on the server and during the first client render, so
   * server-rendered markup hydrates without a mismatch.
   */
  canPaste: boolean;
  /** Currently-marked cut range, or null. Render with marching ants for UI feedback. */
  activeCutRange: ISelectionRange | null;
  /** Currently-marked copy range, or null. */
  activeCopyRange: ISelectionRange | null;
  /** Clear cut/copy markers without committing. Bind to Escape. */
  clearClipboard: () => void;
}

/** Text-entry controls whose own paste must not be hijacked by the grid. */
const TEXT_ENTRY_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable=""], [contenteditable="true"]';

const DEFAULT_CLIPBOARD = {
  readText: () =>
    typeof navigator !== 'undefined' && navigator.clipboard?.readText
      ? navigator.clipboard.readText()
      : Promise.resolve(''),
  writeText: (text: string) =>
    typeof navigator !== 'undefined' && navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text)
      : Promise.resolve(),
};

/**
 * Headless copy/cut/paste hook for cell ranges.
 *
 * Honors `clipboardFormatter` on column for copy and `valueParser` on column
 * for paste. Reads/writes navigator.clipboard with TSV format so the data is
 * round-trippable through Excel and Google Sheets. Keyboard paste should go
 * through `onPaste` (the native event), which needs no clipboard-read
 * permission; `pasteRange()` is the programmatic path for buttons and menus.
 */
export function useCellClipboard<T>(
  params: UseCellClipboardParams<T>,
): UseCellClipboardResult {
  const { rangeSelection, rows, columns, onCellEdit, clipboard = DEFAULT_CLIPBOARD, onClipboardError, getRowId } = params;
  const onClipboardErrorRef = useLatestRef(onClipboardError);

  const [activeCutRange, setActiveCutRange] = useState<ISelectionRange | null>(null);
  const [activeCopyRange, setActiveCopyRange] = useState<ISelectionRange | null>(null);
  // The cut source by identity (row ids or objects, column ids) plus the text it put on
  // the clipboard, so a re-sort/page change or a later external copy can't make
  // paste clear the wrong cells.
  const cutSourceRef = useRef<{ rowKeys: unknown[]; columnIds: string[]; text: string } | null>(null);

  // Detected after mount: computing it during render would differ between
  // server (false) and client (true) and break hydration.
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => {
    setCanPaste(typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText));
  }, []);

  const copyRange = useCallback(async () => {
    const range = rangeSelection.range;
    if (!range) return;
    const text = formatSelectionAsTsv(rows, columns, range);
    try {
      await clipboard.writeText(text);
    } catch (err) {
      onClipboardErrorRef.current?.(err);
      return;
    }
    setActiveCopyRange(range);
    setActiveCutRange(null);
    cutSourceRef.current = null;
  }, [rangeSelection.range, rows, columns, clipboard, onClipboardErrorRef]);

  const cutRange = useCallback(async () => {
    const range = rangeSelection.range;
    if (!range) return;
    const text = formatSelectionAsTsv(rows, columns, range);
    try {
      await clipboard.writeText(text);
    } catch (err) {
      onClipboardErrorRef.current?.(err);
      return;
    }
    const norm = normalizeSelectionRange(range);
    cutSourceRef.current = {
      rowKeys: rows.slice(norm.startRow, norm.endRow + 1).map((item) => getRowId ? getRowId(item) : item),
      columnIds: columns.slice(norm.startCol, norm.endCol + 1).map((c) => c.columnId),
      text,
    };
    setActiveCutRange(range);
    setActiveCopyRange(null);
  }, [rangeSelection.range, rows, columns, clipboard, onClipboardErrorRef, getRowId]);

  /** Apply clipboard text at the range anchor and clear the pending cut. */
  const pasteText = useCallback((text: string) => {
    const range = rangeSelection.range;
    if (!range) return;
    const parsed = parseTsvClipboard(text);
    if (parsed.length === 0) return;

    // Anchor at the top-left even for ranges selected upward/leftward.
    const anchor = normalizeSelectionRange(range);
    const events = applyPastedValues(
      parsed,
      anchor.startRow,
      anchor.startCol,
      rows,
      columns,
    );

    // Clear only cut cells whose corresponding destination accepted the paste.
    let combined = events;
    const cutSource = cutSourceRef.current;
    cutSourceRef.current = null;
    const norm = (s: string) => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (cutSource && norm(text) === norm(cutSource.text)) {
      const cutClearEvents: ICellValueChangedEvent<T>[] = [];
      const pastedKeys = new Set(events.map((e) => `${e.rowIndex}|${e.columnId}`));
      const rowIndexByKey = new Map<unknown, number>();
      rows.forEach((item, i) => { rowIndexByKey.set(getRowId ? getRowId(item) : item, i); });
      for (const [sourceRow, key] of cutSource.rowKeys.entries()) {
        const r = rowIndexByKey.get(key);
        if (r === undefined) continue;
        for (const [sourceCol, columnId] of cutSource.columnIds.entries()) {
          const targetColumn = columns[anchor.startCol + sourceCol];
          if (!targetColumn || !pastedKeys.has(`${anchor.startRow + sourceRow}|${targetColumn.columnId}`)) continue;
          const c = columns.findIndex((col) => col.columnId === columnId);
          if (c < 0) continue;
          cutClearEvents.push(...applyCutClear({ startRow: r, endRow: r, startCol: c, endCol: c }, rows, columns));
        }
      }
      // Skip cells that paste already overwrote (cut + paste over the same cell = paste wins).
      const filtered = cutClearEvents.filter(
        (e) => !pastedKeys.has(`${e.rowIndex}|${e.columnId}`),
      );
      combined = [...events, ...filtered];
    }

    if (combined.length > 0) onCellEdit(combined);
    setActiveCutRange(null);
    setActiveCopyRange(null);
  }, [rangeSelection.range, rows, columns, onCellEdit, getRowId]);

  const pasteRange = useCallback(async () => {
    if (!rangeSelection.range) return;
    let text: string;
    try {
      text = await clipboard.readText();
    } catch (err) {
      onClipboardErrorRef.current?.(err);
      return;
    }
    pasteText(text);
  }, [rangeSelection.range, clipboard, onClipboardErrorRef, pasteText]);

  const onPaste = useCallback((event: CellClipboardPasteEvent) => {
    if (!rangeSelection.range) return;
    const target = event.target as Element | null | undefined;
    if (
      target != null &&
      target !== event.currentTarget &&
      typeof target.matches === 'function' &&
      target.matches(TEXT_ENTRY_SELECTOR)
    ) {
      return;
    }
    const data = event.clipboardData;
    const text = data?.getData('text/plain') || data?.getData('text') || '';
    if (!text.trim()) return;
    event.preventDefault();
    pasteText(text);
  }, [rangeSelection.range, pasteText]);

  const clearClipboard = useCallback(() => {
    cutSourceRef.current = null;
    setActiveCutRange(null);
    setActiveCopyRange(null);
  }, []);

  return {
    copyRange,
    cutRange,
    pasteRange,
    onPaste,
    canPaste,
    activeCutRange,
    activeCopyRange,
    clearClipboard,
  };
}
