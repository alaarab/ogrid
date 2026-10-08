// Table body with column virtualization support

import * as React from 'react';
import { partitionColumnsForVirtualization } from '../utils';
import { WindowedPlaceholderRow } from './WindowedPlaceholderRow';
import { GridRow } from './BaseGridRow';
import type { RowMergePlan, MergedCellRender, BaseGridRowProps } from './BaseGridRow';
import type { useColumnMeta } from '../hooks/useColumnMeta';
import type { GridRowProps } from './createOGrid';
import type { IColumnDef, WindowedDataState } from '../types';
import type { ICellConditionalFormat, IVisibleColumnRange, IMergeLayout, IHiddenGaps } from '@alaarab/ogrid-core';
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
  renderCellContent: (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number, cf?: ICellConditionalFormat) => React.ReactNode;
  handleSingleRowClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  handleRowCheckboxChange: (rowId: string | number, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  lastMouseShiftRef: React.MutableRefObject<boolean>;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowNumberOffset: number;
  /** Row-number label for a displayed row; defaults to rowNumberOffset + rowIndex + 1. */
  rowNumberOf?: (rowIndex: number) => number;
  /** aria-rowindex of the first data row minus 1 (header rows + page offset). */
  ariaRowIndexBase?: number;
  selectionRange: GridRowProps['selectionRange'];
  activeCell: GridRowProps['activeCell'];
  cutRange: GridRowProps['cutRange'];
  copyRange: GridRowProps['copyRange'];
  isDragging: boolean;
  editingCell: { rowId: string | number; columnId: string } | null;
  /** Roving focus: the one body cell with tabIndex 0 (see useGridCellFocus). */
  tabStopCell?: { rowIndex: number; columnIndex: number } | null;
  registerTabStop?: (el: HTMLElement | null) => void;
  /** Popover editor anchor and pending value; only the editing row receives them. */
  popoverAnchorEl?: HTMLElement | null;
  pendingEditorValue?: unknown;
  /** Formula recalculation counter; a change repaints every row. */
  formulaVersion?: number;
  /** Conditional format of a cell; a new function repaints every row. */
  conditionalFormat?: (item: T, columnId: string) => ICellConditionalFormat | undefined;
  pinnedColumns: Record<string, 'left' | 'right'>;
  rowNumWidth?: number;
  /** Merged cells resolved against the displayed rows and visible columns. */
  mergeLayout?: IMergeLayout | null;
  /** First N displayed rows stay visible below the header (always rendered). */
  frozenRows?: number;
  /** Height override for a row (resized rows); omit for fixed heights. */
  getRowHeight?: (rowId: string | number) => number | undefined;
  /** Virtual scroll: a row's height in the scroll geometry (sizes the spacers); defaults to `rowHeight`. */
  getRowSize?: (rowIndex: number) => number;
  /** Virtual scroll: ref callback measuring each rendered row (variable heights). */
  measureRowRef?: (el: HTMLElement | null) => void;
  /** Row-number resize handle pointer-down; omit to hide the handles. */
  onRowResizeStart?: (e: React.PointerEvent, rowId: string | number) => void;
  /** Pointer down on a row number cell: select the whole row. */
  onRowHeaderPointerDown?: (e: React.PointerEvent, rowIndex: number) => void;
  /** Render a drag handle on the row-number cell for row dragging. */
  rowDragging?: boolean;
  /** Start a row drag from the row-number handle. */
  onRowDragStart?: (e: React.DragEvent, rowIndex: number) => void;
  /** Where hidden rows sit (`allowHiding`); with `onUnhideRows`, row numbers show gap markers. */
  hiddenRowGaps?: IHiddenGaps<string | number> | null;
  onUnhideRows?: (rowIds: (string | number)[]) => void;
  /** Cell notes lookup (see BaseGridRowProps.getCellNote). */
  getCellNote?: (item: T, columnId: string) => import('../types').ICellNote | undefined;
  noteIdPrefix?: string;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

interface MergePlans {
  byRow: Map<number, RowMergePlan>;
  /** Row each merge is drawn from, keyed by `anchorRow:anchorCol` (data column). */
  drawRowOfAnchor: Map<string, number>;
}

/**
 * Which cells of the rendered rows/columns each merge draws from or covers.
 * A merge is drawn from its first rendered row and column, so a block cut by
 * the virtual row window or the column window shows the visible portion
 * (with its anchor's content) instead of disappearing or misaligning.
 */
function buildMergePlans(
  layout: IMergeLayout,
  items: readonly unknown[],
  visibleCols: readonly IColumnDef<unknown>[],
  renderedCols: readonly number[] | undefined,
  frozenCount: number,
  bodyStart: number,
  bodyEnd: number,
): MergePlans {
  const byRow = new Map<number, RowMergePlan>();
  const drawRowOfAnchor = new Map<string, number>();
  const colRendered = renderedCols ? new Set(renderedCols) : null;
  for (const m of layout.merges) {
    // Merges never cross the frozen boundary (resolveMergedCells clips them).
    const lo = m.startRow < frozenCount ? 0 : bodyStart;
    const hi = m.startRow < frozenCount ? frozenCount - 1 : bodyEnd;
    const r0 = Math.max(m.startRow, lo);
    const r1 = Math.min(m.endRow, hi);
    if (r0 > r1) continue;
    const cols: number[] = [];
    for (let c = m.startCol; c <= m.endCol; c++) if (!colRendered || colRendered.has(c)) cols.push(c);
    const anchorItem = items[m.startRow];
    const anchorColumn = visibleCols[m.startCol];
    if (cols.length === 0 || anchorItem === undefined || anchorColumn === undefined) continue;
    const firstCol = cols[0] as number;
    const draw: MergedCellRender = {
      rowSpan: r1 - r0 + 1,
      colSpan: cols.length,
      anchorRow: m.startRow,
      anchorCol: m.startCol,
      anchorItem,
      anchorColumn,
    };
    drawRowOfAnchor.set(`${m.startRow}:${m.startCol}`, r0);
    for (let r = r0; r <= r1; r++) {
      let plan = byRow.get(r);
      if (!plan) {
        plan = {};
        byRow.set(r, plan);
      }
      for (const c of cols) plan[c] = r === r0 && c === firstCol ? draw : null;
    }
  }
  return { byRow, drawRowOfAnchor };
}

export function BaseTableBody<T>(props: BaseTableBodyProps<T>) {
  const {
    virtualScrollEnabled, visibleRange, columnRange,
    items, windowed, rowHeight, getRowId, selectedRowIds, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset, rowNumberOf, ariaRowIndexBase,
    selectionRange, activeCell, cutRange, copyRange, isDragging,
    editingCell, tabStopCell, registerTabStop, popoverAnchorEl, pendingEditorValue, formulaVersion, conditionalFormat,
    pinnedColumns, rowNumWidth, mergeLayout, getRowHeight, getRowSize, measureRowRef, onRowResizeStart, getCellNote, noteIdPrefix, styles, primitives, onRowHeaderPointerDown,
    rowDragging, onRowDragStart,
  } = props;
  // Hidden-row markers need a row-number gutter to sit in.
  const rowGaps = hasRowNumbersCol && props.onUnhideRows ? props.hiddenRowGaps : null;
  const { Tbody } = primitives;
  const rowCount = windowed ? windowed.rowCount : items.length;
  const frozenCount = Math.max(0, Math.min(props.frozenRows ?? 0, rowCount));
  // Rows rendered below the frozen ones: the virtual window (minus frozen rows), or all.
  const virtualRows = virtualScrollEnabled || windowed != null;
  const bodyStart = virtualRows ? Math.max(visibleRange.startIndex, frozenCount) : frozenCount;
  const bodyEnd = virtualRows ? Math.min(visibleRange.endIndex, rowCount - 1) : rowCount - 1;

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

  const mergePlans = React.useMemo(
    () => mergeLayout
      ? buildMergePlans(mergeLayout, items, visibleCols as IColumnDef<unknown>[], globalColIndexMap, frozenCount, bodyStart, bodyEnd)
      : null,
    [mergeLayout, items, visibleCols, globalColIndexMap, frozenCount, bodyStart, bodyEnd]
  );
  // Interaction state a merged cell reads from rows the comparator doesn't check.
  const mergeStateKey = mergePlans
    ? [
        activeCell ? `${activeCell.rowIndex},${activeCell.columnIndex}` : '',
        selectionRange ? `${selectionRange.startRow},${selectionRange.startCol},${selectionRange.endRow},${selectionRange.endCol}` : '',
        cutRange ? `${cutRange.startRow},${cutRange.startCol},${cutRange.endRow},${cutRange.endCol}` : '',
        copyRange ? `${copyRange.startRow},${copyRange.startCol},${copyRange.endRow},${copyRange.endCol}` : '',
        isDragging ? '1' : '0',
        editingCell ? `${String(editingCell.rowId)},${editingCell.columnId}` : '',
      ].join('|')
    : undefined;
  // The tab stop of a merged cell sits in the row the merge is drawn from.
  const tabStopDrawRow = tabStopCell != null && mergePlans
    ? mergePlans.drawRowOfAnchor.get(`${tabStopCell.rowIndex}:${tabStopCell.columnIndex - (hasCheckboxCol ? 1 : 0) - (hasRowNumbersCol ? 1 : 0)}`)
    : undefined;

  const renderRow = (item: T, rowIndex: number) => {
    const rowIdStr = getRowId(item);
    const isEditingRow = editingCell != null && editingCell.rowId === rowIdStr;
    const mergePlan = mergePlans?.byRow.get(rowIndex);
    const tabStopHere = tabStopCell != null && (tabStopDrawRow != null ? tabStopDrawRow === rowIndex : tabStopCell.rowIndex === rowIndex);
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
        rowNumber={hasRowNumbersCol && rowNumberOf ? rowNumberOf(rowIndex) : undefined}
        ariaRowIndexBase={ariaRowIndexBase}
        selectionRange={selectionRange}
        activeCell={activeCell}
        cutRange={cutRange}
        copyRange={copyRange}
        isDragging={isDragging}
        editingRowId={editingCell?.rowId ?? null}
        popoverAnchorEl={isEditingRow ? popoverAnchorEl : undefined}
        pendingEditorValue={isEditingRow ? pendingEditorValue : undefined}
        formulaVersion={formulaVersion}
        conditionalFormat={conditionalFormat as GridRowProps['conditionalFormat']}
        tabStopColumn={tabStopHere && tabStopCell ? tabStopCell.columnIndex : -1}
        mergePlan={mergePlan}
        mergeStateKey={mergePlan ? mergeStateKey : undefined}
        frozen={rowIndex < frozenCount ? (rowIndex === frozenCount - 1 ? 'last' : 'inner') : undefined}
        registerTabStop={registerTabStop}
        leftSpacerWidth={leftSpacerWidth}
        rightSpacerWidth={rightSpacerWidth}
        globalColIndexMap={globalColIndexMap}
        rowNumWidth={rowNumWidth}
        customRowHeight={getRowHeight?.(rowIdStr)}
        measureRowRef={virtualScrollEnabled ? measureRowRef : undefined}
        onRowResizeStart={onRowResizeStart}
        onRowHeaderPointerDown={onRowHeaderPointerDown}
        rowDragging={rowDragging}
        onRowDragStart={onRowDragStart}
        hiddenRowsBefore={rowGaps?.before.get(rowIdStr)}
        hiddenRowsAfter={rowGaps && rowGaps.lastShown === rowIdStr ? rowGaps.after : undefined}
        onUnhideRows={rowGaps ? props.onUnhideRows : undefined}
        getCellNote={getCellNote as BaseGridRowProps['getCellNote']}
        noteIdPrefix={noteIdPrefix}
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
  const renderWindowedRows = (from: number, to: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    if (!windowed) return out;
    for (let i = from; i <= to; i++) {
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

  // Frozen rows render ahead of the window and take its place in the scroll
  // geometry: the spacers shrink by the frozen rows' height so the total holds.
  // Rows can differ in height (manual heights, wrapped text), so sum them.
  const sizeOfRows = (from: number, to: number): number => {
    if (to < from) return 0;
    if (!getRowSize) return (to - from + 1) * rowHeight;
    let total = 0;
    for (let i = from; i <= to; i++) total += getRowSize(i);
    return total;
  };
  const topSpacer = virtualScrollEnabled
    ? Math.max(0, visibleRange.offsetTop + sizeOfRows(visibleRange.startIndex, bodyStart - 1) - sizeOfRows(0, frozenCount - 1))
    : 0;
  const bottomSpacer = virtualScrollEnabled
    ? Math.max(0, visibleRange.offsetBottom - sizeOfRows(visibleRange.endIndex + 1, frozenCount - 1))
    : 0;

  return (
    <Tbody>
      {virtualRows && frozenCount > 0 && (windowed
        ? renderWindowedRows(0, frozenCount - 1)
        : items.slice(0, frozenCount).map((item, i) => renderRow(item, i)))}
      {virtualScrollEnabled && topSpacer > 0 && (
        <tr style={{ height: topSpacer }} aria-hidden />
      )}
      {windowed
        ? renderWindowedRows(bodyStart, visibleRange.endIndex)
        : virtualScrollEnabled
        ? items.slice(bodyStart, visibleRange.endIndex + 1).map((item, i) =>
            renderRow(item, bodyStart + i)
          )
        : items.map((item, rowIndex) => renderRow(item, rowIndex))
      }
      {virtualScrollEnabled && bottomSpacer > 0 && (
        <tr style={{ height: bottomSpacer }} aria-hidden />
      )}
    </Tbody>
  );
}
