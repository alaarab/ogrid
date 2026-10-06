import { useCallback } from 'react';
import { useColumnResize } from './useColumnResize';
import { useColumnReorder } from './useColumnReorder';
import { useLatestRef } from './useLatestRef';
import { isReportableColumnResize } from './dataGridDerivations';
import type { RefObject } from 'react';
import type { UseColumnResizeParams } from './useColumnResize';
import type { IColumnDef, IOGridDataGridProps } from '../types';

export interface UseDataGridColumnControlsParams<T> {
  columnSizingOverrides: UseColumnResizeParams['columnSizingOverrides'];
  setColumnSizingOverrides: UseColumnResizeParams['setColumnSizingOverrides'];
  onColumnResized: IOGridDataGridProps<T>['onColumnResized'];
  /** All leaf columns, including hidden ones. */
  flatColumns: IColumnDef<T>[];
  columnOrder: string[] | undefined;
  onColumnOrderChange: ((order: string[]) => void) | undefined;
  columnReorder: boolean | undefined;
  pinnedColumns: Record<string, 'left' | 'right'> | undefined;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

/** Column resize and drag-reorder wiring for the header. */
export function useDataGridColumnControls<T>(params: UseDataGridColumnControlsParams<T>) {
  const { columnSizingOverrides, setColumnSizingOverrides, flatColumns, columnOrder, onColumnOrderChange, columnReorder, pinnedColumns, wrapperRef } = params;
  // Report drag resizes and double-click autosizes so the host (and OGrid's
  // column state) sees them.
  const onColumnResizedRef = useLatestRef(params.onColumnResized);
  const reportColumnResized = useCallback(
    (columnId: string, width: number) => {
      if (isReportableColumnResize(columnId)) onColumnResizedRef.current?.(columnId, width);
    },
    [onColumnResizedRef],
  );
  const resize = useColumnResize<T>({
    columnSizingOverrides,
    setColumnSizingOverrides,
    onColumnResized: reportColumnResized,
  });
  const reorder = useColumnReorder<T>({
    columns: flatColumns,
    columnOrder,
    onColumnOrderChange,
    enabled: columnReorder === true,
    pinnedColumns,
    wrapperRef,
  });
  return { resize, reorder };
}
