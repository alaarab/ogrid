/**
 * useRangeSelection (Vue) — headless cell-range selection for OGrid.
 *
 * Mirrors the React API with Vue refs/computeds. Anchor + focus model.
 * Foundation for useFillHandle and useCellClipboard.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue';
import {
  normalizeSelectionRange,
  isInSelectionRange,
} from '@alaarab/ogrid-core';
import type { ISelectionRange } from '@alaarab/ogrid-core';

export interface CellCoord {
  row: number;
  col: number;
}

export interface UseRangeSelectionParams {
  rowCount: number;
  colCount: number;
}

export interface UseRangeSelectionResult {
  range: ComputedRef<ISelectionRange | null>;
  anchor: Ref<CellCoord | null>;
  focus: Ref<CellCoord | null>;
  startRange: (row: number, col: number) => void;
  extendRange: (row: number, col: number) => void;
  setRange: (range: ISelectionRange | null) => void;
  clearRange: () => void;
  selectAll: () => void;
  isInRange: (row: number, col: number) => boolean;
  getRangeRows: () => number[];
  getRangeCells: () => CellCoord[];
}

export function useRangeSelection(
  params: UseRangeSelectionParams,
): UseRangeSelectionResult {
  const { rowCount, colCount } = params;

  const anchor = ref<CellCoord | null>(null);
  const focus = ref<CellCoord | null>(null);

  const range = computed<ISelectionRange | null>(() => {
    if (!anchor.value || !focus.value) return null;
    return normalizeSelectionRange({
      startRow: anchor.value.row,
      startCol: anchor.value.col,
      endRow: focus.value.row,
      endCol: focus.value.col,
    });
  });

  const startRange = (row: number, col: number) => {
    anchor.value = { row, col };
    focus.value = { row, col };
  };

  const extendRange = (row: number, col: number) => {
    if (!anchor.value) anchor.value = { row, col };
    focus.value = { row, col };
  };

  const setRange = (next: ISelectionRange | null) => {
    if (!next) {
      anchor.value = null;
      focus.value = null;
      return;
    }
    const n = normalizeSelectionRange(next);
    anchor.value = { row: n.startRow, col: n.startCol };
    focus.value = { row: n.endRow, col: n.endCol };
  };

  const clearRange = () => {
    anchor.value = null;
    focus.value = null;
  };

  const selectAll = () => {
    if (rowCount <= 0 || colCount <= 0) return;
    anchor.value = { row: 0, col: 0 };
    focus.value = { row: rowCount - 1, col: colCount - 1 };
  };

  const isInRange = (row: number, col: number): boolean => {
    const r = range.value;
    if (!r) return false;
    return isInSelectionRange(r, row, col);
  };

  const getRangeRows = (): number[] => {
    const r = range.value;
    if (!r) return [];
    const rows: number[] = [];
    for (let i = r.startRow; i <= r.endRow; i += 1) rows.push(i);
    return rows;
  };

  const getRangeCells = (): CellCoord[] => {
    const r = range.value;
    if (!r) return [];
    const cells: CellCoord[] = [];
    for (let i = r.startRow; i <= r.endRow; i += 1) {
      for (let j = r.startCol; j <= r.endCol; j += 1) {
        cells.push({ row: i, col: j });
      }
    }
    return cells;
  };

  return {
    range,
    anchor,
    focus,
    startRange,
    extendRange,
    setRange,
    clearRange,
    selectAll,
    isInRange,
    getRangeRows,
    getRangeCells,
  };
}
