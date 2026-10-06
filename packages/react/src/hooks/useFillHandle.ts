/**
 * useFillHandle — headless Excel-style drag-to-fill for OGrid.
 *
 * Pairs with `useRangeSelection`. The user starts a fill by grabbing the
 * fill-handle at the bottom-right of the current range, then drags toward
 * a target cell. Like Excel, the fill extends the source range along one
 * axis only: whichever one the target is farther outside the range on (rows
 * vs columns; ties fill rows). A target inside the range fills nothing. On
 * commit, every cell in that extension gets the source value(s) tiled over
 * it, with type compatibility checks (won't fill text into a date column).
 *
 * Smart-fill behavior comes from `computeFillDragEdits` in `@alaarab/ogrid-core`
 * (the same commit `<OGrid>`'s fill handle uses), which produces a list of
 * `ICellValueChangedEvent` objects. The consumer
 * wires `onFillCells` to apply those events to their data store.
 *
 * Example:
 *
 *   const range = useRangeSelection({ rowCount: rows.length, colCount: columns.length });
 *   const fill = useFillHandle({
 *     rangeSelection: range,
 *     rows,
 *     columns,
 *     onFillCells: (events) => events.forEach(applyOneEdit),
 *   });
 *
 *   // The fill-handle dot, rendered at the bottom-right of the active range:
 *   <div onMouseDown={fill.startFill} />
 *
 *   // While dragging, on each cell:
 *   <td
 *     onMouseEnter={() => fill.isFilling && fill.updateFill(rowIdx, colIdx)}
 *     onMouseUp={fill.commitFill}
 *     style={{ outline: fill.isInFillRange(rowIdx, colIdx) ? '1px dashed' : undefined }}
 *   />
 */

import { useCallback, useMemo, useState } from 'react';
import {
  computeFillDragEdits,
  computeFillRange,
  isInSelectionRange,
} from '@alaarab/ogrid-core';
import type {
  ISelectionRange,
  ICellValueChangedEvent,
} from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';
import type {
  CellCoord,
  UseRangeSelectionResult,
} from './useRangeSelection';

export interface UseFillHandleParams<T> {
  /** Current range selection — fill always extends from this range. */
  rangeSelection: UseRangeSelectionResult;
  /** Rows currently rendered (post-filter, post-page). */
  rows: T[];
  /** Visible columns the user can fill across. */
  columns: IColumnDef<T>[];
  /**
   * Called with cell-change events when the fill commits. Apply each event
   * to your data store (typically by updating the row at `rowIndex` with
   * `columnId: newValue`).
   */
  onFillCells: (events: ICellValueChangedEvent<T>[]) => void;
}

export interface UseFillHandleResult {
  /** The cell the user is currently dragging the fill handle toward, or null. */
  fillTarget: CellCoord | null;
  /** True while a fill drag is in progress. */
  isFilling: boolean;
  /** Begin a fill from the current range's bottom-right cell. No-op if no range. */
  startFill: () => void;
  /** Update the current fill target as the user drags. No-op if not filling. */
  updateFill: (row: number, col: number) => void;
  /** Commit the fill — calls `onFillCells` with the resulting events. */
  commitFill: () => void;
  /** Cancel without committing. */
  cancelFill: () => void;
  /**
   * The full fill range: the source range extended toward `fillTarget` along
   * one axis (see `computeFillRange`). Equals the source range when idle or
   * when the target is inside it. Use for highlight rendering.
   */
  fillRange: ISelectionRange | null;
  /** True if (row, col) is inside the active fill range. */
  isInFillRange: (row: number, col: number) => boolean;
}

/**
 * Headless drag-to-fill hook.
 *
 * Tracks the fill-target cell and computes the extended range during a
 * drag. On commit, calls core's `computeFillDragEdits` to produce cell-change
 * events, then hands those to the consumer's `onFillCells`.
 */
export function useFillHandle<T>(
  params: UseFillHandleParams<T>,
): UseFillHandleResult {
  const { rangeSelection, rows, columns, onFillCells } = params;

  const [fillTarget, setFillTarget] = useState<CellCoord | null>(null);

  const isFilling = fillTarget !== null;

  const sourceRange = rangeSelection.range;

  // Extend the source range toward the fill target along one axis (Excel).
  const fillRange = useMemo<ISelectionRange | null>(() => {
    if (!sourceRange) return null;
    if (!fillTarget) return sourceRange;
    return computeFillRange(sourceRange, fillTarget.row, fillTarget.col);
  }, [sourceRange, fillTarget]);

  const isInFillRange = useCallback(
    (row: number, col: number): boolean => {
      if (!fillRange) return false;
      return isInSelectionRange(fillRange, row, col);
    },
    [fillRange],
  );

  const startFill = useCallback(() => {
    if (!sourceRange) return;
    setFillTarget({ row: sourceRange.endRow, col: sourceRange.endCol });
  }, [sourceRange]);

  const updateFill = useCallback((row: number, col: number) => {
    setFillTarget((prev) => (prev === null ? prev : { row, col }));
  }, []);

  const cancelFill = useCallback(() => {
    setFillTarget(null);
  }, []);

  const commitFill = useCallback(() => {
    // Same commit as <OGrid>'s fill handle: no events when the target is
    // inside the source range (released without dragging beyond it).
    if (sourceRange && fillTarget) {
      const { events } = computeFillDragEdits(sourceRange, fillTarget.row, fillTarget.col, rows, columns);
      if (events.length > 0) onFillCells(events);
    }
    setFillTarget(null);
  }, [sourceRange, fillTarget, rows, columns, onFillCells]);

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
