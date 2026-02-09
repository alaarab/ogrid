import * as React from 'react';
import { useCallback, useRef, useEffect } from 'react';
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
  MarchingAntsOverlay,
} from '@alaarab/ogrid-core';
import styles from './DataGridTable.module.scss';

/** @deprecated Use IOGridDataGridProps from @alaarab/ogrid-core for new code. */
export type IDataGridTableProps<T> = IOGridDataGridProps<T>;

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });
  const lastMouseShiftRef = useRef(false);

  const {
    visibleCols,
    totalColCount,
    hasCheckboxCol,
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
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

  const allowOverflowX = containerWidth > 0 && minTableWidth > containerWidth;
  const fitToContent = layoutMode === 'content';

  const { handleResizeStart, getColumnWidth } = useColumnResize<T>({
    columnSizingOverrides,
    setColumnSizingOverrides,
  });

  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
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

      let content: React.ReactNode;
      if (col.renderCell) content = col.renderCell(item);
      else {
        const value = descriptor.displayValue;
        if (col.valueFormatter) content = col.valueFormatter(value, item);
        else if (value !== null && value !== undefined) content = String(value);
        else content = null;
      }
      const cellStyle = col.cellStyle ? (typeof col.cellStyle === 'function' ? col.cellStyle(item) : col.cellStyle) : undefined;
      if (cellStyle) content = <span style={cellStyle}>{content}</span>;

      const cellClassNames = [
        styles.cellContent,
        descriptor.isActive ? styles.activeCellContent : '',
        descriptor.isInRange ? styles.cellInRange : '',
        descriptor.isInCutRange ? styles.cellCut : '',
        descriptor.isInCopyRange ? styles.cellCopied : '',
      ].filter(Boolean).join(' ');

      if (descriptor.canEditAny) {
        return (
          <div
            className={cellClassNames}
            data-row-index={descriptor.rowIndex}
            data-col-index={descriptor.globalColIndex}
            data-in-range={descriptor.isInRange ? 'true' : undefined}
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
          data-in-range={descriptor.isInRange ? 'true' : undefined}
          tabIndex={descriptor.isActive ? 0 : -1}
          onMouseDown={(e) => handleCellMouseDown(e, descriptor.rowIndex, descriptor.globalColIndex)}
          onClick={() => setActiveCell({ rowIndex: descriptor.rowIndex, columnIndex: descriptor.globalColIndex })}
          onContextMenu={handleCellContextMenu}
        >
          {content}
        </div>
      );
    },
    [cellDescriptorInput, pendingEditorValue, popoverAnchorEl, handleCellMouseDown, handleCellContextMenu, handleFillHandleMouseDown, setActiveCell, setEditingCell, setPendingEditorValue, setPopoverAnchorEl, commitCellEdit, cancelPopoverEdit]
  );

  return (
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
        <div className={isLoading && items.length > 0 ? styles.loadingOverlayContainer : undefined}>
          {isLoading && items.length > 0 && (
            <div className={styles.loadingOverlay} aria-live="polite">
              <div className={styles.loadingOverlayContent}>
                <div className={styles.spinner} />
                <span className={styles.loadingOverlayText}>{loadingMessage}</span>
              </div>
            </div>
          )}
          <div className={isLoading && items.length > 0 ? styles.loadingDimmed : undefined}>
            <div className={styles.tableWidthAnchor} ref={tableContainerRef}>
              <table className={styles.dataTable}>
                <thead
                  className={freezeRows != null && freezeRows >= 1 ? styles.stickyHeader : undefined}
                >
                  <tr>
                    {hasCheckboxCol && (
                      <th className={styles.selectionHeaderCell} scope="col">
                        <div className={styles.selectionHeaderCellInner}>
                          <Checkbox.Root
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            onCheckedChange={(c: boolean | 'indeterminate') => handleSelectAll(!!c)}
                            aria-label="Select all rows"
                          >
                            <Checkbox.Indicator>✓</Checkbox.Indicator>
                          </Checkbox.Root>
                        </div>
                      </th>
                    )}
                    {visibleCols.map((col, colIdx) => {
                      const isFreezeCol =
                        freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                      const isPinnedLeft = col.pinned === 'left';
                      const isPinnedRight = col.pinned === 'right';
                      const columnWidth = getColumnWidth(col);
                      return (
                        <th
                          key={col.columnId}
                          scope="col"
                          data-column-id={col.columnId}
                          className={[
                            isFreezeCol ? styles.freezeCol : '',
                            isFreezeCol && colIdx === 0 ? styles.freezeColFirst : '',
                            isPinnedLeft ? styles.pinnedColLeft : '',
                            isPinnedRight ? styles.pinnedColRight : '',
                          ].filter(Boolean).join(' ')}
                          style={{
                            minWidth: col.minWidth ?? 80,
                            width: columnWidth,
                            maxWidth: columnWidth,
                            position: 'relative',
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
                                <input
                                  type="checkbox"
                                  checked={selectedRowIds.has(rowIdStr)}
                                  onChange={(e) => handleRowCheckboxChange(rowIdStr, (e.target as HTMLInputElement).checked, rowIndex, lastMouseShiftRef.current)}
                                  aria-label={`Select row ${rowIndex + 1}`}
                                />
                              </div>
                            </td>
                          )}
                          {visibleCols.map((col, colIdx) => {
                            const isFreezeCol =
                              freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                            const isPinnedLeft = col.pinned === 'left';
                            const isPinnedRight = col.pinned === 'right';
                            const columnWidth = getColumnWidth(col);
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
                                  width: columnWidth,
                                  maxWidth: columnWidth,
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
            </div>
          </div>
        </div>
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

      {statusBarConfig && (
        <StatusBar
          totalCount={statusBarConfig.totalCount}
          filteredCount={statusBarConfig.filteredCount}
          selectedCount={statusBarConfig.selectedCount ?? selectedRowIds.size}
          selectedCellCount={selectionRange ? (Math.abs(selectionRange.endRow - selectionRange.startRow) + 1) * (Math.abs(selectionRange.endCol - selectionRange.startCol) + 1) : undefined}
        />
      )}

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
