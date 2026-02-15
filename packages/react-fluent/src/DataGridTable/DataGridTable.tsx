import * as React from 'react';
import { useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridBody,
  DataGridCell,
  TableColumnDefinition,
  createTableColumn,
  TableColumnSizingOptions,
  Spinner,
  Checkbox,
  Popover,
  PopoverSurface,
} from '@fluentui/react-components';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { ColumnHeaderMenu } from '../ColumnHeaderMenu';
import { InlineCellEditor, type InlineCellEditorProps } from './InlineCellEditor';
import { StatusBar } from './StatusBar';
import { GridContextMenu } from './GridContextMenu';
import type {
  IColumnDef,
  ICellEditorProps,
  IOGridDataGridProps,
} from '@alaarab/ogrid-react';
import {
  useDataGridState,
  useColumnReorder,
  useVirtualScroll,
  useLatestRef,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  buildHeaderRows,
  MarchingAntsOverlay,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  areGridRowPropsEqual,
  CellErrorBoundary,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
} from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';


// Module-scope stable constants (avoid per-render allocations)
const gridRootStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
};

const CURSOR_CELL_STYLE: React.CSSProperties = { cursor: 'cell' };
const NUMERIC_STYLE: React.CSSProperties = { justifyContent: 'flex-end', textAlign: 'right' };
const BOOLEAN_STYLE: React.CSSProperties = { justifyContent: 'center', textAlign: 'center' };
const EDITABLE_NUMERIC_STYLE: React.CSSProperties = { cursor: 'cell', justifyContent: 'flex-end', textAlign: 'right' };
const EDITABLE_BOOLEAN_STYLE: React.CSSProperties = { cursor: 'cell', justifyContent: 'center', textAlign: 'center' };
const POPOVER_ANCHOR_STYLE: React.CSSProperties = { minHeight: '100%', minWidth: 40 };
const PREVENT_DEFAULT = (e: React.MouseEvent) => { e.preventDefault(); };
const NOOP = () => {};

// --- Memoized row component (skips re-render for rows unaffected by selection changes) ---

interface GridRowProps {
  item: unknown;
  rowId: string | number;
  rowIndex: number;
  isSelected: boolean;
  hasCheckboxCol: boolean;
  cellClassMap: Record<string, string>;
  handleSingleRowClick: (rowId: string | number) => void;
  // Comparator-only props (drive re-render decisions, not used in render body)
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  cutRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  copyRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isDragging: boolean;
  editingRowId: string | number | null;
}

function GridRowInner(props: GridRowProps) {
  const { item, rowId, rowIndex, isSelected, cellClassMap, handleSingleRowClick, activeCell } = props;

  const rowClassName = `${isSelected ? styles.selectedRow : ''}${activeCell !== null && rowIndex === activeCell.rowIndex ? (isSelected ? ` ${styles.activeRow}` : styles.activeRow) : ''}` || undefined;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <DataGridRow<any>
      className={rowClassName}
      onClick={() => handleSingleRowClick(rowId)}
      focusMode="composite"
    >
      {({ renderCell, columnId }: { renderCell: (item: unknown) => React.ReactNode; columnId: string | number }) => (
        <DataGridCell className={cellClassMap[String(columnId)] || undefined}>
          {renderCell(item)}
        </DataGridCell>
      )}
    </DataGridRow>
  );
}

