import { useCallback } from 'react';
import { useColumnResize } from './useColumnResize';
import { useColumnReorder } from './useColumnReorder';
import { useLatestRef } from './useLatestRef';
import { isReportableColumnResize } from './dataGridDerivations';
import type { RefObject } from 'react';
import type { DataGridLayoutState } from './useDataGridState';
import type { IColumnDef, IOGridDataGridProps } from '../types';

/** Column resize and drag-reorder wiring for the header. */
export function useDataGridColumnControls<T>(
  props: Pick<IOGridDataGridProps<T>, 'onColumnResized' | 'columnOrder' | 'onColumnOrderChange' | 'columnReorder' | 'pinnedColumns'>,
  layout: Pick<DataGridLayoutState<T>, 'columnSizingOverrides' | 'setColumnSizingOverrides' | 'flatColumns'>,
  wrapperRef: RefObject<HTMLDivElement | null>,
) {
  // Report drag resizes and double-click autosizes so the host (and OGrid's
  // column state) sees them.
  const onColumnResizedRef = useLatestRef(props.onColumnResized);
  const reportColumnResized = useCallback(
    (columnId: string, width: number) => {
      if (isReportableColumnResize(columnId)) onColumnResizedRef.current?.(columnId, width);
    },
    [onColumnResizedRef],
  );
  const resize = useColumnResize<T>({
    columnSizingOverrides: layout.columnSizingOverrides,
    setColumnSizingOverrides: layout.setColumnSizingOverrides,
    onColumnResized: reportColumnResized,
  });
  const reorder = useColumnReorder<T>({
    columns: layout.flatColumns as IColumnDef<T>[],
    columnOrder: props.columnOrder,
    onColumnOrderChange: props.onColumnOrderChange,
    enabled: props.columnReorder === true,
    pinnedColumns: props.pinnedColumns,
    wrapperRef,
  });
  return { resize, reorder };
}
