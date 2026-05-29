import { useState, useCallback, useEffect, useRef } from 'react';

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
}

/**
 * Manages column visibility with controlled/uncontrolled dual-mode support.
 * Seeds the visible set from `defaultVisible`, and re-initializes once if columns
 * arrive after an initial empty render (async-loaded column definitions).
 */
export function useOGridColumnVisibility(
  params: UseOGridColumnVisibilityParams
): UseOGridColumnVisibilityState {
  const { columns, controlledVisibleColumns, onVisibleColumnsChange } = params;

  const [internalVisibleColumns, setInternalVisibleColumns] = useState<Set<string>>(
    () => {
      const visible = columns
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.columnId);
      return new Set(
        visible.length > 0 ? visible : columns.map((c) => c.columnId)
      );
    }
  );

  // Re-initialize when columns arrive after starting empty (common pattern: columns
  // depend on async data, so the initial render passes columns=[] then re-renders
  // with actual columns once data loads).
  const prevColumnsLengthRef = useRef(columns.length);
  useEffect(() => {
    const prev = prevColumnsLengthRef.current;
    prevColumnsLengthRef.current = columns.length;
    if (controlledVisibleColumns !== undefined) return; // controlled  -  skip
    if (prev === 0 && columns.length > 0 && internalVisibleColumns.size === 0) {
      const visible = columns
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.columnId);
      setInternalVisibleColumns(new Set(
        visible.length > 0 ? visible : columns.map((c) => c.columnId)
      ));
    }
  }, [columns, controlledVisibleColumns, internalVisibleColumns.size]);

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

  return { visibleColumns, setVisibleColumns, handleVisibilityChange };
}
