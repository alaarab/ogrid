import * as React from 'react';
import { useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { InlineCellEditor } from './InlineCellEditor';
import { StatusBar } from './StatusBar';
import { GridContextMenu } from './GridContextMenu';
import type {
  IColumnDef,
  ICellEditorProps,
  IOGridDataGridProps,
} from '@alaarab/ogrid-core';
import {
  useDataGridState,
  useColumnResize,
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


const GRID_ROOT_STYLE: React.CSSProperties = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });
  const lastMouseShiftRef = useRef(false);

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels } = state;
  const { visibleCols, totalColCount, hasCheckboxCol, colOffset, containerWidth, minTableWidth, desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides } = layout;
  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
  const { setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo } = interaction;
  const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
  const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid } = viewModels;

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
  } = props;

  const headerRows = buildHeaderRows(columns, visibleColumns);

  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);
  const fitToContent = layoutMode === 'content';

  const { handleResizeStart, getColumnWidth } = useColumnResize<T>({
    columnSizingOverrides,
    setColumnSizingOverrides,
  });

  const editCallbacks = React.useMemo(() => ({ commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit }), [commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit]);
  const interactionHandlers = React.useMemo(() => ({ handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu }), [handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu]);

  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInput);

      if (descriptor.mode === 'editing-inline') {
        return <InlineCellEditor<T> {...buildInlineEditorProps(item, col, descriptor, editCallbacks)} />;
      }

      if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
        const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValue, editCallbacks);
        const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
        return (
          <Popover.Root open={!!popoverAnchorEl} onOpenChange={(open: boolean) => { if (!open) cancelPopoverEdit(); }}>
            <Popover.Anchor asChild>
              <div ref={(el) => el && setPopoverAnchorEl(el)} style={{ minHeight: '100%', minWidth: 40 }} aria-hidden />
            </Popover.Anchor>
            <Popover.Portal>
              <Popover.Content sideOffset={4} onOpenAutoFocus={(e: Event) => e.preventDefault()}>
                <CustomEditor {...editorProps} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
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
      ].filter(Boolean).join(' ');

      const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

      return (
        <div
          className={cellClassNames}
          {...interactionProps}
          style={descriptor.canEditAny ? { cursor: 'cell' } : undefined}
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
    [cellDescriptorInput, pendingEditorValue, popoverAnchorEl, editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit]
  );

  return (
    <div style={GRID_ROOT_STYLE}>
      <div
        ref={wrapperRef}
        tabIndex={0}
        onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
        className={`${styles.tableWrapper} ${rowSelection !== 'none' ? styles.selectableGrid : ''}`}
        role="region"
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
        aria-labelledby={ariaLabelledBy}
        data-empty={showEmptyInGrid ? 'true' : undefined}
        data-column-count={totalColCount}
        data-freeze-rows={freezeRows != null && freezeRows >= 1 ? freezeRows : undefined}
        data-freeze-cols={freezeCols != null && freezeCols >= 1 ? freezeCols : undefined}
        data-overflow-x={allowOverflowX ? 'true' : 'false'}
        data-container-width={containerWidth}
        data-min-table-width={Math.round(minTableWidth)}
        data-has-selection={rowSelection !== 'none' ? 'true' : undefined}
        onContextMenu={(e) => { e.preventDefault(); }}
        onKeyDown={handleGridKeyDown}
        style={{
          ['--data-table-column-count' as string]: totalColCount,
          ['--data-table-width' as string]: showEmptyInGrid ? '100%' : allowOverflowX ? 'fit-content' : fitToContent ? 'fit-content' : '100%',
          ['--data-table-min-width' as string]: showEmptyInGrid ? '100%' : allowOverflowX ? 'max-content' : fitToContent ? 'max-content' : '100%',
          ['--data-table-total-min-width' as string]: `${minTableWidth}px`,
        } as React.CSSProperties}
      >
        <div className={styles.tableScrollContent}>
        <div className={isLoading && items.length > 0 ? styles.loadingDimmed : undefined}>
          <div className={styles.tableWidthAnchor} ref={tableContainerRef}>
              <table className={styles.dataTable}>
                <thead
                  className={styles.stickyHeader}
                >
                  {headerRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {/* Checkbox header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                        <th className={styles.selectionHeaderCell} scope="col" rowSpan={1}>
                          <div className={styles.selectionHeaderCellInner}>
                            <Checkbox.Root
                              className={styles.rowCheckbox}
                              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                              onCheckedChange={(c: boolean | 'indeterminate') => handleSelectAll(!!c)}
                              aria-label="Select all rows"
                            >
                              <Checkbox.Indicator className={styles.rowCheckboxIndicator}>
                                {someSelected && !allSelected ? '–' : '✓'}
                              </Checkbox.Indicator>
                            </Checkbox.Root>
                          </div>
                        </th>
                      )}
                      {/* Empty placeholder for checkbox alignment in non-leaf rows */}
                      {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol && (
                        <th rowSpan={headerRows.length - 1} />
                      )}
                      {row.map((cell, cellIdx) => {
                        if (cell.isGroup) {
                          return (
                            <th key={cellIdx} colSpan={cell.colSpan} className={styles.groupHeaderCell} scope="colgroup">
                              {cell.label}
                            </th>
                          );
                        }
                        // Leaf cell
                        const col = cell.columnDef!;
                        const colIdx = visibleCols.indexOf(col);
                        const isFreezeCol =
                          freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                        const isPinnedLeft = col.pinned === 'left';
                        const isPinnedRight = col.pinned === 'right';
                        const columnWidth = getColumnWidth(col);
                        const hasExplicitWidth = !!(columnSizingOverrides[col.columnId] || col.idealWidth != null || col.defaultWidth != null);
                        const leafRowSpan = headerRows.length > 1 && rowIdx < headerRows.length - 1
                          ? headerRows.length - rowIdx
                          : undefined;
                        return (
                          <th
                            key={col.columnId}
                            scope="col"
                            data-column-id={col.columnId}
                            rowSpan={leafRowSpan}
                            className={[
                              isFreezeCol ? styles.freezeCol : '',
                              isFreezeCol && colIdx === 0 ? styles.freezeColFirst : '',
                              isPinnedLeft ? styles.pinnedColLeft : '',
                              isPinnedRight ? styles.pinnedColRight : '',
                            ].filter(Boolean).join(' ')}
                            style={{
                              minWidth: col.minWidth ?? 80,
                              width: hasExplicitWidth ? columnWidth : undefined,
                              maxWidth: hasExplicitWidth ? columnWidth : undefined,
                            }}
                          >
                            <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                            <div
                              className={styles.resizeHandle}
                              onMouseDown={(e) => handleResizeStart(e, col)}
                              aria-label={`Resize ${col.name}`}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                {!showEmptyInGrid && (
                  <tbody>
                    {items.map((item, rowIndex) => {
                      const rowIdStr = getRowId(item);
                      const isSelected = selectedRowIds.has(rowIdStr);
                      return (
                        <tr
                          key={rowIdStr}
                          className={isSelected ? styles.selectedRow : ''}
                          onClick={() => {
                            if (rowSelection === 'single') {
                              const id = getRowId(item);
                              updateSelection(selectedRowIds.has(id) ? new Set() : new Set([id]));
                            }
                          }}
                        >
                          {hasCheckboxCol && (
                            <td className={styles.selectionCell}>
                              <div
                                className={styles.selectionCellInner}
                                data-row-index={rowIndex}
                                data-col-index={0}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox.Root
                                  className={styles.rowCheckbox}
                                  checked={selectedRowIds.has(rowIdStr)}
                                  onCheckedChange={(c: boolean | 'indeterminate') => handleRowCheckboxChange(rowIdStr, !!c, rowIndex, lastMouseShiftRef.current)}
                                  aria-label={`Select row ${rowIndex + 1}`}
                                >
                                  <Checkbox.Indicator className={styles.rowCheckboxIndicator}>✓</Checkbox.Indicator>
                                </Checkbox.Root>
                              </div>
                            </td>
                          )}
                          {visibleCols.map((col, colIdx) => {
                            const isFreezeCol =
                              freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                            const isPinnedLeft = col.pinned === 'left';
                            const isPinnedRight = col.pinned === 'right';
                            const columnWidth = getColumnWidth(col);
                            const hasExplicitWidth = !!(columnSizingOverrides[col.columnId] || col.idealWidth != null || col.defaultWidth != null);
                            return (
                              <td
                                key={col.columnId}
                                className={[
                                  isFreezeCol ? styles.freezeCol : '',
                                  isFreezeCol && colIdx === 0 ? styles.freezeColFirst : '',
                                  isPinnedLeft ? styles.pinnedColLeft : '',
                                  isPinnedRight ? styles.pinnedColRight : '',
                                ].filter(Boolean).join(' ')}
                                style={{
                                  minWidth: col.minWidth ?? 80,
                                  width: hasExplicitWidth ? columnWidth : undefined,
                                  maxWidth: hasExplicitWidth ? columnWidth : undefined,
                                  textAlign: col.type === 'numeric' ? 'right' : col.type === 'boolean' ? 'center' : undefined,
                                }}
                              >
                                {renderCellContent(item, col, rowIndex, colIdx)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                )}
              </table>
              <MarchingAntsOverlay
                containerRef={tableContainerRef}
                selectionRange={selectionRange}
                copyRange={copyRange}
                cutRange={cutRange}
                colOffset={colOffset}
              />
              {showEmptyInGrid && emptyState && (
                <div className={styles.emptyStateInGrid}>
                  <div>
                    {emptyState.render ? (
                      emptyState.render()
                    ) : (
                      <>
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
      {isLoading && items.length > 0 && (
        <div className={styles.loadingOverlay} aria-live="polite">
          <div className={styles.loadingOverlayContent}>
            <div className={styles.spinner} />
            <span className={styles.loadingOverlayText}>{loadingMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
