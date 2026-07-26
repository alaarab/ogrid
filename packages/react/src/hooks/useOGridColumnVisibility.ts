import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { columnIdsOf, sameColumnIds } from './columnSetIdentity';

export interface UseOGridColumnVisibilityParams {
  /** Memoized flat columns (only columnId + defaultVisible are read here). */
  columns: ReadonlyArray<{ columnId: string; defaultVisible?: boolean }>;
  /** Controlled visible columns (the `visibleColumns` prop), if provided. */
  controlledVisibleColumns?: Set<string>;
  onVisibleColumnsChange?: (cols: Set<string>) => void;
}

export interface UseOGridColumnVisibilityState {
  visibleColumns: Set<string>;
  setVisibleColumns: (cols: Set<string>) => void;
  handleVisibilityChange: (columnKey: string, isVisible: boolean) => void;
  /**
   * Raw setter for the uncontrolled visible set. Writes state without notifying
   * `onVisibleColumnsChange`, so callers restoring a previously captured set
   * (sheet-scoped state) don't report it back as a user edit.
   */
  setInternalVisibleColumns: Dispatch<SetStateAction<Set<string>>>;
}

type VisibilityColumn = { columnId: string; defaultVisible?: boolean };

/** Seed a visible set purely from `defaultVisible`, falling back to all columns. */
function seedVisible(columns: ReadonlyArray<VisibilityColumn>): Set<string> {
  const visible = columns
    .filter((c) => c.defaultVisible !== false)
    .map((c) => c.columnId);
  return new Set(visible.length > 0 ? visible : columns.map((c) => c.columnId));
}

/**
 * Reconcile a visible set against a new column set.
 *
 * Columns that were already known keep whatever the user chose for them; columns
 * new to the grid are seeded from `defaultVisible`. If that leaves nothing
 * visible (e.g. the whole column set was swapped for one the old choices say
 * nothing about) fall back to the defaults of the new columns, so the grid never
 * renders zero columns  -  and therefore zero rows.
 */
function reconcileVisible(
  prevVisible: Set<string>,
  prevColumnIds: readonly string[],
  columns: ReadonlyArray<VisibilityColumn>
): Set<string> {
  if (columns.length === 0) return new Set();
  const known = new Set(prevColumnIds);
  const next = new Set<string>();
  for (const c of columns) {
    const keep = known.has(c.columnId)
      ? prevVisible.has(c.columnId)
      : c.defaultVisible !== false;
    if (keep) next.add(c.columnId);
  }
  return next.size > 0 ? next : seedVisible(columns);
}

/**
 * Manages column visibility with controlled/uncontrolled dual-mode support.
 * Seeds the visible set from `defaultVisible`, and re-reconciles whenever the
 * column set itself changes (async-loaded column defs, sheet switches, any swap
 * of `columns`) so the visible set never keeps ids from a column set that is no
 * longer on screen.
 */
export function useOGridColumnVisibility(
  params: UseOGridColumnVisibilityParams
): UseOGridColumnVisibilityState {
  const { columns, controlledVisibleColumns, onVisibleColumnsChange } = params;

  const [internalVisibleColumns, setInternalVisibleColumns] = useState<Set<string>>(
    () => seedVisible(columns)
  );

  // Remap on column-set changes during render (React's "adjust state when props
  // change" pattern) rather than in an effect, so the grid never commits a frame
  // with a stale visible set  -  that frame shows a wrong visible count and, when
  // the old and new column sets are disjoint, no columns and no rows at all.
  const [prevColumnIds, setPrevColumnIds] = useState<string[]>(() => columnIdsOf(columns));
  if (!sameColumnIds(prevColumnIds, columns)) {
    setPrevColumnIds(columnIdsOf(columns));
    if (controlledVisibleColumns === undefined) {
      setInternalVisibleColumns((prev) => reconcileVisible(prev, prevColumnIds, columns));
    }
  }

  const visibleColumns = controlledVisibleColumns ?? internalVisibleColumns;

  const setVisibleColumns = useCallback(
    (cols: Set<string>) => {
      if (controlledVisibleColumns === undefined) setInternalVisibleColumns(cols);
      onVisibleColumnsChange?.(cols);
    },
    [controlledVisibleColumns, onVisibleColumnsChange]
  );

  const handleVisibilityChange = useCallback(
    (columnKey: string, isVisible: boolean) => {
      const next = new Set(visibleColumns);
      if (isVisible) next.add(columnKey);
      else next.delete(columnKey);
      setVisibleColumns(next);
    },
    [visibleColumns, setVisibleColumns]
  );

  return { visibleColumns, setVisibleColumns, handleVisibilityChange, setInternalVisibleColumns };
}
