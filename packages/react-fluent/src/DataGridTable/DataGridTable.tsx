import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Checkbox,
  Popover,
  PopoverSurface,
  type OpenPopoverEvents,
  type OnOpenChangeData,
} from '@fluentui/react-components';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { ColumnHeaderMenu } from '../ColumnHeaderMenu';
import { InlineCellEditor, type InlineCellEditorProps } from './InlineCellEditor';
import { StatusBar } from './StatusBar';
import { GridContextMenu } from './GridContextMenu';
import { EmptyState } from './EmptyState';
import { LoadingOverlay } from './LoadingOverlay';
import { DropIndicator } from './DropIndicator';
import type {
  IColumnDef,
  ICellEditorProps,
  IOGridDataGridProps,
} from '@alaarab/ogrid-react';
import {
  useDataGridTableOrchestration,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  MarchingAntsOverlay,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  areGridRowPropsEqual,
  CellErrorBoundary,
  DEFAULT_MIN_COLUMN_WIDTH,
  GRID_ROOT_STYLE,
  CURSOR_CELL_STYLE,
  POPOVER_ANCHOR_STYLE,
  PREVENT_DEFAULT,
  NOOP,
} from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';


// --- Memoized row component (skips re-render for rows unaffected by selection changes) ---

interface GridRowProps {
  item: unknown;
  rowIndex: number;
  rowId: string | number;
  isSelected: boolean;
  visibleCols: IColumnDef<unknown>[];
  columnMeta: { cellStyles: Record<string, React.CSSProperties>; cellClasses: Record<string, string> };
  renderCellContent: (item: unknown, col: IColumnDef<unknown>, rowIndex: number, colIdx: number) => React.ReactNode;
  handleSingleRowClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  handleRowCheckboxChange: (rowId: string | number, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  lastMouseShiftRef: React.MutableRefObject<boolean>;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowNumberOffset: number;
  // Comparator-only props (drive re-render decisions, not used in render body)
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  cutRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  copyRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isDragging: boolean;
  editingRowId: string | number | null;
}

function GridRowInner(props: GridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
  } = props;

  return (
    <TableRow
      className={isSelected ? styles.selectedRow : undefined}
      data-row-id={rowId}
      onClick={handleSingleRowClick}
    >
      {hasCheckboxCol && (
        <TableCell className={styles.selectionCellWrapper}>
          <div
            className={styles.selectionCellInner}
            data-row-index={rowIndex}
            data-col-index={0}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onChange={(e, data) => {
                handleRowCheckboxChange(rowId, !!data.checked, rowIndex, lastMouseShiftRef.current);
              }}
              aria-label={`Select row ${rowIndex + 1}`}
            />
          </div>
        </TableCell>
      )}
      {hasRowNumbersCol && (
        <TableCell className={styles.rowNumberCellWrapper}>
          <div className={styles.rowNumberCellInner}>
            {rowNumberOffset + rowIndex + 1}
          </div>
        </TableCell>
      )}
      {visibleCols.map((col, colIdx) => (
        <TableCell
          key={col.columnId}
          data-column-id={col.columnId}
          className={columnMeta.cellClasses[col.columnId] || undefined}
          style={columnMeta.cellStyles[col.columnId]}
        >
          {renderCellContent(item, col, rowIndex, colIdx)}
        </TableCell>
      ))}
    </TableRow>
  );
}

