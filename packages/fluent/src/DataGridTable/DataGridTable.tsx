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
  buildHeaderRows,
  MarchingAntsOverlay,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
} from '@alaarab/ogrid-core';
import styles from './DataGridTable.module.scss';

/** @deprecated Use IOGridDataGridProps from @alaarab/ogrid-core for new code. */
export type IDataGridTableProps<T> = IOGridDataGridProps<T>;

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels } = state;
  const { flatColumns, visibleCols, totalColCount, hasCheckboxCol, colOffset, rowIndexByRowId, containerWidth, minTableWidth, desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides } = layout;
  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
  const { activeCell, setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo } = interaction;
  const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
  const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid } = viewModels;

  const {
    items,
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
  } = props;

  const headerRows = buildHeaderRows(props.columns, props.visibleColumns);
  const hasGroupHeaders = headerRows.length > 1;

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

  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);

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
            return <InlineCellEditor<T> {...buildInlineEditorProps(item, col, descriptor, { commitCellEdit, setEditingCell })} />;
          }

          if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
            const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValue, { setPendingEditorValue, commitCellEdit, cancelPopoverEdit });
            const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
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

          const content = resolveCellDisplayContent(col, item, descriptor.displayValue);
          const cellStyle = resolveCellStyle(col, item);
          const styledContent = cellStyle ? <span style={cellStyle}>{content}</span> : content;

          const cellClassNames = [
            styles.cellContent,
            descriptor.isActive && !descriptor.isInRange ? styles.activeCellContent : '',
            descriptor.isInRange ? styles.cellInRange : '',
            descriptor.isInCutRange ? styles.cellCut : '',
            descriptor.isInCopyRange ? styles.cellCopied : '',
          ]
            .filter(Boolean)
            .join(' ');

          const colType = col.type;
          const interactionProps = getCellInteractionProps(descriptor, col.columnId, { handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu });

          return (
            <div
              className={cellClassNames}
              {...interactionProps}
              style={{
                ...(descriptor.canEditAny ? { cursor: 'cell' } : undefined),
                ...(colType === 'numeric' ? { justifyContent: 'flex-end', textAlign: 'right' } : undefined),
                ...(colType === 'boolean' ? { justifyContent: 'center', textAlign: 'center' } : undefined),
              }}
            >
              {styledContent}
              {descriptor.canEditAny && descriptor.isSelectionEndCell && (
                <div
                  className={styles.fillHandle}
                  onMouseDown={handleFillHandleMouseDown}
                  aria-label="Fill handle"
                />
              )}
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
      {isLoading && items.length > 0 && (
        <div className={styles.loadingOverlay} aria-live="polite">
          <div className={styles.loadingOverlayContent}>
            <Spinner size="small" />
            <span className={styles.loadingOverlayText}>{loadingMessage}</span>
          </div>
        </div>
      )}
      <div className={styles.tableScrollContent}>
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
                  className={styles.stickyHeader}
                >
                  {hasGroupHeaders && headerRows.slice(0, -1).map((row, rowIdx) => (
                    <tr key={`group-${rowIdx}`} className={styles.groupHeaderRow}>
                      {rowIdx === 0 && hasCheckboxCol && (
                        <th rowSpan={headerRows.length - 1} style={{ width: 48, minWidth: 48 }} />
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
                  <DataGridRow>
                    {({ renderHeaderCell, columnId }) => {
                      const colIdx = visibleCols.findIndex((c) => c.columnId === columnId);
                      const isFreezeCol =
                        freezeCols != null && freezeCols >= 1 && colIdx >= 0 && colIdx < freezeCols;
                      const col = colIdx >= 0 ? visibleCols[colIdx] : undefined;
                      const isPinnedLeft = col?.pinned === 'left';
                      const isPinnedRight = col?.pinned === 'right';
                      return (
                        <DataGridHeaderCell
                          className={[
                            columnId === '__selection__' ? styles.selectionHeaderCellWrapper : '',
                            isFreezeCol ? styles.freezeCol : '',
                            isFreezeCol && colIdx === 0 ? styles.freezeColFirst : '',
                            isPinnedLeft ? styles.pinnedCell : '',
                            isPinnedLeft ? styles.pinnedLeft : '',
                            isPinnedRight ? styles.pinnedCell : '',
                            isPinnedRight ? styles.pinnedRight : '',
                          ].filter(Boolean).join(' ')}
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
                          const col = colIdx >= 0 ? visibleCols[colIdx] : undefined;
                          const isPinnedLeft = col?.pinned === 'left';
                          const isPinnedRight = col?.pinned === 'right';
                          return (
                            <DataGridCell
                              className={[
                                columnId === '__selection__' ? styles.selectionCellWrapper : '',
                                isFreezeCol ? styles.freezeCol : '',
                                isFreezeCol && colIdx === 0 ? styles.freezeColFirst : '',
                                isPinnedLeft ? styles.pinnedCell : '',
                                isPinnedLeft ? styles.pinnedLeft : '',
                                isPinnedRight ? styles.pinnedCell : '',
                                isPinnedRight ? styles.pinnedRight : '',
                              ].filter(Boolean).join(' ')}
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
      </div>

      {menuPosition &&
        createPortal(
          <GridContextMenu
            x={menuPosition.x}
            y={menuPosition.y}
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
