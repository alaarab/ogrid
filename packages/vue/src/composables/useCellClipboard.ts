/**
 * useCellClipboard (Vue) — TSV copy/cut/paste for cell ranges.
 *
 * Mirrors the React API. Honors clipboardFormatter (copy) + valueParser (paste).
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue';
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
  rangeSelection: UseRangeSelectionResult;
  rows: T[];
  columns: ICoreColumnDef<T>[];
  onCellEdit: (events: ICellValueChangedEvent<T>[]) => void;
  clipboard?: {
    readText: () => Promise<string>;
    writeText: (text: string) => Promise<void>;
  };
}

export interface UseCellClipboardResult {
  copyRange: () => Promise<void>;
  cutRange: () => Promise<void>;
  pasteRange: () => Promise<void>;
  canPaste: ComputedRef<boolean>;
  activeCutRange: Ref<ISelectionRange | null>;
  activeCopyRange: Ref<ISelectionRange | null>;
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

export function useCellClipboard<T>(
  params: UseCellClipboardParams<T>,
): UseCellClipboardResult {
  const { rangeSelection, rows, columns, onCellEdit, clipboard = DEFAULT_CLIPBOARD } = params;

  const activeCutRange = ref<ISelectionRange | null>(null);
  const activeCopyRange = ref<ISelectionRange | null>(null);

  const canPaste = computed(
    () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText),
  );

  const copyRange = async () => {
    const r = rangeSelection.range.value;
    if (!r) return;
    const text = formatSelectionAsTsv(rows, columns, r);
    await clipboard.writeText(text);
    activeCopyRange.value = r;
    activeCutRange.value = null;
  };

  const cutRange = async () => {
    const r = rangeSelection.range.value;
    if (!r) return;
    const text = formatSelectionAsTsv(rows, columns, r);
    await clipboard.writeText(text);
    activeCutRange.value = r;
    activeCopyRange.value = null;
  };

  const pasteRange = async () => {
    const r = rangeSelection.range.value;
    if (!r) return;
    const text = await clipboard.readText();
    const parsed = parseTsvClipboard(text);
    if (parsed.length === 0) return;

    const events = applyPastedValues(
      parsed,
      r.startRow,
      r.startCol,
      rows,
      columns,
    );

    let combined = events;
    if (activeCutRange.value) {
      const cutClearEvents = applyCutClear(activeCutRange.value, rows, columns);
      const pastedKeys = new Set(events.map((e) => `${e.rowIndex}|${e.columnId}`));
      const filtered = cutClearEvents.filter(
        (e) => !pastedKeys.has(`${e.rowIndex}|${e.columnId}`),
      );
      combined = [...events, ...filtered];
    }
    if (combined.length > 0) onCellEdit(combined);
    activeCutRange.value = null;
    activeCopyRange.value = null;
  };

  const clearClipboard = () => {
    activeCutRange.value = null;
    activeCopyRange.value = null;
  };

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
