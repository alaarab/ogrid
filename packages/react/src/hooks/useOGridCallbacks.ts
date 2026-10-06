import { useCallback, useRef } from 'react';
import { useLatestRef } from './useLatestRef';
import { useStableOptionalCallback } from './useStableOptionalCallback';
import type { IOGridProps, ICellValueChangedEvent, RowId } from '../types';

export type UseOGridCallbacksParams<T> = Pick<
  IOGridProps<T>,
  'getRowId' | 'onColumnOrderChange' | 'onCellValueChanged' | 'onUndo' | 'onRedo' | 'onClipboardError'
>;

export interface UseOGridCallbacksState<T> {
  /** Stable for the grid's lifetime; always calls the latest `getRowId` prop. */
  getRowId: (item: T) => RowId;
  /**
   * Bumped on every edit, undo and redo the grid emits, so the data pipeline can
   * tell the host applying that edit (keep row order) from a fresh dataset
   * (re-sort / re-filter).
   */
  editVersionRef: { current: number };
  onColumnOrderChange?: (order: string[]) => void;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClipboardError?: (error: unknown) => void;
  /** The host owns undo history (`onUndo` supplied). */
  hasHostUndo: boolean;
}

/**
 * Consumer callback sync for OGrid. Inline consumer callbacks must not cause
 * cascading re-renders, so each one is stabilized (see useStableOptionalCallback)
 * and the edit-emitting ones also bump `editVersionRef`.
 */
export function useOGridCallbacks<T>(params: UseOGridCallbacksParams<T>): UseOGridCallbacksState<T> {
  const getRowIdRef = useLatestRef(params.getRowId);
  const getRowId = useCallback((item: T) => getRowIdRef.current(item), [getRowIdRef]);
  const editVersionRef = useRef(0);
  const onColumnOrderChange = useStableOptionalCallback(params.onColumnOrderChange);
  const onCellValueChanged = useStableOptionalCallback(params.onCellValueChanged, editVersionRef);
  const onUndo = useStableOptionalCallback(params.onUndo, editVersionRef);
  const onClipboardError = useStableOptionalCallback(params.onClipboardError);
  const onRedo = useStableOptionalCallback(params.onRedo, editVersionRef);
  return {
    getRowId,
    editVersionRef,
    onColumnOrderChange,
    onCellValueChanged,
    onUndo,
    onRedo,
    onClipboardError,
    hasHostUndo: params.onUndo != null,
  };
}
