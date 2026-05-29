import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { RowId, IRowSelectionChangeEvent } from '../types';

export interface UseOGridRowSelectionParams<T> {
  /** Controlled selected rows (the `selectedRows` prop), if provided. */
  controlledSelectedRows?: Set<RowId>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
}

export interface UseOGridRowSelectionState<T> {
  effectiveSelectedRows: Set<RowId>;
  handleSelectionChange: (event: IRowSelectionChangeEvent<T>) => void;
  /** Raw setter consumed by the imperative handle (setSelectedRows / selectAll / etc.). */
  setInternalSelectedRows: Dispatch<SetStateAction<Set<RowId>>>;
}

/**
 * Manages row selection state with controlled/uncontrolled dual-mode support.
 * Internal state is only updated in uncontrolled mode; the change event always fires.
 */
export function useOGridRowSelection<T>(
  params: UseOGridRowSelectionParams<T>
): UseOGridRowSelectionState<T> {
  const { controlledSelectedRows, onSelectionChange } = params;

  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<RowId>>(new Set());
  const effectiveSelectedRows = controlledSelectedRows ?? internalSelectedRows;

  const handleSelectionChange = useCallback(
    (event: IRowSelectionChangeEvent<T>) => {
      if (controlledSelectedRows === undefined) {
        setInternalSelectedRows(new Set(event.selectedRowIds));
      }
      onSelectionChange?.(event);
    },
    [controlledSelectedRows, onSelectionChange]
  );

  return { effectiveSelectedRows, handleSelectionChange, setInternalSelectedRows };
}
