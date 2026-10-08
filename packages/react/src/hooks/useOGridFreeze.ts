import { useCallback, useMemo, useRef, useState } from 'react';
import type { IGridFreezeActions } from '../types';

/** A frozen row/column count clamped to a whole, non-negative number. */
function clampCount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export interface UseOGridFreezeParams {
  /** Show the Freeze menu section; without it no `freezeActions` are built. */
  allowFreeze?: boolean;
  /** Controlled frozen row count. When omitted the hook keeps its own. */
  frozenRows?: number;
  /** Initial frozen rows for the uncontrolled case. */
  defaultFrozenRows?: number;
  onFrozenRowsChange?: (rows: number) => void;
  /** Controlled frozen column count. When omitted the hook keeps its own. */
  frozenColumns?: number;
  /** Initial frozen columns for the uncontrolled case. */
  defaultFrozenColumns?: number;
  onFrozenColumnsChange?: (columns: number) => void;
}

export interface UseOGridFreezeResult {
  /** Effective frozen row count (controlled or internal). */
  frozenRows: number;
  /** Effective frozen column count (controlled or internal). */
  frozenColumns: number;
  /** Context-menu actions, or undefined unless `allowFreeze` is on. */
  freezeActions: IGridFreezeActions | undefined;
}

/**
 * Frozen-pane state for OGrid. `frozenRows`/`frozenColumns` behave as
 * controlled props when given, otherwise the hook owns the state seeded by
 * `defaultFrozen*`. The Freeze context menu calls `setFreeze`, which updates
 * the state and reports through `onFrozen*Change`.
 */
export function useOGridFreeze(params: UseOGridFreezeParams): UseOGridFreezeResult {
  const { allowFreeze, frozenRows, defaultFrozenRows, onFrozenRowsChange, frozenColumns, defaultFrozenColumns, onFrozenColumnsChange } = params;
  const [internalRows, setInternalRows] = useState(() => clampCount(defaultFrozenRows));
  const [internalColumns, setInternalColumns] = useState(() => clampCount(defaultFrozenColumns));
  const rows = frozenRows === undefined ? internalRows : clampCount(frozenRows);
  const columns = frozenColumns === undefined ? internalColumns : clampCount(frozenColumns);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const setFreeze = useCallback(
    (nextRows: number, nextColumns: number) => {
      const r = clampCount(nextRows);
      const c = clampCount(nextColumns);
      if (frozenRows === undefined) setInternalRows(r);
      if (frozenColumns === undefined) setInternalColumns(c);
      if (r !== rowsRef.current) onFrozenRowsChange?.(r);
      if (c !== columnsRef.current) onFrozenColumnsChange?.(c);
    },
    [frozenRows, frozenColumns, onFrozenRowsChange, onFrozenColumnsChange],
  );

  const freezeActions = useMemo<IGridFreezeActions | undefined>(
    () => (allowFreeze ? { frozenRows: rows, frozenColumns: columns, setFreeze } : undefined),
    [allowFreeze, rows, columns, setFreeze],
  );

  return { frozenRows: rows, frozenColumns: columns, freezeActions };
}