const GridRow = React.memo(GridRowInner, areGridRowPropsEqual);

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels, pinning } = state;
  const { flatColumns, visibleCols, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset, rowIndexByRowId, containerWidth, minTableWidth, desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides } = layout;
  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
  const { activeCell, setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging } = interaction;
  const handlePasteVoid = useCallback(() => { void handlePaste(); }, [handlePaste]);
  const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
  const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError } = viewModels;

  const {
    items,
    columns,
    getRowId,
    emptyState,
    layoutMode = 'fill',
    rowSelection = 'none',
    freezeRows,
    freezeCols,
    suppressHorizontalScroll,
    isLoading = false,
    loadingMessage = 'Loading\u2026',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    visibleColumns,
    columnOrder,
    onColumnOrderChange,
    columnReorder,
    virtualScroll,
    density = 'normal',
    pinnedColumns,
    currentPage = 1,
    pageSize: propPageSize = 25,
  } = props;

  // Calculate row number offset for pagination
  const rowNumberOffset = hasRowNumbersCol ? (currentPage - 1) * propPageSize : 0;

  // Memoize header rows (recursive tree traversal)
  const headerRows = useMemo(() => buildHeaderRows(columns, visibleColumns), [columns, visibleColumns]);
  const hasGroupHeaders = headerRows.length > 1;

  const fitToContent = layoutMode === 'content';

  const { isDragging: isReorderDragging, dropIndicatorX, handleHeaderMouseDown } = useColumnReorder<T>({
    columns: visibleCols as IColumnDef<T>[],
    columnOrder,
    onColumnOrderChange,
    enabled: columnReorder === true,
    pinnedColumns,
    wrapperRef,
  });

  const virtualScrollEnabled = virtualScroll?.enabled === true;
  const virtualRowHeight = virtualScroll?.rowHeight ?? 36;
  const { visibleRange } = useVirtualScroll({
    totalRows: items.length,
    rowHeight: virtualRowHeight,
    enabled: virtualScrollEnabled,
    overscan: virtualScroll?.overscan,
    containerRef: wrapperRef,
  });

  const columnSizingOptions: TableColumnSizingOptions = useMemo(() => {
    const acc: Record<string, { minWidth: number; defaultWidth?: number; idealWidth?: number }> = {};

    if (hasCheckboxCol) {
      acc['__selection__'] = { minWidth: CHECKBOX_COLUMN_WIDTH, defaultWidth: CHECKBOX_COLUMN_WIDTH, idealWidth: CHECKBOX_COLUMN_WIDTH };
    }

    if (hasRowNumbersCol) {
      acc['__row_number__'] = { minWidth: ROW_NUMBER_COLUMN_WIDTH, defaultWidth: ROW_NUMBER_COLUMN_WIDTH, idealWidth: ROW_NUMBER_COLUMN_WIDTH };
    }

    visibleCols.forEach((c) => {
      const minW = c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
      const defaultW = c.defaultWidth ?? 120;
      const base = c.idealWidth ?? Math.max(minW, defaultW);

      const override = columnSizingOverrides[c.columnId];
      const w = override ? Math.max(minW, override.widthPx) : base;

      acc[c.columnId] = {
        minWidth: minW,
        defaultWidth: w,
        idealWidth: w,
      };
    });

    return acc;
  }, [visibleCols, columnSizingOverrides, hasCheckboxCol, hasRowNumbersCol]);

  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);

  // Pre-compute column class maps (avoids per-cell .filter(Boolean).join(' '))
  const { cellClassMap, headerClassMap } = useMemo(() => {
    const cm: Record<string, string> = {};
    const hm: Record<string, string> = {};

    for (let i = 0; i < visibleCols.length; i++) {
      const col = visibleCols[i];
      const isFreezeCol = freezeCols != null && freezeCols >= 1 && i < freezeCols;
      const isPinnedLeft = col.pinned === 'left';
      const isPinnedRight = col.pinned === 'right';
      const parts: string[] = [];
      if (isFreezeCol) parts.push(styles.freezeCol);
      if (isFreezeCol && i === 0) parts.push(styles.freezeColFirst);
      if (isPinnedLeft) { parts.push(styles.pinnedCell); parts.push(styles.pinnedLeft); }
      if (isPinnedRight) { parts.push(styles.pinnedCell); parts.push(styles.pinnedRight); }
      cm[col.columnId] = parts.join(' ');
      hm[col.columnId] = parts.join(' ');
    }

    cm['__selection__'] = styles.selectionCellWrapper;
    hm['__selection__'] = styles.selectionHeaderCellWrapper;

    return { cellClassMap: cm, headerClassMap: hm };
  }, [visibleCols, freezeCols]);

  // Refs for volatile state (read inside fluentColumns render closures without adding to deps)
  const cellDescriptorInputRef = useLatestRef(cellDescriptorInput);
  const selectedRowIdsRef = useLatestRef(selectedRowIds);
  const activeCellRef = useLatestRef(activeCell);
  const pendingEditorValueRef = useLatestRef(pendingEditorValue);
  const popoverAnchorElRef = useLatestRef(popoverAnchorEl);
  const allSelectedRef = useLatestRef(allSelected);
  const someSelectedRef = useLatestRef(someSelected);
  // Callback refs — stabilize fluentColumns memo (these change identity on state updates
  // but the columns structure doesn't need rebuilding for that)
  const headerFilterInputRef = useLatestRef(headerFilterInput);
  const commitCellEditRef = useLatestRef(commitCellEdit);
  const cancelPopoverEditRef = useLatestRef(cancelPopoverEdit);
  const handleCellMouseDownRef = useLatestRef(handleCellMouseDown);
  const handleFillHandleMouseDownRef = useLatestRef(handleFillHandleMouseDown);
  const handleCellContextMenuRef = useLatestRef(handleCellContextMenu);
  const setActiveCellRef = useLatestRef(setActiveCell);
  const setEditingCellRef = useLatestRef(setEditingCell);
  const setPendingEditorValueRef = useLatestRef(setPendingEditorValue);
  const handleSelectAllRef = useLatestRef(handleSelectAll);
  const handleRowCheckboxChangeRef = useLatestRef(handleRowCheckboxChange);
  const rowIndexByRowIdRef = useLatestRef(rowIndexByRowId);
  const handleHeaderMouseDownRef = useLatestRef(handleHeaderMouseDown);
  const isReorderDraggingRef = useLatestRef(isReorderDragging);

  const fluentColumns = useMemo<TableColumnDefinition<T>[]>(() => {
    const dataCols: TableColumnDefinition<T>[] = visibleCols.map((col, colIdx) =>
      createTableColumn<T>({
        columnId: col.columnId,
        compare: col.compare ?? (() => 0),
        renderHeaderCell: () => (
          <div
            data-column-id={col.columnId}
            style={columnReorder ? { cursor: isReorderDraggingRef.current ? 'grabbing' : 'grab' } : undefined}
            onMouseDown={columnReorder ? (e) => handleHeaderMouseDownRef.current(col.columnId, e) : undefined}
          >
            <div className={styles.headerCellContent}>
              <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInputRef.current)} />
              <button
                className={styles.headerMenuTrigger}
                onClick={(e) => {
                  e.stopPropagation();
                  pinning.headerMenu.open(col.columnId, e.currentTarget);
                }}
                aria-label="Column options"
                title="Column options"
              >
                ⋮
              </button>
            </div>
          </div>
        ),
        renderCell: (item) => {
          const rowId = getRowId(item);
          const rowIndex = rowIndexByRowIdRef.current.get(rowId) ?? -1;
          const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current);

          let cellContent: React.ReactNode;

          if (descriptor.mode === 'editing-inline') {
            cellContent = <InlineCellEditor<T> {...buildInlineEditorProps(item, col, descriptor, { commitCellEdit: commitCellEditRef.current, setEditingCell: setEditingCellRef.current }) as InlineCellEditorProps<T>} />;
          } else if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
            const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValueRef.current, { setPendingEditorValue: setPendingEditorValueRef.current, commitCellEdit: commitCellEditRef.current, cancelPopoverEdit: cancelPopoverEditRef.current }) as ICellEditorProps<T>;
            const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
            cellContent = (
              <>
                <div
                  ref={(el) => { if (el) setPopoverAnchorEl(el); }}
                  style={POPOVER_ANCHOR_STYLE}
                  aria-hidden
                />
                <Popover
                  open={!!popoverAnchorElRef.current}
                  onOpenChange={(_: any, data: any) => { if (!data.open) cancelPopoverEditRef.current(); }}
                  positioning={{ target: popoverAnchorElRef.current ?? undefined }}
                >
                  <PopoverSurface>
                    <CustomEditor {...editorProps} />
                  </PopoverSurface>
                </Popover>
              </>
            );
          } else {
            const content = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
            const cellStyle = resolveCellStyle(col, item);
            const styledContent = cellStyle ? <span style={cellStyle}>{content}</span> : content;

            const cellClassNames = `${styles.cellContent}${descriptor.isActive && !descriptor.isInRange ? ` ${styles.activeCellContent}` : ''}${descriptor.isInRange ? ` ${styles.cellInRange}` : ''}${descriptor.isInCutRange ? ` ${styles.cellCut}` : ''}${descriptor.isInCopyRange ? ` ${styles.cellCopied}` : ''}`;

            const colType = col.type;
            const interactionProps = getCellInteractionProps(descriptor, col.columnId, { handleCellMouseDown: handleCellMouseDownRef.current, setActiveCell: setActiveCellRef.current, setEditingCell: setEditingCellRef.current, handleCellContextMenu: handleCellContextMenuRef.current });

            // Select stable style constant by type + editability
            const computedStyle = descriptor.canEditAny
              ? (colType === 'numeric' ? EDITABLE_NUMERIC_STYLE : colType === 'boolean' ? EDITABLE_BOOLEAN_STYLE : CURSOR_CELL_STYLE)
              : (colType === 'numeric' ? NUMERIC_STYLE : colType === 'boolean' ? BOOLEAN_STYLE : undefined);

            cellContent = (
              <div
                className={cellClassNames}
                {...interactionProps}
                style={computedStyle}
              >
                {styledContent}
                {descriptor.canEditAny && descriptor.isSelectionEndCell && (
                  <div
                    className={styles.fillHandle}
                    onMouseDown={(e) => handleFillHandleMouseDownRef.current(e)}
                    aria-label="Fill handle"
                  />
                )}
              </div>
            );
          }

          return (
            <CellErrorBoundary key={`${rowId}-${col.columnId}`} onError={onCellError}>
              {cellContent}
            </CellErrorBoundary>
          );
        },
      })
    );

    if (hasCheckboxCol) {
      const checkboxCol = createTableColumn<T>({
        columnId: '__selection__',
        compare: () => 0,
        renderHeaderCell: () => (
          <div className={styles.selectionHeaderCell}>
            <Checkbox
              checked={allSelectedRef.current ? true : someSelectedRef.current ? 'mixed' : false}
              onChange={(_, data) => handleSelectAllRef.current(!!data.checked)}
              aria-label="Select all rows"
            />
          </div>
        ),
        renderCell: (item) => {
          const rowId = getRowId(item);
          const rowIndex = rowIndexByRowIdRef.current.get(rowId) ?? -1;
          const isChecked = selectedRowIdsRef.current.has(rowId);
          const ac = activeCellRef.current;
          const isActive = ac?.rowIndex === rowIndex && ac?.columnIndex === 0;
          return (
            <div
              className={`${styles.selectionCell} ${isActive ? styles.activeCellContent : ''}`}
              data-row-index={rowIndex}
              data-col-index={0}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCellRef.current({ rowIndex, columnIndex: 0 });
              }}
            >
              <Checkbox
                checked={isChecked}
                onChange={(e, data) => {
                  handleRowCheckboxChangeRef.current(rowId, !!data.checked, rowIndex, (e.nativeEvent as MouseEvent).shiftKey);
                }}
                aria-label={`Select row ${rowIndex + 1}`}
              />
            </div>
          );
        },
      });
      const cols = [checkboxCol];
      if (hasRowNumbersCol) {
        const rowNumberCol = createTableColumn<T>({
          columnId: '__row_number__',
          compare: () => 0,
          renderHeaderCell: () => (
            <div className={styles.rowNumberHeaderCell}>#</div>
          ),
          renderCell: (item) => {
            const rowId = getRowId(item);
            const rowIndex = rowIndexByRowIdRef.current.get(rowId) ?? -1;
            return (
              <div className={styles.rowNumberCell}>
                {rowNumberOffset + rowIndex + 1}
              </div>
            );
          },
        });
        cols.push(rowNumberCol);
      }
      return [...cols, ...dataCols];
    }

    if (hasRowNumbersCol) {
      const rowNumberCol = createTableColumn<T>({
        columnId: '__row_number__',
        compare: () => 0,
        renderHeaderCell: () => (
          <div className={styles.rowNumberHeaderCell}>#</div>
        ),
        renderCell: (item) => {
          const rowId = getRowId(item);
          const rowIndex = rowIndexByRowIdRef.current.get(rowId) ?? -1;
          return (
            <div className={styles.rowNumberCell}>
              {rowNumberOffset + rowIndex + 1}
            </div>
          );
        },
      });
      return [rowNumberCol, ...dataCols];
    }

    return dataCols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCols, hasCheckboxCol, hasRowNumbersCol, getRowId, setPopoverAnchorEl, columnReorder, rowNumberOffset]); // All volatile state/callbacks read via refs

  // Stable row-click handler
  const handleSingleRowClick = useCallback((rowId: string | number) => {
    if (rowSelection !== 'single') return;
    const ids = selectedRowIdsRef.current;
    updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedRowIdsRef is a stable ref
  }, [rowSelection, updateSelection]);

  // Stable getRowId wrapper for Fluent DataGrid
  const fluentGetRowId = useCallback((item: T) => String(getRowId(item)), [getRowId]);

  // Double-click to auto-fit column width
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const onDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.fui-TableResizeHandle')) return;

      const headerCell = target.closest('[role="columnheader"]') as HTMLElement | null;
      if (!headerCell) return;

      const colId = headerCell.querySelector('[data-column-id]')?.getAttribute('data-column-id');
      if (!colId) return;

      const label = headerCell.querySelector('[data-header-label]') as HTMLElement | null;
      const labelWidth = label ? label.scrollWidth : 0;

      const EXTRA_PX = 44;
      const MAX_PX = 520;

      const colDef = flatColumns.find((c) => c.columnId === colId);
      const minW = colDef?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;

      const desired = Math.min(MAX_PX, Math.max(minW, Math.ceil(labelWidth + EXTRA_PX)));

      setColumnSizingOverrides((prev) => ({
        ...prev,
        [colId]: { widthPx: desired },
      }));

      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('dblclick', onDblClick, true);
    return () => root.removeEventListener('dblclick', onDblClick, true);
  }, [flatColumns, setColumnSizingOverrides]);

  // Sync Fluent's internal resize state back to our React state so that
  // re-renders (e.g. on cell click) don't reset column widths.
  const handleColumnResize = useCallback(
    (_e: unknown, data: { columnId: string | number; width: number }) => {
      setColumnSizingOverrides((prev) => ({
        ...prev,
        [String(data.columnId)]: { widthPx: data.width },
      }));
    },
    [setColumnSizingOverrides]
  );

  return (
    <div style={gridRootStyle}>
      <div
        ref={wrapperRef}
        tabIndex={0}
        className={`${styles.tableWrapper} ${rowSelection !== 'none' ? styles.selectableGrid : ''} ${styles[`density-${density}`] || ''}`}
        role="region"
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
        aria-labelledby={ariaLabelledBy}
        data-empty={showEmptyInGrid ? 'true' : undefined}
        data-auto-fit={layoutMode === 'fill' && !allowOverflowX ? 'true' : undefined}
        data-column-count={totalColCount}
        data-freeze-rows={freezeRows != null && freezeRows >= 1 ? freezeRows : undefined}
        data-freeze-cols={freezeCols != null && freezeCols >= 1 ? freezeCols : undefined}
        data-overflow-x={allowOverflowX ? 'true' : 'false'}
        data-container-width={containerWidth}
        data-min-table-width={Math.round(minTableWidth)}
        data-has-selection={rowSelection !== 'none' ? 'true' : undefined}
        onContextMenu={PREVENT_DEFAULT}
        style={{
          ['--data-table-column-count' as string]: totalColCount,
          ['--data-table-width' as string]: showEmptyInGrid
            ? '100%'
            : allowOverflowX
              ? 'fit-content'
              : fitToContent
                ? 'fit-content'
                : '100%',
          ['--data-table-min-width' as string]: showEmptyInGrid
            ? '100%'
            : allowOverflowX
              ? 'max-content'
              : fitToContent
                ? 'max-content'
                : '100%',
        }}
        onKeyDown={handleGridKeyDown}
      >
        <div className={styles.tableScrollContent}>
        <div className={isLoading && items.length > 0 ? styles.loadingDimmed : undefined}>
          <div className={styles.tableWidthAnchor} ref={tableContainerRef}>
              {virtualScrollEnabled && visibleRange.offsetTop > 0 && (
                <div style={{ height: visibleRange.offsetTop }} aria-hidden />
              )}
              <DataGrid
                items={virtualScrollEnabled ? items.slice(visibleRange.startIndex, visibleRange.endIndex + 1) : items}
                columns={fluentColumns}
                resizableColumns
                resizableColumnsOptions={{ autoFitColumns: layoutMode === 'fill' && !allowOverflowX }}
                columnSizingOptions={columnSizingOptions}
                onColumnResize={handleColumnResize}
                getRowId={fluentGetRowId}
                focusMode="composite"
                className={styles.dataGrid}
              >
                <DataGridHeader
                  className={styles.stickyHeader}
                >
                  {hasGroupHeaders && headerRows.slice(0, -1).map((row, rowIdx) => (
                    <tr key={`group-${rowIdx}`} className={styles.groupHeaderRow}>
                      {rowIdx === 0 && hasCheckboxCol && (
                        <th rowSpan={headerRows.length - 1} style={{ width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH }} />
                      )}
                      {rowIdx === 0 && hasRowNumbersCol && (
                        <th rowSpan={headerRows.length - 1} style={{ width: ROW_NUMBER_COLUMN_WIDTH, minWidth: ROW_NUMBER_COLUMN_WIDTH }} />
                      )}
                      {row.map((cell, cellIdx) => {
                        if (cell.isGroup) {
                          return (
                            <th
                              key={cellIdx}
                              colSpan={cell.colSpan}
                              className={styles.groupHeaderCell}
                              scope="colgroup"
                            >
                              {cell.label}
                            </th>
                          );
                        }
                        return (
                          <th
                            key={cellIdx}
                            rowSpan={headerRows.length - rowIdx}
                            className={styles.leafHeaderCellSpan}
                            scope="col"
                          >
                            {cell.columnDef?.name}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                  <DataGridRow focusMode="composite">
                    {({ renderHeaderCell, columnId }) => (
                      <DataGridHeaderCell
                        className={headerClassMap[String(columnId)] || undefined}
                        focusMode="composite"
                      >
                        {renderHeaderCell()}
                      </DataGridHeaderCell>
                    )}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<T>>
                  {({ item }) => {
                    const rowId = getRowId(item);
                    const rowIndex = rowIndexByRowId.get(rowId) ?? -1;
                    return (
                      <GridRow
                        key={rowId}
                        item={item}
                        rowId={rowId}
                        rowIndex={rowIndex}
                        isSelected={selectedRowIds.has(rowId)}
                        hasCheckboxCol={hasCheckboxCol}
                        cellClassMap={cellClassMap}
                        handleSingleRowClick={handleSingleRowClick}
                        selectionRange={selectionRange}
                        activeCell={activeCell}
                        cutRange={cutRange}
                        copyRange={copyRange}
                        isDragging={isDragging}
                        editingRowId={editingCell?.rowId ?? null}
                      />
                    );
                  }}
                </DataGridBody>
              </DataGrid>
              {virtualScrollEnabled && visibleRange.offsetBottom > 0 && (
                <div style={{ height: visibleRange.offsetBottom }} aria-hidden />
              )}
              {isReorderDragging && dropIndicatorX != null && (
                <div
                  className={styles.dropIndicator}
                  style={{ left: dropIndicatorX - (wrapperRef.current?.getBoundingClientRect().left ?? 0) }}
                />
              )}
              <MarchingAntsOverlay
                containerRef={tableContainerRef}
                selectionRange={selectionRange}
                copyRange={copyRange}
                cutRange={cutRange}
                colOffset={colOffset}
                items={items}
                visibleColumns={visibleColumns}
                columnSizingOverrides={columnSizingOverrides}
                columnOrder={columnOrder}
              />
              {showEmptyInGrid && emptyState && (
                <div className={styles.emptyStateInGrid}>
                  <div className={styles.emptyStateInGridMessageSticky}>
                    {emptyState.render ? (
                      emptyState.render()
                    ) : (
                      <>
                        <span className={styles.emptyStateInGridIcon} aria-hidden>
                          📋
                        </span>
                        <div className={styles.emptyStateInGridTitle}>No results found</div>
                        <div className={styles.emptyStateInGridMessage}>
                          {emptyState.message != null ? (
                            emptyState.message
                          ) : emptyState.hasActiveFilters ? (
                            <>
                              No items match your current filters. Try adjusting your search or{' '}
                              <button type="button" className={styles.emptyStateInGridLink} onClick={emptyState.onClearAll}>
                                clear all filters
                              </button>{' '}
                              to see all items.
                            </>
                          ) : (
                            'There are no items available at this time.'
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

        {menuPosition &&
          createPortal(
            <GridContextMenu
              x={menuPosition.x}
              y={menuPosition.y}
              hasSelection={hasCellSelection}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={onUndo ?? NOOP}
              onRedo={onRedo ?? NOOP}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePasteVoid}
              onSelectAll={handleSelectAllCells}
              onClose={closeContextMenu}
            />,
            document.body
          )}

        {createPortal(
          <ColumnHeaderMenu
            isOpen={pinning.headerMenu.isOpen}
            anchorElement={pinning.headerMenu.anchorElement}
            onClose={pinning.headerMenu.close}
            onPinLeft={pinning.headerMenu.handlePinLeft}
            onPinRight={pinning.headerMenu.handlePinRight}
            onUnpin={pinning.headerMenu.handleUnpin}
            onSortAsc={pinning.headerMenu.handleSortAsc}
            onSortDesc={pinning.headerMenu.handleSortDesc}
            onClearSort={pinning.headerMenu.handleClearSort}
            onAutosizeThis={pinning.headerMenu.handleAutosizeThis}
            onAutosizeAll={pinning.headerMenu.handleAutosizeAll}
            canPinLeft={pinning.headerMenu.canPinLeft}
            canPinRight={pinning.headerMenu.canPinRight}
            canUnpin={pinning.headerMenu.canUnpin}
            currentSort={pinning.headerMenu.currentSort}
            isSortable={pinning.headerMenu.isSortable}
            isResizable={pinning.headerMenu.isResizable}
          />,
          document.body
        )}
      </div>
      {statusBarConfig && (
        <StatusBar
          totalCount={statusBarConfig.totalCount}
          filteredCount={statusBarConfig.filteredCount}
          selectedCount={statusBarConfig.selectedCount ?? selectedRowIds.size}
          selectedCellCount={selectionRange ? (Math.abs(selectionRange.endRow - selectionRange.startRow) + 1) * (Math.abs(selectionRange.endCol - selectionRange.startCol) + 1) : undefined}
          aggregation={statusBarConfig.aggregation}
          suppressRowCount={statusBarConfig.suppressRowCount}
        />
      )}
      {isLoading && (
        <div className={styles.loadingOverlay} aria-live="polite">
          <div className={styles.loadingOverlayContent}>
            <Spinner size="small" />
            <span className={styles.loadingOverlayText}>{loadingMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
