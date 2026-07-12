// Table body with column virtualization support

import * as React from 'react';
import { partitionColumnsForVirtualization } from '../utils';
import { WindowedPlaceholderRow } from './WindowedPlaceholderRow';
import { GridRow } from './BaseGridRow';
import type { useColumnMeta } from '../hooks/useColumnMeta';
import type { GridRowProps } from './createOGrid';
import type { IColumnDef, WindowedDataState } from '../types';
import type { IVisibleColumnRange } from '@alaarab/ogrid-core';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

export interface BaseTableBodyProps<T> {
  virtualScrollEnabled: boolean;
  visibleRange: { startIndex: number; endIndex: number; offsetTop: number; offsetBottom: number };
  columnRange: IVisibleColumnRange | null;
  items: T[];
  /** Windowed (lazy) row access. When set, rows are read by index, not from `items`. */
  windowed?: WindowedDataState<T> | null;
  /** Fixed row height (px) — used to size windowed loading/error placeholder rows. */
  rowHeight: number;
  getRowId: (item: T) => string | number;
  selectedRowIds: Set<string | number>;
  visibleCols: IColumnDef<T>[];
  columnMeta: ReturnType<typeof useColumnMeta>;
  renderCellContent: (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number) => React.ReactNode;
  handleSingleRowClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  handleRowCheckboxChange: (rowId: string | number, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  lastMouseShiftRef: React.MutableRefObject<boolean>;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowNumberOffset: number;
  selectionRange: GridRowProps['selectionRange'];
  activeCell: GridRowProps['activeCell'];
  cutRange: GridRowProps['cutRange'];
  copyRange: GridRowProps['copyRange'];
  isDragging: boolean;
  editingCell: { rowId: string | number; columnId: string } | null;
  pinnedColumns: Record<string, 'left' | 'right'>;
  rowNumWidth?: number;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

export function BaseTableBody<T>(props: BaseTableBodyProps<T>) {
  const {
    virtualScrollEnabled, visibleRange, columnRange,
    items, windowed, rowHeight, getRowId, selectedRowIds, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
    selectionRange, activeCell, cutRange, copyRange, isDragging,
    editingCell, pinnedColumns, rowNumWidth, styles, primitives,
  } = props;
  const { Tbody } = primitives;

  // Partition columns when column virtualization is active
  const partition = React.useMemo(() => {
    if (!columnRange) return null;
    // Cast bridges core's IColumnDef<T> to react's IColumnDef<T> — react extends
    // core but TypeScript sees them as different types from different packages.
    return partitionColumnsForVirtualization<T>(
      visibleCols as Parameters<typeof partitionColumnsForVirtualization<T>>[0],
      columnRange,
      pinnedColumns,
    ) as ReturnType<typeof partitionColumnsForVirtualization<T>> & {
      pinnedLeft: IColumnDef<T>[];
      virtualizedUnpinned: IColumnDef<T>[];
      pinnedRight: IColumnDef<T>[];
    };
  }, [visibleCols, columnRange, pinnedColumns]);

  // Build global column index map: maps local index in partitioned array to global index in visibleCols
  const { rowCols, globalColIndexMap, leftSpacerWidth, rightSpacerWidth } = React.useMemo(() => {
    if (!partition) {
      return { rowCols: visibleCols, globalColIndexMap: undefined, leftSpacerWidth: undefined, rightSpacerWidth: undefined };
    }
    const combined: IColumnDef<T>[] = [...partition.pinnedLeft, ...partition.virtualizedUnpinned, ...partition.pinnedRight];
    const idxMap = combined.map(col => visibleCols.indexOf(col));
    return {
      rowCols: combined,
      globalColIndexMap: idxMap,
      leftSpacerWidth: partition.leftSpacerWidth,
      rightSpacerWidth: partition.rightSpacerWidth,
    };
  }, [partition, visibleCols]);

  const renderRow = (item: T, rowIndex: number) => {
    const rowIdStr = getRowId(item);
    return (
      <GridRow
        key={rowIdStr}
        item={item}
        rowIndex={rowIndex}
        rowId={rowIdStr}
        isSelected={selectedRowIds.has(rowIdStr)}
        visibleCols={rowCols as IColumnDef<unknown>[]}
        columnMeta={columnMeta}
        renderCellContent={renderCellContent as GridRowProps['renderCellContent']}
        handleSingleRowClick={handleSingleRowClick}
        handleRowCheckboxChange={handleRowCheckboxChange}
        lastMouseShiftRef={lastMouseShiftRef}
        hasCheckboxCol={hasCheckboxCol}
        hasRowNumbersCol={hasRowNumbersCol}
        rowNumberOffset={rowNumberOffset}
        selectionRange={selectionRange}
        activeCell={activeCell}
        cutRange={cutRange}
        copyRange={copyRange}
        isDragging={isDragging}
        editingRowId={editingCell?.rowId ?? null}
        leftSpacerWidth={leftSpacerWidth}
        rightSpacerWidth={rightSpacerWidth}
        globalColIndexMap={globalColIndexMap}
        rowNumWidth={rowNumWidth}
        styles={styles}
        primitives={primitives}
      />
    );
  };

  // Columns a normal row spans — sizes the windowed loading/error placeholders.
  const placeholderColSpan =
    (hasCheckboxCol ? 1 : 0) +
    (hasRowNumbersCol ? 1 : 0) +
    rowCols.length +
    (leftSpacerWidth ? 1 : 0) +
    (rightSpacerWidth ? 1 : 0);

  // Windowed (lazy) data source: render the visible index range, reading each
  // row from the cache. Not-yet-loaded rows render a placeholder of identical
  // height so the scroll geometry holds while data streams in.
  const renderWindowedRows = (): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    if (!windowed) return out;
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      const slot = windowed.getRow(i);
      if (slot.status === 'loaded') {
        out.push(renderRow(slot.row, i));
      } else {
        out.push(
          <WindowedPlaceholderRow
            key={`w-${i}`}
            status={slot.status}
            rowIndex={i}
            colSpan={placeholderColSpan}
            rowHeight={rowHeight}
            onRetry={slot.status === 'error' ? () => windowed.retryRow(i) : undefined}
          />
        );
      }
    }
    return out;
  };

  return (
    <Tbody>
      {virtualScrollEnabled && visibleRange.offsetTop > 0 && (
        <tr style={{ height: visibleRange.offsetTop }} aria-hidden />
      )}
      {windowed
        ? renderWindowedRows()
        : virtualScrollEnabled
        ? items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, i) =>
            renderRow(item, visibleRange.startIndex + i)
          )
        : items.map((item, rowIndex) => renderRow(item, rowIndex))
      }
      {virtualScrollEnabled && visibleRange.offsetBottom > 0 && (
        <tr style={{ height: visibleRange.offsetBottom }} aria-hidden />
      )}
    </Tbody>
  );
}
