/**
 * useFillHandle (Vue) — headless drag-to-fill.
 *
 * Mirrors React useFillHandle. Pairs with useRangeSelection. On commit,
 * applies fill via core's applyFillValues and emits cell-change events.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue';
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
  UseRangeSelectionResult,
} from './useRangeSelection';

export interface UseFillHandleParams<T> {
  rangeSelection: UseRangeSelectionResult;
  rows: T[];
  columns: ICoreColumnDef<T>[];
  onFillCells: (events: ICellValueChangedEvent<T>[]) => void;
}

export interface UseFillHandleResult {
  fillTarget: Ref<CellCoord | null>;
  isFilling: ComputedRef<boolean>;
  startFill: () => void;
  updateFill: (row: number, col: number) => void;
  commitFill: () => void;
  cancelFill: () => void;
  fillRange: ComputedRef<ISelectionRange | null>;
  isInFillRange: (row: number, col: number) => boolean;
}

export function useFillHandle<T>(
  params: UseFillHandleParams<T>,
): UseFillHandleResult {
  const { rangeSelection, rows, columns, onFillCells } = params;

  const fillTarget = ref<CellCoord | null>(null);
  const isFilling = computed(() => fillTarget.value !== null);

  const fillRange = computed<ISelectionRange | null>(() => {
    const src = rangeSelection.range.value;
    if (!src) return null;
    if (!fillTarget.value) return src;
    return normalizeSelectionRange({
      startRow: Math.min(src.startRow, fillTarget.value.row),
      startCol: Math.min(src.startCol, fillTarget.value.col),
      endRow: Math.max(src.endRow, fillTarget.value.row),
      endCol: Math.max(src.endCol, fillTarget.value.col),
    });
  });

  const isInFillRange = (row: number, col: number): boolean => {
    const r = fillRange.value;
    if (!r) return false;
    return isInSelectionRange(r, row, col);
  };

  const startFill = () => {
    const src = rangeSelection.range.value;
    if (!src) return;
    fillTarget.value = { row: src.endRow, col: src.endCol };
  };

  const updateFill = (row: number, col: number) => {
    if (fillTarget.value === null) return;
    fillTarget.value = { row, col };
  };

  const cancelFill = () => {
    fillTarget.value = null;
  };

  const commitFill = () => {
    const src = rangeSelection.range.value;
    const fr = fillRange.value;
    if (!src || !fr) {
      fillTarget.value = null;
      return;
    }
    if (
      fr.startRow === src.startRow &&
      fr.startCol === src.startCol &&
      fr.endRow === src.endRow &&
      fr.endCol === src.endCol
    ) {
      fillTarget.value = null;
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
    fillTarget.value = null;
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
