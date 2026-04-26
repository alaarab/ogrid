/**
 * createRangeSelection (Angular) — headless cell-range selection.
 *
 * Mirrors React useRangeSelection with Angular signals.
 */

import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import {
  normalizeSelectionRange,
  isInSelectionRange,
} from '@alaarab/ogrid-core';
import type { ISelectionRange } from '@alaarab/ogrid-core';

export interface CellCoord {
  row: number;
  col: number;
}

export interface CreateRangeSelectionParams {
  rowCount: number;
  colCount: number;
}

export interface RangeSelectionResult {
  range: Signal<ISelectionRange | null>;
  anchor: WritableSignal<CellCoord | null>;
  focus: WritableSignal<CellCoord | null>;
  startRange: (row: number, col: number) => void;
  extendRange: (row: number, col: number) => void;
  setRange: (range: ISelectionRange | null) => void;
  clearRange: () => void;
  selectAll: () => void;
  isInRange: (row: number, col: number) => boolean;
  getRangeRows: () => number[];
  getRangeCells: () => CellCoord[];
}

export function createRangeSelection(
  params: CreateRangeSelectionParams,
): RangeSelectionResult {
  const { rowCount, colCount } = params;

  const anchor = signal<CellCoord | null>(null);
  const focus = signal<CellCoord | null>(null);

  const range = computed<ISelectionRange | null>(() => {
    const a = anchor();
    const f = focus();
    if (!a || !f) return null;
    return normalizeSelectionRange({
      startRow: a.row,
      startCol: a.col,
      endRow: f.row,
      endCol: f.col,
    });
  });

  const startRange = (row: number, col: number) => {
    anchor.set({ row, col });
    focus.set({ row, col });
  };

  const extendRange = (row: number, col: number) => {
    if (!anchor()) anchor.set({ row, col });
    focus.set({ row, col });
  };

  const setRange = (next: ISelectionRange | null) => {
    if (!next) {
      anchor.set(null);
      focus.set(null);
      return;
    }
    const n = normalizeSelectionRange(next);
    anchor.set({ row: n.startRow, col: n.startCol });
    focus.set({ row: n.endRow, col: n.endCol });
  };

  const clearRange = () => {
    anchor.set(null);
    focus.set(null);
  };

  const selectAll = () => {
    if (rowCount <= 0 || colCount <= 0) return;
    anchor.set({ row: 0, col: 0 });
    focus.set({ row: rowCount - 1, col: colCount - 1 });
  };

  const isInRange = (row: number, col: number): boolean => {
    const r = range();
    if (!r) return false;
    return isInSelectionRange(r, row, col);
  };

  const getRangeRows = (): number[] => {
    const r = range();
    if (!r) return [];
    const rows: number[] = [];
    for (let i = r.startRow; i <= r.endRow; i += 1) rows.push(i);
    return rows;
  };

  const getRangeCells = (): CellCoord[] => {
    const r = range();
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
