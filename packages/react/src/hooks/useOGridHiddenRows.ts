import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { RowId } from '../types';

export interface UseOGridHiddenRowsParams {
  /** Controlled hidden rows (the `hiddenRowIds` prop). */
  controlledHiddenRowIds?: RowId[];
  /** Initially hidden rows when uncontrolled. */
  defaultHiddenRowIds?: RowId[];
  onHiddenRowIdsChange?: (rowIds: RowId[]) => void;
}

export interface UseOGridHiddenRowsState {
  hiddenRowIds: RowId[];
  /** `hiddenRowIds` as a set; `null` when no row is hidden. */
  hiddenRowSet: ReadonlySet<RowId> | null;
  hideRows: (rowIds: RowId[]) => void;
  unhideRows: (rowIds: RowId[]) => void;
  /** Raw uncontrolled setter (no change notification), for sheet-scoped restore. */
  setInternalHiddenRowIds: Dispatch<SetStateAction<RowId[]>>;
}

const NO_ROWS: RowId[] = [];

/** Hidden rows with controlled/uncontrolled support (`hiddenRowIds` / `onHiddenRowIdsChange`). */
export function useOGridHiddenRows(params: UseOGridHiddenRowsParams): UseOGridHiddenRowsState {
  const { controlledHiddenRowIds, defaultHiddenRowIds, onHiddenRowIdsChange } = params;
  const [internal, setInternalHiddenRowIds] = useState<RowId[]>(() => defaultHiddenRowIds ?? NO_ROWS);
  const hiddenRowIds = controlledHiddenRowIds ?? internal;

  // Latest list, advanced synchronously so two changes in one tick build on each other.
  const latestRef = useRef(hiddenRowIds);
  latestRef.current = hiddenRowIds;
  const isControlled = controlledHiddenRowIds !== undefined;

  const commit = useCallback((next: RowId[]) => {
    latestRef.current = next;
    if (!isControlled) setInternalHiddenRowIds(next);
    onHiddenRowIdsChange?.(next);
  }, [isControlled, onHiddenRowIdsChange]);

  const hideRows = useCallback((rowIds: RowId[]) => {
    const current = latestRef.current;
    const have = new Set(current);
    const added = rowIds.filter((id) => !have.has(id));
    if (added.length > 0) commit([...current, ...added]);
  }, [commit]);

  const unhideRows = useCallback((rowIds: RowId[]) => {
    const drop = new Set(rowIds);
    const current = latestRef.current;
    const next = current.filter((id) => !drop.has(id));
    if (next.length !== current.length) commit(next);
  }, [commit]);

  const hiddenRowSet = useMemo(
    () => (hiddenRowIds.length > 0 ? new Set(hiddenRowIds) : null),
    [hiddenRowIds],
  );

  return { hiddenRowIds, hiddenRowSet, hideRows, unhideRows, setInternalHiddenRowIds };
}
