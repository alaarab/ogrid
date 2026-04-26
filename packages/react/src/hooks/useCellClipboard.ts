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
 *   useEffect(() => {
 *     const handler = (e: KeyboardEvent) => {
 *       const mod = e.metaKey || e.ctrlKey;
 *       if (mod && e.key === 'c') clipboard.copyRange();
 *       if (mod && e.key === 'x') clipboard.cutRange();
 *       if (mod && e.key === 'v') clipboard.pasteRange();
 *     };
 *     document.addEventListener('keydown', handler);
 *     return () => document.removeEventListener('keydown', handler);
 *   });
 */

import { useCallback, useState } from 'react';
import {
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  applyCutClear,
} from '@alaarab/ogrid-core';
import type {
  IColumnDef as ICoreColumnDef,
  ISelectionRange,
  ICellValueChangedEvent,
} from '@alaarab/ogrid-core';
import type { UseRangeSelectionResult } from './useRangeSelection';

export interface UseCellClipboardParams<T> {
  /** Current range selection. Copy/cut/paste targets resolve from here. */
  rangeSelection: UseRangeSelectionResult;
  /** Rows currently rendered (post-filter, post-page). */
  rows: T[];
  /** Visible columns. */
  columns: ICoreColumnDef<T>[];
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
}

export interface UseCellClipboardResult {
  /** Copy the current range to the OS clipboard as TSV. No-op if no range. */
  copyRange: () => Promise<void>;
  /**
   * Mark the current range as cut. Range stays visible (marching ants) until
   * paste or `clearClipboard()`. Cleared cells are emptied at paste time.
   */
  cutRange: () => Promise<void>;
  /**
   * Paste the OS clipboard (TSV) at the current range's anchor cell.
   * Validates each cell via `valueParser`. If a cut range was active and
   * paste lands elsewhere, the cut range is cleared.
   */
  pasteRange: () => Promise<void>;
  /** True if the OS clipboard supports paste (basic feature detection). */
  canPaste: boolean;
  /** Currently-marked cut range, or null. Render with marching ants for UI feedback. */
  activeCutRange: ISelectionRange | null;
  /** Currently-marked copy range, or null. */
  activeCopyRange: ISelectionRange | null;
  /** Clear cut/copy markers without committing. Bind to Escape. */
  clearClipboard: () => void;
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
 * round-trippable through Excel and Google Sheets.
 */
export function useCellClipboard<T>(
  params: UseCellClipboardParams<T>,
): UseCellClipboardResult {
  const { rangeSelection, rows, columns, onCellEdit, clipboard = DEFAULT_CLIPBOARD } = params;

  const [activeCutRange, setActiveCutRange] = useState<ISelectionRange | null>(null);
  const [activeCopyRange, setActiveCopyRange] = useState<ISelectionRange | null>(null);

  const canPaste =
    typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText);

  const copyRange = useCallback(async () => {
    const range = rangeSelection.range;
    if (!range) return;
    const text = formatSelectionAsTsv(rows, columns, range);
    await clipboard.writeText(text);
    setActiveCopyRange(range);
    setActiveCutRange(null);
  }, [rangeSelection.range, rows, columns, clipboard]);

  const cutRange = useCallback(async () => {
    const range = rangeSelection.range;
    if (!range) return;
    const text = formatSelectionAsTsv(rows, columns, range);
    await clipboard.writeText(text);
    setActiveCutRange(range);
    setActiveCopyRange(null);
  }, [rangeSelection.range, rows, columns, clipboard]);

  const pasteRange = useCallback(async () => {
    const range = rangeSelection.range;
    if (!range) return;

    const text = await clipboard.readText();
    const parsed = parseTsvClipboard(text);
    if (parsed.length === 0) return;

    const events = applyPastedValues(
      parsed,
      range.startRow,
      range.startCol,
      rows,
      columns,
    );

    // If a cut was active and paste lands in a different range, also clear the cut source.
    let combined = events;
    if (activeCutRange) {
      const cutClearEvents = applyCutClear(activeCutRange, rows, columns);
      // Skip cells that paste already overwrote (cut + paste over the same cell = paste wins).
      const pastedKeys = new Set(events.map((e) => `${e.rowIndex}|${e.columnId}`));
      const filtered = cutClearEvents.filter(
        (e) => !pastedKeys.has(`${e.rowIndex}|${e.columnId}`),
      );
      combined = [...events, ...filtered];
    }

    if (combined.length > 0) onCellEdit(combined);
    setActiveCutRange(null);
    setActiveCopyRange(null);
  }, [rangeSelection.range, rows, columns, onCellEdit, clipboard, activeCutRange]);

  const clearClipboard = useCallback(() => {
    setActiveCutRange(null);
    setActiveCopyRange(null);
  }, []);

  return {
    copyRange,
    cutRange,
    pasteRange,
    canPaste,
    activeCutRange,
    activeCopyRange,
    clearClipboard,
  };
}
