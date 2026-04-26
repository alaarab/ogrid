/**
 * createCellClipboard (Angular) — TSV copy/cut/paste.
 */

import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
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
import type { RangeSelectionResult } from './range-selection';

export interface CreateCellClipboardParams<T> {
  rangeSelection: RangeSelectionResult;
  rows: T[];
  columns: ICoreColumnDef<T>[];
  onCellEdit: (events: ICellValueChangedEvent<T>[]) => void;
  clipboard?: {
    readText: () => Promise<string>;
    writeText: (text: string) => Promise<void>;
  };
}

export interface CellClipboardResult {
  copyRange: () => Promise<void>;
  cutRange: () => Promise<void>;
  pasteRange: () => Promise<void>;
  canPaste: Signal<boolean>;
  activeCutRange: WritableSignal<ISelectionRange | null>;
  activeCopyRange: WritableSignal<ISelectionRange | null>;
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

export function createCellClipboard<T>(
  params: CreateCellClipboardParams<T>,
): CellClipboardResult {
  const { rangeSelection, rows, columns, onCellEdit, clipboard = DEFAULT_CLIPBOARD } = params;

  const activeCutRange = signal<ISelectionRange | null>(null);
  const activeCopyRange = signal<ISelectionRange | null>(null);

  const canPaste = computed(
    () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText),
  );

  const copyRange = async () => {
    const r = rangeSelection.range();
    if (!r) return;
    const text = formatSelectionAsTsv(rows, columns, r);
    await clipboard.writeText(text);
    activeCopyRange.set(r);
    activeCutRange.set(null);
  };

  const cutRange = async () => {
    const r = rangeSelection.range();
    if (!r) return;
    const text = formatSelectionAsTsv(rows, columns, r);
    await clipboard.writeText(text);
    activeCutRange.set(r);
    activeCopyRange.set(null);
  };

  const pasteRange = async () => {
    const r = rangeSelection.range();
    if (!r) return;
    const text = await clipboard.readText();
    const parsed = parseTsvClipboard(text);
    if (parsed.length === 0) return;

    const events = applyPastedValues(parsed, r.startRow, r.startCol, rows, columns);
    let combined = events;
    const cut = activeCutRange();
    if (cut) {
      const cutClearEvents = applyCutClear(cut, rows, columns);
      const pastedKeys = new Set(events.map((e) => `${e.rowIndex}|${e.columnId}`));
      const filtered = cutClearEvents.filter(
        (e) => !pastedKeys.has(`${e.rowIndex}|${e.columnId}`),
      );
      combined = [...events, ...filtered];
    }
    if (combined.length > 0) onCellEdit(combined);
    activeCutRange.set(null);
    activeCopyRange.set(null);
  };

  const clearClipboard = () => {
    activeCutRange.set(null);
    activeCopyRange.set(null);
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