const GridRow = React.memo(GridRowInner, areGridRowPropsEqual);

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const o = useDataGridTableOrchestration({ props });

  const {
    wrapperRef, tableContainerRef, lastMouseShiftRef,
    interaction, pinning,
    handleResizeStart, getColumnWidth, isReorderDragging, dropIndicatorX, handleHeaderMouseDown,
    virtualScrollEnabled, visibleRange,
    items, getRowId, emptyState, rowSelection,
    isLoading, loadingMessage,
    ariaLabel, ariaLabelledBy, visibleColumns, columnOrder, columnReorder, density, rowHeight,
    rowNumberOffset, headerRows, allowOverflowX, fitToContent,
    editCallbacks, interactionHandlers,
    cellDescriptorInputRef, pendingEditorValueRef, popoverAnchorElRef,
    handleSingleRowClick, handlePasteVoid,
    visibleCols, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset,
    containerWidth, minTableWidth, columnSizingOverrides, measuredColumnWidths,
    selectedRowIds, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected,
    editingCell, setPopoverAnchorEl, cancelPopoverEdit,
    setActiveCell, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown,
    handleCopy, handleCut, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
    menuPosition, closeContextMenu,
    headerFilterInput, statusBarConfig, showEmptyInGrid, onCellError,
    headerMenu,
  } = o;

  // Pre-compute column styles and classNames (avoids per-cell object creation in the row loop)
  const columnMeta = useMemo(() => {
    const cellStyles: Record<string, React.CSSProperties> = {};
    const cellClasses: Record<string, string> = {};
    const hdrStyles: Record<string, React.CSSProperties> = {};
    const hdrClasses: Record<string, string> = {};

    for (let i = 0; i < visibleCols.length; i++) {
      const col = visibleCols[i];
      const columnWidth = getColumnWidth(col);
      const hasExplicitWidth = !!(columnSizingOverrides[col.columnId] || col.idealWidth != null || col.defaultWidth != null);
      const isPinnedLeft = pinning.pinnedColumns[col.columnId] === 'left';
      const isPinnedRight = pinning.pinnedColumns[col.columnId] === 'right';

      const hasResizeOverride = !!columnSizingOverrides[col.columnId];
      const isPinned = isPinnedLeft || isPinnedRight;
      // Use previously-measured DOM width as a minWidth floor to prevent columns
      // from shrinking when new data loads (e.g. server-side pagination).
      const measuredW = measuredColumnWidths[col.columnId];
      const baseMinWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
      const effectiveMinWidth = hasResizeOverride ? columnWidth : Math.max(baseMinWidth, measuredW ?? 0);

      cellStyles[col.columnId] = {
        minWidth: effectiveMinWidth,
        width: hasExplicitWidth ? columnWidth : undefined,
        maxWidth: hasExplicitWidth ? columnWidth : undefined,
        textAlign: col.type === 'numeric' ? 'right' : col.type === 'boolean' ? 'center' : undefined,
        // Fluent UI's TableCell injects atomic CSS `position: relative` which overrides the
        // shared `.pinnedColLeft { position: sticky }` class. Inline style wins over atomic CSS.
        ...(isPinned ? { position: 'sticky' as const } : undefined),
        ...(isPinnedLeft && pinning.leftOffsets[col.columnId] != null ? { left: pinning.leftOffsets[col.columnId] } : undefined),
        ...(isPinnedRight && pinning.rightOffsets[col.columnId] != null ? { right: pinning.rightOffsets[col.columnId] } : undefined),
      };

      hdrStyles[col.columnId] = {
        minWidth: effectiveMinWidth,
        width: hasExplicitWidth ? columnWidth : undefined,
        maxWidth: hasExplicitWidth ? columnWidth : undefined,
        ...(isPinned ? { position: 'sticky' as const } : undefined),
        ...(isPinnedLeft && pinning.leftOffsets[col.columnId] != null ? { left: pinning.leftOffsets[col.columnId] } : undefined),
        ...(isPinnedRight && pinning.rightOffsets[col.columnId] != null ? { right: pinning.rightOffsets[col.columnId] } : undefined),
      };

      const parts: string[] = [];
      if (isPinnedLeft) parts.push(styles.pinnedColLeft);
      if (isPinnedRight) parts.push(styles.pinnedColRight);
      const cn = parts.join(' ');
      cellClasses[col.columnId] = cn;
      hdrClasses[col.columnId] = cn;
    }

    return { cellStyles, cellClasses, hdrStyles, hdrClasses };
  }, [visibleCols, getColumnWidth, columnSizingOverrides, measuredColumnWidths, pinning.pinnedColumns, pinning.leftOffsets, pinning.rightOffsets]);

  // renderCellContent reads volatile state from refs -- keeps function identity stable so
  // GridRow's React.memo comparator can skip rows whose selection state hasn't changed.
  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current);
      const rowId = getRowId(item);

      let content: React.ReactNode;

      if (descriptor.mode === 'editing-inline') {
        content = (
          <div className={styles.editingCellContent}>
            <InlineCellEditor<T> {...buildInlineEditorProps(item, col, descriptor, editCallbacks) as InlineCellEditorProps<T>} />
          </div>
        );
      } else if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
        const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValueRef.current, editCallbacks) as ICellEditorProps<T>;
        const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
        content = (
          <>
            <div
              ref={(el) => { if (el) setPopoverAnchorEl(el); }}
              style={POPOVER_ANCHOR_STYLE}
              aria-hidden
            />
            <Popover
              open={!!popoverAnchorElRef.current}
              onOpenChange={(_: OpenPopoverEvents, data: OnOpenChangeData) => { if (!data.open) cancelPopoverEdit(); }}
              positioning={{ target: popoverAnchorElRef.current ?? undefined }}
            >
              <PopoverSurface>
                <CustomEditor {...editorProps} />
              </PopoverSurface>
            </Popover>
          </>
        );
      } else {
        const displayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
        const cellStyle = resolveCellStyle(col, item);
        const styledContent = cellStyle ? <span style={cellStyle}>{displayContent}</span> : displayContent;

        const cellClassNames = `${styles.cellContent}${descriptor.isActive && !descriptor.isInRange ? ` ${styles.activeCellContent}` : ''}${descriptor.isInRange ? ` ${styles.cellInRange}` : ''}${descriptor.isInCutRange ? ` ${styles.cellCut}` : ''}${descriptor.isInCopyRange ? ` ${styles.cellCopied}` : ''}`;

        const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

        content = (
          <div
            className={cellClassNames}
            {...interactionProps}
            style={descriptor.canEditAny ? CURSOR_CELL_STYLE : undefined}
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
      }

      return (
        <CellErrorBoundary key={`${rowId}-${col.columnId}`} onError={onCellError}>
          {content}
        </CellErrorBoundary>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- *Ref vars are stable refs from useLatestRef
    [editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError]
  );

  return (
    <div style={GRID_ROOT_STYLE}>
      <div
        ref={wrapperRef}
        tabIndex={0}
        onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
        className={`${styles.tableWrapper} ${rowSelection !== 'none' ? styles.selectableGrid : ''} ${styles[`density-${density}`] || ''}`}
        role="region"
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
        aria-labelledby={ariaLabelledBy}
        data-empty={showEmptyInGrid ? 'true' : undefined}
        data-loading={isLoading && items.length === 0 ? 'true' : undefined}
        data-column-count={totalColCount}
        data-overflow-x={allowOverflowX ? 'true' : 'false'}
        data-container-width={containerWidth}
        data-min-table-width={Math.round(minTableWidth)}
        data-has-selection={rowSelection !== 'none' ? 'true' : undefined}
        onContextMenu={PREVENT_DEFAULT}
        onKeyDown={handleGridKeyDown}
        style={{
          ['--data-table-column-count' as string]: totalColCount,
          ['--data-table-width' as string]: showEmptyInGrid ? '100%' : allowOverflowX ? 'fit-content' : fitToContent ? 'fit-content' : '100%',
          ['--data-table-min-width' as string]: showEmptyInGrid ? '100%' : allowOverflowX ? 'max-content' : fitToContent ? 'max-content' : '100%',
          ['--data-table-total-min-width' as string]: `${minTableWidth}px`,
          ...(rowHeight ? { ['--ogrid-row-height' as string]: `${rowHeight}px` } : {}),
        } as React.CSSProperties}
      >
        <div className={styles.tableScrollContent}>
        <div className={isLoading && items.length > 0 ? styles.loadingDimmed : undefined}>
          <div className={styles.tableWidthAnchor} ref={tableContainerRef}>
              <Table role="grid" className={styles.dataTable}>
                <TableHeader
                  className={styles.stickyHeader}
                >
                  {headerRows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {/* Checkbox header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                        <TableHeaderCell className={styles.selectionHeaderCellWrapper} key="__selection__">
                          <div className={styles.selectionHeaderCellInner}>
                            <Checkbox
                              checked={allSelected ? true : someSelected ? 'mixed' : false}
                              onChange={(_, data) => handleSelectAll(!!data.checked)}
                              aria-label="Select all rows"
                            />
                          </div>
                        </TableHeaderCell>
                      )}
                      {/* Empty placeholder for checkbox alignment in non-leaf rows */}
                      {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol && (
                        <th rowSpan={headerRows.length - 1} key="__selection_placeholder__" />
                      )}
                      {/* Row numbers header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (
                        <TableHeaderCell className={styles.rowNumberHeaderCellWrapper} key="__row_number__">
                          <div className={styles.rowNumberHeaderCellInner}>
                            #
                          </div>
                        </TableHeaderCell>
                      )}
                      {/* Empty placeholder for row numbers alignment in non-leaf rows */}
                      {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol && (
                        <th rowSpan={headerRows.length - 1} key="__row_number_placeholder__" />
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
                        const col = cell.columnDef! as IColumnDef<T>;

                        // Determine aria-sort value for sorted columns
                        const isSorted = props.sortBy === col.columnId;
                        const ariaSort = isSorted
                          ? (props.sortDirection === 'asc' ? 'ascending' : 'descending')
                          : undefined;

                        return (
                          <TableHeaderCell
                            key={col.columnId}
                            data-column-id={col.columnId}
                            // rowSpan not supported by TableHeaderCell, use native th for grouped headers
                            className={columnMeta.hdrClasses[col.columnId] || undefined}
                            style={{
                              ...columnMeta.hdrStyles[col.columnId],
                              ...(columnReorder ? { cursor: isReorderDragging ? 'grabbing' : 'grab' } : undefined),
                            }}
                            aria-sort={ariaSort as 'ascending' | 'descending' | 'none' | undefined}
                            onMouseDown={columnReorder ? (e) => handleHeaderMouseDown(col.columnId, e) : undefined}
                          >
                            <div className={styles.headerCellContent}>
                              <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                              <button
                                className={styles.headerMenuTrigger}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  headerMenu.open(col.columnId, e.currentTarget);
                                }}
                                aria-label="Column options"
                                title="Column options"
                              >
                                &#x22EE;
                              </button>
                            </div>
                            <div
                              className={styles.resizeHandle}
                              onMouseDown={(e) => {
                                // Clear cell selection/focus before resize so green outlines
                                // and blue :focus-visible rings don't persist during drag.
                                setActiveCell(null);
                                interaction.setSelectionRange(null);
                                // Move DOM focus to wrapper so no cell keeps :focus-visible
                                wrapperRef.current?.focus({ preventScroll: true });
                                handleResizeStart(e, col as IColumnDef<T>);
                              }}
                              aria-label={`Resize ${col.name}`}
                            />
                          </TableHeaderCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                {!showEmptyInGrid && (
                  <TableBody>
                    {virtualScrollEnabled && visibleRange.offsetTop > 0 && (
                      <tr style={{ height: visibleRange.offsetTop }} aria-hidden />
                    )}
                    {(virtualScrollEnabled
                      ? items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, i) => {
                          const rowIndex = visibleRange.startIndex + i;
                          const rowIdStr = getRowId(item);
                          return (
                            <GridRow
                              key={rowIdStr}
                              item={item}
                              rowIndex={rowIndex}
                              rowId={rowIdStr}
                              isSelected={selectedRowIds.has(rowIdStr)}
                              visibleCols={visibleCols as IColumnDef<unknown>[]}
                              columnMeta={columnMeta}
                              renderCellContent={renderCellContent as GridRowProps['renderCellContent']}
                              handleSingleRowClick={handleSingleRowClick}
                              handleRowCheckboxChange={handleRowCheckboxChange}
                              lastMouseShiftRef={lastMouseShiftRef}
                              hasCheckboxCol={hasCheckboxCol}
                              hasRowNumbersCol={hasRowNumbersCol}
                              rowNumberOffset={rowNumberOffset}
                              selectionRange={selectionRange}
                              activeCell={interaction.activeCell}
                              cutRange={cutRange}
                              copyRange={copyRange}
                              isDragging={isDragging}
                              editingRowId={editingCell?.rowId ?? null}
                            />
                          );
                        })
                      : items.map((item, rowIndex) => {
                          const rowIdStr = getRowId(item);
                          return (
                            <GridRow
                              key={rowIdStr}
                              item={item}
                              rowIndex={rowIndex}
                              rowId={rowIdStr}
                              isSelected={selectedRowIds.has(rowIdStr)}
                              visibleCols={visibleCols as IColumnDef<unknown>[]}
                              columnMeta={columnMeta}
                              renderCellContent={renderCellContent as GridRowProps['renderCellContent']}
                              handleSingleRowClick={handleSingleRowClick}
                              handleRowCheckboxChange={handleRowCheckboxChange}
                              lastMouseShiftRef={lastMouseShiftRef}
                              hasCheckboxCol={hasCheckboxCol}
                              hasRowNumbersCol={hasRowNumbersCol}
                              rowNumberOffset={rowNumberOffset}
                              selectionRange={selectionRange}
                              activeCell={interaction.activeCell}
                              cutRange={cutRange}
                              copyRange={copyRange}
                              isDragging={isDragging}
                              editingRowId={editingCell?.rowId ?? null}
                            />
                          );
                        })
                    )}
                    {virtualScrollEnabled && visibleRange.offsetBottom > 0 && (
                      <tr style={{ height: visibleRange.offsetBottom }} aria-hidden />
                    )}
                  </TableBody>
                )}
              </Table>
              {isReorderDragging && dropIndicatorX != null && (
                <DropIndicator dropIndicatorX={dropIndicatorX} wrapperLeft={wrapperRef.current?.getBoundingClientRect().left ?? 0} />
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
                <EmptyState emptyState={emptyState} />
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
              onSelectAll={o.interaction.handleSelectAllCells}
              onClose={closeContextMenu}
            />,
            wrapperRef.current?.closest('.fui-FluentProvider') as HTMLElement ?? document.body
          )}

        <ColumnHeaderMenu
          isOpen={headerMenu.isOpen}
          anchorElement={headerMenu.anchorElement}
          onClose={headerMenu.close}
          onPinLeft={headerMenu.handlePinLeft}
          onPinRight={headerMenu.handlePinRight}
          onUnpin={headerMenu.handleUnpin}
          onSortAsc={headerMenu.handleSortAsc}
          onSortDesc={headerMenu.handleSortDesc}
          onClearSort={headerMenu.handleClearSort}
          onAutosizeThis={headerMenu.handleAutosizeThis}
          onAutosizeAll={headerMenu.handleAutosizeAll}
          canPinLeft={headerMenu.canPinLeft}
          canPinRight={headerMenu.canPinRight}
          canUnpin={headerMenu.canUnpin}
          currentSort={headerMenu.currentSort}
          isSortable={headerMenu.isSortable}
          isResizable={headerMenu.isResizable}
        />
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
        <LoadingOverlay message={loadingMessage} />
      )}
    </div>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
