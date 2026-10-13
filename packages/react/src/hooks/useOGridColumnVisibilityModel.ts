import { useCallback, useMemo, useRef, useState } from 'react';
import {
  normalizeColumnVisibility,
  resolveColumnVisibility,
  sameColumnVisibility,
  updateColumnVisibility,
} from '@alaarab/ogrid-core';
import type { IColumnMeta, IColumnVisibilityState } from '@alaarab/ogrid-core';

export interface UseOGridColumnVisibilityModelParams {
  columns: readonly IColumnMeta[];
  columnVisibility?: IColumnVisibilityState;
  defaultColumnVisibility?: IColumnVisibilityState;
  onColumnVisibilityChange?: (state: IColumnVisibilityState) => void;
  onVisibleColumnsChange?: (cols: Set<string>) => void;
  hideToFit: boolean;
}

export interface OGridColumnVisibilityModel {
  state: IColumnVisibilityState;
  userVisible: Set<string>;
  displayed: Set<string>;
  getState: () => IColumnVisibilityState;
  getUserVisible: () => Set<string>;
  setState: (state: IColumnVisibilityState) => void;
  onDisplayedChange: (next: Set<string>) => void;
  onFitHiddenColumnsChange?: (columnIds: Set<string>) => void;
}

const NO_COLUMNS = new Set<string>();

export function useOGridColumnVisibilityModel(
  params: UseOGridColumnVisibilityModelParams,
): OGridColumnVisibilityModel | undefined {
  const { columns, columnVisibility, defaultColumnVisibility, onColumnVisibilityChange, onVisibleColumnsChange, hideToFit } = params;
  const active = columnVisibility !== undefined || defaultColumnVisibility !== undefined || onColumnVisibilityChange !== undefined;
  const controlled = columnVisibility !== undefined;

  const [internalState, setInternalState] = useState(() => normalizeColumnVisibility(defaultColumnVisibility));
  const [fitHidden, setFitHidden] = useState<Set<string>>(NO_COLUMNS);

  const state = useMemo(
    () => (controlled ? normalizeColumnVisibility(columnVisibility) : internalState),
    [controlled, columnVisibility, internalState],
  );
  const userVisible = useMemo(() => resolveColumnVisibility(columns, state), [columns, state]);
  const displayed = useMemo(() => {
    if (!hideToFit || fitHidden.size === 0) return userVisible;
    const shown = new Set(state.shown);
    const next = new Set([...userVisible].filter((id) => shown.has(id) || !fitHidden.has(id)));
    return next.size > 0 ? next : userVisible;
  }, [hideToFit, fitHidden, userVisible, state.shown]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const callbacksRef = useRef({ onColumnVisibilityChange, onVisibleColumnsChange, controlled });
  callbacksRef.current = { onColumnVisibilityChange, onVisibleColumnsChange, controlled };

  const setState = useCallback((nextState: IColumnVisibilityState) => {
    const next = normalizeColumnVisibility(nextState);
    if (sameColumnVisibility(stateRef.current, next)) return;
    stateRef.current = next;
    const callbacks = callbacksRef.current;
    if (!callbacks.controlled) setInternalState(next);
    callbacks.onColumnVisibilityChange?.(next);
    callbacks.onVisibleColumnsChange?.(resolveColumnVisibility(columnsRef.current, next));
  }, []);

  const onDisplayedChange = useCallback((next: Set<string>) => {
    const previous = displayedRef.current;
    displayedRef.current = next;
    setState(updateColumnVisibility(columnsRef.current, stateRef.current, previous, next));
  }, [setState]);

  const onFitHiddenColumnsChange = useCallback((columnIds: Set<string>) => setFitHidden(columnIds), []);
  const getState = useCallback(() => stateRef.current, []);
  const getUserVisible = useCallback(() => resolveColumnVisibility(columnsRef.current, stateRef.current), []);

  return useMemo(() => active ? {
    state, userVisible, displayed, getState, getUserVisible, setState, onDisplayedChange,
    onFitHiddenColumnsChange: hideToFit ? onFitHiddenColumnsChange : undefined,
  } : undefined, [active, state, userVisible, displayed, getState, getUserVisible, setState, onDisplayedChange, hideToFit, onFitHiddenColumnsChange]);
}
