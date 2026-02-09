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
import { InlineCellEditor } from './InlineCellEditor';
import { StatusBar } from './StatusBar';
import { GridContextMenu } from './GridContextMenu';
import type {
  ICellEditorProps,
  IOGridDataGridProps,
} from '@alaarab/ogrid-core';
import {
  useDataGridState,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  MarchingAntsOverlay,
} from '@alaarab/ogrid-core';
import styles from './DataGridTable.module.scss';

/** @deprecated Use IOGridDataGridProps from @alaarab/ogrid-core for new code. */
export type IDataGridTableProps<T> = IOGridDataGridProps<T>;

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });

  const {
    flatColumns,
    visibleCols,
    totalColCount,
    hasCheckboxCol,
    rowIndexByRowId,
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
    activeCell,
    setActiveCell,
    handleCellMouseDown,
    handleSelectAllCells,
    contextMenu,
    setContextMenu,
    handleCellContextMenu,
    closeContextMenu,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleGridKeyDown,
    handleFillHandleMouseDown,
    containerWidth,
    minTableWidth,
    columnSizingOverrides,
    setColumnSizingOverrides,
    statusBarConfig,
    showEmptyInGrid,
    hasCellSelection,
    selectionRange,
    copyRange,
    cutRange,
    colOffset,
    headerFilterInput,
    cellDescriptorInput,
    commitCellEdit,
    cancelPopoverEdit,
    popoverAnchorEl,
    setPopoverAnchorEl,
  } = state;

  const {
    items,
    getRowId,
    emptyState,
    layoutMode = 'fill',
    rowSelection = 'none',
    freezeRows,
    freezeCols,
    isLoading = false,
    loadingMessage = 'Loading\u2026',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const fitToContent = layoutMode === 'content';

  const columnSizingOptions: TableColumnSizingOptions = useMemo(() => {
    const acc: Record<string, { minWidth: number; defaultWidth?: number; idealWidth?: number }> = {};

    if (hasCheckboxCol) {
      acc['__selection__'] = { minWidth: 48, defaultWidth: 48, idealWidth: 48 };
    }

    visibleCols.forEach((c) => {
      const minW = c.minWidth ?? 80;
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
  }, [visibleCols, columnSizingOverrides, hasCheckboxCol]);

  const desiredTableWidth = useMemo(() => {
    const PADDING = 16;
    const checkboxW = hasCheckboxCol ? 48 : 0;
    return visibleCols.reduce((sum, c) => {
      const s = columnSizingOptions[c.columnId] as { idealWidth?: number; defaultWidth?: number; minWidth: number } | undefined;
      const w = s?.idealWidth ?? s?.defaultWidth ?? c.idealWidth ?? c.defaultWidth ?? c.minWidth ?? 80;
      return sum + Math.max(c.minWidth ?? 80, w) + PADDING;
    }, checkboxW);
  }, [visibleCols, columnSizingOptions, hasCheckboxCol]);

  const allowOverflowX = containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);

  const fluentColumns = useMemo<TableColumnDefinition<T>[]>(() => {
    const dataCols: TableColumnDefinition<T>[] = visibleCols.map((col, colIdx) =>
      createTableColumn<T>({
        columnId: col.columnId,
        compare: col.compare ?? (() => 0),
        renderHeaderCell: () => (
          <div data-column-id={col.columnId}>
            <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
          </div>
        ),
        renderCell: (item) => {
          const rowId = getRowId(item);
          const rowIndex = rowIndexByRowId.get(rowId) ?? -1;
          const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInput);

          if (descriptor.mode === 'editing-inline') {
            return (
              <InlineCellEditor<T>
                value={descriptor.value}
                item={item}
                column={col}
                rowIndex={descriptor.rowIndex}
                editorType={descriptor.editorType ?? 'text'}
                onCommit={(newValue) => commitCellEdit(item, col.columnId, descriptor.value, newValue, descriptor.rowIndex, descriptor.globalColIndex)}
                onCancel={() => setEditingCell(null)}
              />
            );
          }

          if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
            const oldValue = descriptor.value;
            const displayValue = pendingEditorValue !== undefined ? pendingEditorValue : oldValue;
            const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
            const editorProps: ICellEditorProps<T> = {
              value: displayValue,
              onValueChange: setPendingEditorValue,
              onCommit: () => {
                const newValue = pendingEditorValue !== undefined ? pendingEditorValue : oldValue;
                commitCellEdit(item, col.columnId, oldValue, newValue, descriptor.rowIndex, descriptor.globalColIndex);
              },
              onCancel: cancelPopoverEdit,
              item,
              column: col,
              cellEditorParams: col.cellEditorParams,
            };
            return (
              <>
                <div
                  ref={(el) => { if (el) setPopoverAnchorEl(el); }}
                  style={{ minHeight: '100%', minWidth: 40 }}
                  aria-hidden
                />
                <Popover
                  open={!!popoverAnchorEl}
                  onOpenChange={(_, data) => { if (!data.open) cancelPopoverEdit(); }}
                  positioning={{ target: popoverAnchorEl ?? undefined }}
                >
                  <PopoverSurface>
                    <CustomEditor {...editorProps} />
                  </PopoverSurface>
                </Popover>
              </>
            );
          }

          const cellStyle = col.cellStyle
            ? typeof col.cellStyle === 'function'
              ? col.cellStyle(item)
              : col.cellStyle
            : undefined;
          let content: React.ReactNode;
          if (col.renderCell) content = col.renderCell(item);
          else {
            const value = descriptor.displayValue;
            if (col.valueFormatter) content = col.valueFormatter(value, item);
            else if (value !== null && value !== undefined) content = String(value);
            else content = null;
          }
          if (cellStyle) content = <span style={cellStyle}>{content}</span>;

          const cellClassNames = [
            styles.cellContent,
            descriptor.isActive && !descriptor.isInRange ? styles.activeCellContent : '',
            descriptor.isInRange ? styles.cellInRange : '',
            descriptor.isInCutRange ? styles.cellCut : '',
            descriptor.isInCopyRange ? styles.cellCopied : '',
            descriptor.isPinned ? styles.pinnedCell : '',
            descriptor.isPinned && descriptor.pinnedSide === 'left' ? styles.pinnedLeft : '',
            descriptor.isPinned && descriptor.pinnedSide === 'right' ? styles.pinnedRight : '',
          ]
            .filter(Boolean)
            .join(' ');

          if (descriptor.canEditAny) {
            return (
              <div
                className={cellClassNames}
                data-row-index={descriptor.rowIndex}
                data-col-index={descriptor.globalColIndex}
                {...(descriptor.isInRange ? { 'data-in-range': 'true' } : {})}
                role="button"
                tabIndex={descriptor.isActive ? 0 : -1}
                onMouseDown={(e) => handleCellMouseDown(e, descriptor.rowIndex, descriptor.globalColIndex)}
                onClick={() => setActiveCell({ rowIndex: descriptor.rowIndex, columnIndex: descriptor.globalColIndex })}
                onDoubleClick={() => setEditingCell({ rowId: descriptor.rowId, columnId: col.columnId })}
                onContextMenu={handleCellContextMenu}
                style={{ cursor: 'cell' }}
              >
                {content}
                {descriptor.isSelectionEndCell && (
                  <div
                    className={styles.fillHandle}
                    onMouseDown={handleFillHandleMouseDown}
                    aria-label="Fill handle"
                  />
                )}
              </div>
            );
          }
          return (
            <div
              className={cellClassNames}
              data-row-index={descriptor.rowIndex}
              data-col-index={descriptor.globalColIndex}
              {...(descriptor.isInRange ? { 'data-in-range': 'true' } : {})}
              tabIndex={descriptor.isActive ? 0 : -1}
              onMouseDown={(e) => handleCellMouseDown(e, descriptor.rowIndex, descriptor.globalColIndex)}
              onClick={() => setActiveCell({ rowIndex: descriptor.rowIndex, columnIndex: descriptor.globalColIndex })}
              onContextMenu={handleCellContextMenu}
            >
              {content}
            </div>
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
              checked={allSelected ? true : someSelected ? 'mixed' : false}
              onChange={(_, data) => handleSelectAll(!!data.checked)}
              aria-label="Select all rows"
            />
          </div>
        ),
        renderCell: (item) => {
          const rowId = getRowId(item);
          const rowIndex = rowIndexByRowId.get(rowId) ?? -1;
          const isChecked = selectedRowIds.has(rowId);
          const isActive = activeCell?.rowIndex === rowIndex && activeCell?.columnIndex === 0;
          return (
            <div
              className={`${styles.selectionCell} ${isActive ? styles.activeCellContent : ''}`}
              data-row-index={rowIndex}
              data-col-index={0}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCell({ rowIndex, columnIndex: 0 });
              }}
            >
              <Checkbox
                checked={isChecked}
                onChange={(e, data) => {
                  handleRowCheckboxChange(rowId, !!data.checked, rowIndex, (e.nativeEvent as MouseEvent).shiftKey);
                }}
                aria-label={`Select row ${rowIndex + 1}`}
              />
            </div>
          );
        },
      });
      return [checkboxCol, ...dataCols];
    }

    return dataCols;
  }, [
    visibleCols,
    headerFilterInput,
    cellDescriptorInput,
    getRowId,
    rowIndexByRowId,
    pendingEditorValue,
    popoverAnchorEl,
    hasCheckboxCol,
    allSelected,
    someSelected,
    selectedRowIds,
    handleSelectAll,
    handleRowCheckboxChange,
    activeCell,
    handleCellMouseDown,
    handleFillHandleMouseDown,
    handleCellContextMenu,
    setActiveCell,
    setEditingCell,
    setPendingEditorValue,
    setPopoverAnchorEl,
    commitCellEdit,
    cancelPopoverEdit,
  ]);

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
      const minW = colDef?.minWidth ?? 80;

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
    <div
      ref={wrapperRef}
      tabIndex={0}
      className={`${styles.tableWrapper} ${rowSelection !== 'none' ? styles.selectableGrid : ''}`}
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
      onContextMenu={(e) => {
        e.preventDefault();
      }}
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
        <div className={isLoading && items.length > 0 ? styles.loadingOverlayContainer : undefined}>
          {isLoading && items.length > 0 && (
            <div className={styles.loadingOverlay} aria-live="polite">
              <div className={styles.loadingOverlayContent}>
                <Spinner size="small" />
                <span className={styles.loadingOverlayText}>{loadingMessage}</span>
              </div>
            </div>
          )}
          <div className={isLoading && items.length > 0 ? styles.loadingDimmed : undefined}>
            <div className={styles.tableWidthAnchor} ref={tableContainerRef}>
              <DataGrid
                items={items}
                columns={fluentColumns}
                resizableColumns
                resizableColumnsOptions={{ autoFitColumns: layoutMode === 'fill' && !allowOverflowX }}
                columnSizingOptions={columnSizingOptions}
                onColumnResize={handleColumnResize}
                getRowId={(item) => String(getRowId(item))}
                focusMode="composite"
                className={styles.dataGrid}
              >
                <DataGridHeader
                  className={freezeRows != null && freezeRows >= 1 ? styles.stickyHeader : undefined}
                >
                  <DataGridRow>
                    {({ renderHeaderCell, columnId }) => {
                      const colIdx = visibleCols.findIndex((c) => c.columnId === columnId);
                      const isFreezeCol =
                        freezeCols != null && freezeCols >= 1 && colIdx >= 0 && colIdx < freezeCols;
                      return (
                        <DataGridHeaderCell
                          className={`${columnId === '__selection__' ? styles.selectionHeaderCellWrapper : ''} ${
                            isFreezeCol ? styles.freezeCol : ''
                          } ${isFreezeCol && colIdx === 0 ? styles.freezeColFirst : ''}`.trim()}
                        >
                          {renderHeaderCell()}
                        </DataGridHeaderCell>
                      );
                    }}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<T>>
                  {({ item }) => {
                    const rowId = getRowId(item);
                    const isSelected = selectedRowIds.has(rowId);
                    return (
                      <DataGridRow<T>
                        key={rowId}
                        className={`${isSelected ? styles.selectedRow : ''} ${
                          activeCell !== null && (rowIndexByRowId.get(rowId) ?? -1) === activeCell.rowIndex
                            ? styles.activeRow
                            : ''
                        }`}
                        onClick={() => {
                          if (rowSelection === 'single') {
                            const isCurrentlySelected = selectedRowIds.has(rowId);
                            updateSelection(isCurrentlySelected ? new Set() : new Set([rowId]));
                          }
                        }}
                      >
                        {({ renderCell, columnId }) => {
                          const colIdx = visibleCols.findIndex((c) => c.columnId === columnId);
                          const isFreezeCol =
                            freezeCols != null && freezeCols >= 1 && colIdx >= 0 && colIdx < freezeCols;
                          return (
                            <DataGridCell
                              className={`${columnId === '__selection__' ? styles.selectionCellWrapper : ''} ${
                                isFreezeCol ? styles.freezeCol : ''
                              } ${isFreezeCol && colIdx === 0 ? styles.freezeColFirst : ''}`.trim()}
                            >
                              {renderCell(item)}
                            </DataGridCell>
                          );
                        }}
                      </DataGridRow>
                    );
                  }}
                </DataGridBody>
              </DataGrid>
              <MarchingAntsOverlay
                containerRef={tableContainerRef}
                selectionRange={selectionRange}
                copyRange={copyRange}
                cutRange={cutRange}
                colOffset={colOffset}
              />
              {statusBarConfig && (
                <StatusBar
                  totalCount={statusBarConfig.totalCount}
                  filteredCount={statusBarConfig.filteredCount}
                  selectedCount={statusBarConfig.selectedCount ?? selectedRowIds.size}
                  selectedCellCount={selectionRange ? (Math.abs(selectionRange.endRow - selectionRange.startRow) + 1) * (Math.abs(selectionRange.endCol - selectionRange.startCol) + 1) : undefined}
                />
              )}
            </div>
          </div>
        </div>
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

      {contextMenu &&
        createPortal(
          <GridContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSelection={hasCellSelection}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo ?? (() => {})}
            onRedo={onRedo ?? (() => {})}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={() => void handlePaste()}
            onSelectAll={handleSelectAllCells}
            onClose={closeContextMenu}
          />,
          document.body
        )}
    </div>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
