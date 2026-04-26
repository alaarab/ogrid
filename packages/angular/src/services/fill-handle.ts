/**
 * createFillHandle (Angular) — headless drag-to-fill.
 */

import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import {
  applyFillValues,
  isInSelectionRange,
  normalizeSelectionRange,
} from '@alaarab/ogrid-core';
import type {
  IColumnDef as ICoreColumnDef,
  ISelectionRange,
  ICellValueChangedEvent,
} from '@alaarab/ogrid-core';
import type {
  CellCoord,
  RangeSelectionResult,
} from './range-selection';

export interface CreateFillHandleParams<T> {
  rangeSelection: RangeSelectionResult;
  rows: T[];
  columns: ICoreColumnDef<T>[];
  onFillCells: (events: ICellValueChangedEvent<T>[]) => void;
}

export interface FillHandleResult {
  fillTarget: WritableSignal<CellCoord | null>;
  isFilling: Signal<boolean>;
  startFill: () => void;
  updateFill: (row: number, col: number) => void;
  commitFill: () => void;
  cancelFill: () => void;
  fillRange: Signal<ISelectionRange | null>;
  isInFillRange: (row: number, col: number) => boolean;
}

export function createFillHandle<T>(
  params: CreateFillHandleParams<T>,
): FillHandleResult {
  const { rangeSelection, rows, columns, onFillCells } = params;

  const fillTarget = signal<CellCoord | null>(null);
  const isFilling = computed(() => fillTarget() !== null);

  const fillRange = computed<ISelectionRange | null>(() => {
    const src = rangeSelection.range();
    if (!src) return null;
    const t = fillTarget();
    if (!t) return src;
    return normalizeSelectionRange({
      startRow: Math.min(src.startRow, t.row),
      startCol: Math.min(src.startCol, t.col),
      endRow: Math.max(src.endRow, t.row),
      endCol: Math.max(src.endCol, t.col),
    });
  });

  const isInFillRange = (row: number, col: number): boolean => {
    const r = fillRange();
    if (!r) return false;
    return isInSelectionRange(r, row, col);
  };

  const startFill = () => {
    const src = rangeSelection.range();
    if (!src) return;
    fillTarget.set({ row: src.endRow, col: src.endCol });
  };

  const updateFill = (row: number, col: number) => {
    if (fillTarget() === null) return;
    fillTarget.set({ row, col });
  };

  const cancelFill = () => fillTarget.set(null);

  const commitFill = () => {
    const src = rangeSelection.range();
    const fr = fillRange();
    if (!src || !fr) {
      fillTarget.set(null);
      return;
    }
    if (
      fr.startRow === src.startRow &&
      fr.startCol === src.startCol &&
      fr.endRow === src.endRow &&
      fr.endCol === src.endCol
    ) {
      fillTarget.set(null);
      return;
    }
    const events = applyFillValues(
      fr,
      src.startRow,
      src.startCol,
      rows,
      columns,
    );
    if (events.length > 0) onFillCells(events);
    fillTarget.set(null);
  };

  return {
    fillTarget,
    isFilling,
    startFill,
    updateFill,
    commitFill,
    cancelFill,
    fillRange,
    isInFillRange,
  };
}
