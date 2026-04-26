/**
 * useGridFocus (Vue) — headless arrow-key cell navigation.
 *
 * Mirrors React API with Vue refs.
 */

import { ref, type Ref } from 'vue';
import type { CellCoord, UseRangeSelectionResult } from './useRangeSelection';

export interface UseGridFocusParams {
  rowCount: number;
  colCount: number;
  pageSize?: number;
  rangeSelection?: UseRangeSelectionResult;
}

export interface UseGridFocusResult {
  activeCell: Ref<CellCoord | null>;
  setActiveCell: (cell: CellCoord | null) => void;
  moveUp: (n?: number) => void;
  moveDown: (n?: number) => void;
  moveLeft: (n?: number) => void;
  moveRight: (n?: number) => void;
  moveToRowStart: () => void;
  moveToRowEnd: () => void;
  moveToStart: () => void;
  moveToEnd: () => void;
  getKeyDownHandler: () => (e: {
    key: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault?: () => void;
  }) => void;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function useGridFocus(params: UseGridFocusParams): UseGridFocusResult {
  const { rowCount, colCount, pageSize = 10, rangeSelection } = params;

  const activeCell = ref<CellCoord | null>(null);

  const setActiveCell = (cell: CellCoord | null) => {
    activeCell.value = cell;
  };

  const moveBy = (drow: number, dcol: number, extendRange = false) => {
    if (rowCount <= 0 || colCount <= 0) return;
    const start = activeCell.value ?? { row: 0, col: 0 };
    const next: CellCoord = {
      row: clamp(start.row + drow, 0, rowCount - 1),
      col: clamp(start.col + dcol, 0, colCount - 1),
    };
    if (rangeSelection) {
      if (extendRange) rangeSelection.extendRange(next.row, next.col);
      else rangeSelection.startRange(next.row, next.col);
    }
    activeCell.value = next;
  };

  const moveUp = (n = 1) => moveBy(-n, 0);
  const moveDown = (n = 1) => moveBy(n, 0);
  const moveLeft = (n = 1) => moveBy(0, -n);
  const moveRight = (n = 1) => moveBy(0, n);

  const moveToRowStart = () => {
    const row = activeCell.value?.row ?? 0;
    activeCell.value = { row, col: 0 };
    rangeSelection?.startRange(row, 0);
  };

  const moveToRowEnd = () => {
    const row = activeCell.value?.row ?? 0;
    const col = Math.max(0, colCount - 1);
    activeCell.value = { row, col };
    rangeSelection?.startRange(row, col);
  };

  const moveToStart = () => {
    activeCell.value = { row: 0, col: 0 };
    rangeSelection?.startRange(0, 0);
  };

  const moveToEnd = () => {
    const last = {
      row: Math.max(0, rowCount - 1),
      col: Math.max(0, colCount - 1),
    };
    activeCell.value = last;
    rangeSelection?.startRange(last.row, last.col);
  };

  const getKeyDownHandler = () => {
    return (e: {
      key: string;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      preventDefault?: () => void;
    }) => {
      const shift = e.shiftKey === true;
      const mod = e.ctrlKey === true || e.metaKey === true;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault?.();
          moveBy(-1, 0, shift);
          break;
        case 'ArrowDown':
          e.preventDefault?.();
          moveBy(1, 0, shift);
          break;
        case 'ArrowLeft':
          e.preventDefault?.();
          moveBy(0, -1, shift);
          break;
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault?.();
          moveBy(0, shift && e.key === 'Tab' ? -1 : 1, false);
          break;
        case 'Enter':
          e.preventDefault?.();
          moveBy(shift ? -1 : 1, 0, false);
          break;
        case 'Home':
          e.preventDefault?.();
          if (mod) moveToStart();
          else moveToRowStart();
          break;
        case 'End':
          e.preventDefault?.();
          if (mod) moveToEnd();
          else moveToRowEnd();
          break;
        case 'PageUp':
          e.preventDefault?.();
          moveBy(-pageSize, 0, shift);
          break;
        case 'PageDown':
          e.preventDefault?.();
          moveBy(pageSize, 0, shift);
          break;
        default:
          break;
      }
    };
  };

  return {
    activeCell,
    setActiveCell,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    moveToRowStart,
    moveToRowEnd,
    moveToStart,
    moveToEnd,
    getKeyDownHandler,
  };
}
