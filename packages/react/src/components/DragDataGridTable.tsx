import * as React from 'react';
import { applyRowOrder } from '@alaarab/ogrid-core';
import type { IRowOrderChange } from '@alaarab/ogrid-core';
import type { RowId } from '../types';
import { useGridDragDrop } from '../hooks/useGridDragDrop';
import type { BaseDataGridTableContent } from './BaseDataGridTable';
import type { BaseDataGridTableProps } from './BaseDataGridTable';

/** Apply displayed ordering to its existing slots, leaving other rows in place. */
function orderDisplayedRows<T>(rows: T[], ids: RowId[], getRowId: (item: T) => RowId): T[] {
  const displayed = new Set(ids);
  const reordered = applyRowOrder(rows.filter((row) => displayed.has(getRowId(row))), ids, getRowId);
  let next = 0;
  return rows.map((row) => displayed.has(getRowId(row)) ? (reordered[next++] ?? row) : row);
}

/** Loaded only by grids that enable a drag feature. Order precedes all cell state. */
export type DragDataGridTableProps<T> = BaseDataGridTableProps<T> & {
  renderTable: typeof BaseDataGridTableContent<T>;
};

export default function DragDataGridTable<T>(props: DragDataGridTableProps<T>): React.ReactElement {
  const { renderTable: Table, ...gridProps } = props;
  const { items, rowOrderRows = items, getRowId, onRowOrderChange } = props;
  const [order, setOrder] = React.useState<RowId[] | null>(null);
  // Reconcile removed/added IDs while retaining order across immutable value updates.
  React.useEffect(() => {
    setOrder((previous) => {
      if (!previous) return previous;
      const ids = applyRowOrder(rowOrderRows, previous, getRowId).map(getRowId);
      return ids.length === previous.length && ids.every((id, i) => id === previous[i]) ? previous : ids;
    });
  }, [rowOrderRows, getRowId]);
  const sorted = !!props.sortBy || (props.sortModel?.length ?? 0) > 0;
  const orderedItems = React.useMemo(
    () => order && !sorted && !props.windowed ? applyRowOrder(items, order, getRowId) : items,
    [items, order, getRowId, sorted, props.windowed],
  );
  const formulaRowMap = React.useMemo(() => {
    if (orderedItems === items) return props.formulaRowMap;
    const originalIndex = new Map(items.map((item, i) => [getRowId(item), i]));
    const sheetRows = orderedItems.map((item) => {
      const i = originalIndex.get(getRowId(item)) ?? -1;
      return i < 0 ? -1 : (props.formulaRowMap?.toSheetRow(i) ?? i);
    });
    const displayRows = new Map(sheetRows.map((row, i) => [row, i]));
    return {
      toSheetRow: (row: number) => sheetRows[row] ?? -1,
      toDisplayRow: (row: number) => displayRows.get(row) ?? -1,
    };
  }, [orderedItems, items, getRowId, props.formulaRowMap]);
  const applyOrder = React.useCallback((event: IRowOrderChange<T>) => {
    const current = order ? applyRowOrder(rowOrderRows, order, getRowId) : rowOrderRows;
    const data = orderDisplayedRows(current, event.rowIds, getRowId);
    setOrder(data.map(getRowId));
    onRowOrderChange?.({ ...event, data });
  }, [rowOrderRows, order, getRowId, onRowOrderChange]);

  return <Table {...gridProps} items={orderedItems} formulaRowMap={formulaRowMap}
    onRowOrderChange={applyOrder} useDragDrop={useGridDragDrop} />;
}
