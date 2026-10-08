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
 *   // On the focusable grid container. Ctrl/Cmd+C, X and V are left to the
 *   // browser: the native `copy` / `cut` / `paste` events that follow carry
 *   // the clipboard data, so they work without the clipboard permissions (and
 *   // secure context) `copyRange()` / `cutRange()` / `pasteRange()` need.
 *   <div
 *     tabIndex={0}
 *     onCopy={clipboard.onCopy}
 *     onCut={clipboard.onCut}
 *     onPaste={clipboard.onPaste}
 *   >
 */

import { useCallback, useEffect, useState } from 'react';
import {
  normalizeSelectionRange,
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  captureCutSource,
  resolveCutClear,
  tilePastedRows,
  formatTsvAsHtmlTable,
} from '@alaarab/ogrid-core';
import type {
  ISelectionRange,
  ICellValueChangedEvent,
  RowId,
} from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';
import type { UseRangeSelectionResult } from './useRangeSelection';
import { useLatestRef } from './useLatestRef';
import { getPastedText, TEXT_ENTRY_SELECTOR, useClipboardMarks } from './useClipboardMarks';

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

/** What `onCopy` and `onCut` use from a native or React `ClipboardEvent`. */
export type CellClipboardCopyEvent = {
  clipboardData: Pick<DataTransfer, 'setData'> | null;
  preventDefault: () => void;
  target?: EventTarget | null;
  currentTarget?: EventTarget | null;
};

export interface UseCellClipboardResult {
  /**
   * Copy the current range to the OS clipboard as TSV through
   * `clipboard.writeText` (a toolbar button or context menu). No-op if no range.
   *
   * For the keyboard shortcut, attach `onCopy` to the container instead.
   */
  copyRange: () => Promise<void>;
  /**
   * Mark the current range as cut. Range stays visible (marching ants) until
   * paste or `clearClipboard()`. Cleared cells are emptied at paste time.
   *
   * For the keyboard shortcut, attach `onCut` to the container instead.
   */
  cutRange: () => Promise<void>;
  /**
   * Native `copy` event handler for the grid container (`onCopy={clipboard.onCopy}`).
   * Puts the range's TSV on `event.clipboardData` (no permission prompt, works
   * on plain http), calls `preventDefault()` and marks the copy range like
   * `copyRange`. Ignored when the event targets an input, textarea or
   * contenteditable inside the container, so cell editors keep their own copy,
   * and when there is no range. Do not also call `copyRange()` on Ctrl/Cmd+C.
   */
  onCopy: (event: CellClipboardCopyEvent) => void;
  /** Native `cut` event handler (`onCut={clipboard.onCut}`). Like `onCopy`, but marks the range as cut like `cutRange`. */
  onCut: (event: CellClipboardCopyEvent) => void;
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

/** True when a clipboard event is aimed at a text input inside the container (a cell editor). */
function isTextEntryTarget(event: { target?: EventTarget | null; currentTarget?: EventTarget | null }): boolean {
  const target = event.target as Element | null | undefined;
  return (
    target != null &&
    target !== event.currentTarget &&
    typeof target.matches === 'function' &&
    target.matches(TEXT_ENTRY_SELECTOR)
  );
}

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
 * round-trippable through Excel and Google Sheets. Keyboard copy/cut/paste
 * should go through `onCopy` / `onCut` / `onPaste` (the native events), which
 * need no clipboard permission; `copyRange()` / `cutRange()` / `pasteRange()`
 * are the programmatic paths for buttons and menus.
 */
export function useCellClipboard<T>(
  params: UseCellClipboardParams<T>,
): UseCellClipboardResult {
  const { rangeSelection, rows, columns, onCellEdit, clipboard = DEFAULT_CLIPBOARD, onClipboardError, getRowId } = params;
  const onClipboardErrorRef = useLatestRef(onClipboardError);

  // Copy/cut marks and the pending cut, shared with <OGrid>'s useClipboard.
  const { cutRange: activeCutRange, copyRange: activeCopyRange, markCopied, markCut: markCutSource, takePendingCut, clearMarks: clearClipboard } = useClipboardMarks();

  // Detected after mount: computing it during render would differ between
  // server (false) and client (true) and break hydration.
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => {
    setCanPaste(typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText));
  }, []);

  const rowKeyOf = useCallback((item: T): unknown => (getRowId ? getRowId(item) : item), [getRowId]);

  // The cut source by identity (row ids or objects, column ids) plus the text it put on
  // the clipboard, so a re-sort/page change or a later external copy can't make
  // paste clear the wrong cells.
  const markCut = useCallback((range: ISelectionRange, text: string) => {
    markCutSource(range, captureCutSource(range, rows, columns, rowKeyOf, text));
  }, [rows, columns, rowKeyOf, markCutSource]);

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
    markCopied(range);
  }, [rangeSelection.range, rows, columns, clipboard, onClipboardErrorRef, markCopied]);

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
    markCut(range, text);
  }, [rangeSelection.range, rows, columns, clipboard, onClipboardErrorRef, markCut]);

  const onCopy = useCallback((event: CellClipboardCopyEvent) => {
    const range = rangeSelection.range;
    if (!range || isTextEntryTarget(event) || !event.clipboardData) return;
    const text = formatSelectionAsTsv(rows, columns, range);
    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('text/html', formatTsvAsHtmlTable(text));
    event.preventDefault();
    markCopied(range);
  }, [rangeSelection.range, rows, columns, markCopied]);

  const onCut = useCallback((event: CellClipboardCopyEvent) => {
    const range = rangeSelection.range;
    if (!range || isTextEntryTarget(event) || !event.clipboardData) return;
    const text = formatSelectionAsTsv(rows, columns, range);
    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('text/html', formatTsvAsHtmlTable(text));
    event.preventDefault();
    markCut(range, text);
  }, [rangeSelection.range, rows, columns, markCut]);

  /** Apply clipboard text at the range anchor and complete the pending cut. */
  const pasteText = useCallback((text: string) => {
    const range = rangeSelection.range;
    if (!range) return;
    const parsed = parseTsvClipboard(text);
    if (parsed.length === 0) return;

    // Anchor at the top-left even for ranges selected upward/leftward.
    const anchor = normalizeSelectionRange(range);
    const cut = takePendingCut();
    // A copied block repeats over a selection that is an exact multiple of it
    // (Excel); a cut moves its block once.
    const block = cut ? parsed : tilePastedRows(parsed, anchor);
    const events = applyPastedValues(block, anchor.startRow, anchor.startCol, rows, columns);
    const cutEvents = cut
      ? resolveCutClear({ cut, text, pasteEvents: events, anchorRow: anchor.startRow, anchorCol: anchor.startCol, items: rows, visibleCols: columns, rowKeyOf })
      : [];
    const combined = cutEvents.length > 0 ? [...events, ...cutEvents] : events;
    if (combined.length > 0) onCellEdit(combined);
  }, [rangeSelection.range, rows, columns, onCellEdit, rowKeyOf, takePendingCut]);

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
    if (!rangeSelection.range || isTextEntryTarget(event)) return;
    const text = getPastedText(event.clipboardData);
    if (!text.trim()) return;
    event.preventDefault();
    pasteText(text);
  }, [rangeSelection.range, pasteText]);

  return {
    copyRange,
    cutRange,
    pasteRange,
    onCopy,
    onCut,
    onPaste,
    canPaste,
    activeCutRange,
    activeCopyRange,
    clearClipboard,
  };
}
