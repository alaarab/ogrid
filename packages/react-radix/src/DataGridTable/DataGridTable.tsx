import * as React from 'react';
import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { ColumnHeaderMenu } from '../ColumnHeaderMenu';
import { InlineCellEditor } from './InlineCellEditor';
import type { InlineCellEditorProps } from '@alaarab/ogrid-react';
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
  useColumnMeta,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  MarchingAntsOverlay,
  FormulaRefOverlay,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  areGridRowPropsEqual,
  partitionColumnsForVirtualization,
  CellErrorBoundary,
  GRID_ROOT_STYLE,
  CURSOR_CELL_STYLE,
  POPOVER_ANCHOR_STYLE,
  PREVENT_DEFAULT,
  NOOP,
  STOP_PROPAGATION,
  indexToColumnLetter,
  getColumnHeaderMenuProps,
  ROW_NUMBER_COLUMN_ID,
  ROW_NUMBER_COLUMN_WIDTH,
} from '@alaarab/ogrid-react';
import type { GridRowProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

const SPACER_TD_STYLE: React.CSSProperties = { padding: 0, border: 'none' };


// --- Memoized row component (skips re-render for rows unaffected by selection changes) ---

/** Extended props for column virtualization spacers. */
interface RadixGridRowProps extends GridRowProps {
  leftSpacerWidth?: number;
  rightSpacerWidth?: number;
  /** Maps local column index to global index in full visibleCols. */
  globalColIndexMap?: number[];
  /** Dynamic width for the row number column (from resize overrides). */
  rowNumWidth?: number;
}

function GridRowInner(props: RadixGridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
    leftSpacerWidth, rightSpacerWidth, globalColIndexMap, rowNumWidth,
  } = props;

  return (
    <tr
      className={isSelected ? styles.selectedRow : ''}
      data-row-id={rowId}
      onClick={handleSingleRowClick}
      aria-selected={isSelected || undefined}
    >
      {hasCheckboxCol && (
        <td className={styles.selectionCell}>
          <div
            className={styles.selectionCellInner}
            data-row-index={rowIndex}
            data-col-index={0}
            onClick={STOP_PROPAGATION}
          >
            <Checkbox.Root
              className={styles.rowCheckbox}
              checked={isSelected}
              onCheckedChange={(c: boolean | 'indeterminate') =>
                handleRowCheckboxChange(rowId, !!c, rowIndex, lastMouseShiftRef.current)
              }
              aria-label={`Select row ${rowIndex + 1}`}
            >
              <Checkbox.Indicator className={styles.rowCheckboxIndicator}>✓</Checkbox.Indicator>
            </Checkbox.Root>
          </div>
        </td>
      )}
      {hasRowNumbersCol && (
        <td className={styles.rowNumberCell} style={rowNumWidth ? { width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth } : undefined}>
          <div className={styles.rowNumberCellInner}>
            {rowNumberOffset + rowIndex + 1}
          </div>
        </td>
      )}
      {leftSpacerWidth != null && leftSpacerWidth > 0 && (
        <td style={{ ...SPACER_TD_STYLE, width: leftSpacerWidth, minWidth: leftSpacerWidth }} aria-hidden />
      )}
      {visibleCols.map((col, colIdx) => {
        const globalIdx = globalColIndexMap ? globalColIndexMap[colIdx] : colIdx;
        return (
          <td
            key={col.columnId}
            data-column-id={col.columnId}
            className={columnMeta.cellClasses[col.columnId] || undefined}
            style={columnMeta.cellStyles[col.columnId]}
          >
            {renderCellContent(item, col, rowIndex, globalIdx)}
          </td>
        );
      })}
      {rightSpacerWidth != null && rightSpacerWidth > 0 && (
        <td style={{ ...SPACER_TD_STYLE, width: rightSpacerWidth, minWidth: rightSpacerWidth }} aria-hidden />
      )}
    </tr>
  );
}

const GridRow = React.memo(GridRowInner, areGridRowPropsEqual);

// --- Table body with column virtualization support ---

interface RadixTableBodyProps<T> {
  virtualScrollEnabled: boolean;
  visibleRange: { startIndex: number; endIndex: number; offsetTop: number; offsetBottom: number };
  columnRange: import('@alaarab/ogrid-core').IVisibleColumnRange | null;
  items: T[];
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
}

function RadixTableBody<T>(props: RadixTableBodyProps<T>) {
  const {
    virtualScrollEnabled, visibleRange, columnRange,
    items, getRowId, selectedRowIds, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
    selectionRange, activeCell, cutRange, copyRange, isDragging,
    editingCell, pinnedColumns, rowNumWidth,
  } = props;

  // Partition columns when column virtualization is active
  const partition = React.useMemo(() => {
    if (!columnRange) return null;
    const p = partitionColumnsForVirtualization(
      visibleCols as Parameters<typeof partitionColumnsForVirtualization>[0],
      columnRange,
      pinnedColumns,
    );
    return p as unknown as { pinnedLeft: IColumnDef<T>[]; virtualizedUnpinned: IColumnDef<T>[]; pinnedRight: IColumnDef<T>[]; leftSpacerWidth: number; rightSpacerWidth: number };
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
      />
    );
  };

  return (
    <tbody>
      {virtualScrollEnabled && visibleRange.offsetTop > 0 && (
        <tr style={{ height: visibleRange.offsetTop }} aria-hidden />
      )}
      {virtualScrollEnabled
        ? items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, i) =>
            renderRow(item, visibleRange.startIndex + i)
          )
        : items.map((item, rowIndex) => renderRow(item, rowIndex))
      }
      {virtualScrollEnabled && visibleRange.offsetBottom > 0 && (
        <tr style={{ height: visibleRange.offsetBottom }} aria-hidden />
      )}
    </tbody>
  );
}

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const o = useDataGridTableOrchestration({ props });

  const {
    wrapperRef, tableContainerRef, lastMouseShiftRef,
    interaction, pinning,
    handleResizeStart, handleResizeDoubleClick, getColumnWidth, isReorderDragging, dropIndicatorX, handleHeaderMouseDown,
    virtualScrollEnabled, visibleRange, columnRange, onHorizontalScroll,
    items, getRowId, emptyState, rowSelection,
    isLoading, loadingMessage,
    ariaLabel, ariaLabelledBy, visibleColumns, columnOrder, columnReorder, density, rowHeight,
    rowNumberOffset, headerRows, allowOverflowX, fitToContent, showColumnLetters,
    editCallbacks, interactionHandlers,
    cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef,
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

  // Stable header select-all handler
  const handleSelectAllChecked = useCallback((c: boolean | 'indeterminate') => handleSelectAll(!!c), [handleSelectAll]);

  // Pre-compute column styles and classNames via shared hook (avoids per-cell object creation)
  const columnMeta = useColumnMeta({
    visibleCols,
    getColumnWidth,
    columnSizingOverrides,
    measuredColumnWidths,
    pinnedColumns: pinning.pinnedColumns,
    leftOffsets: pinning.leftOffsets,
    rightOffsets: pinning.rightOffsets,
    pinnedColLeftClass: styles.pinnedColLeft,
    pinnedColRightClass: styles.pinnedColRight,
  });

  // renderCellContent reads volatile state from refs -- keeps function identity stable so
  // GridRow's React.memo comparator can skip rows whose selection state hasn't changed.
  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current, cellDescriptorCacheRef.current);
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
          <Popover.Root open={!!popoverAnchorElRef.current} onOpenChange={(open: boolean) => { if (!open) cancelPopoverEdit(); }}>
            <Popover.Anchor asChild>
              <div ref={(el: HTMLDivElement | null) => { if (el) setPopoverAnchorEl(el); }} style={POPOVER_ANCHOR_STYLE} aria-hidden />
            </Popover.Anchor>
            <Popover.Portal>
              <Popover.Content sideOffset={4} onOpenAutoFocus={(e: Event) => e.preventDefault()}>
                <CustomEditor {...editorProps} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      } else {
        let displayNode: React.ReactNode;
        if (descriptor.columnType === 'boolean') {
          displayNode = <input type="checkbox" checked={!!descriptor.displayValue} disabled style={{ margin: 0, pointerEvents: 'none' }} aria-label={descriptor.displayValue ? 'True' : 'False'} />;
        } else {
          const displayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
          const cellStyle = resolveCellStyle(col, item, descriptor.displayValue);
          displayNode = cellStyle ? <span style={cellStyle}>{displayContent}</span> : displayContent;
        }

        const cellClassNames = `${styles.cellContent}${descriptor.isActive ? ` ${styles.activeCellContent}` : ''}${descriptor.isActive && descriptor.isInRange ? ` ${styles.inRange}` : ''}${descriptor.isInRange && !descriptor.isActive ? ` ${styles.cellInRange}` : ''}${descriptor.isInCutRange ? ` ${styles.cellCut}` : ''}${descriptor.isInCopyRange ? ` ${styles.cellCopied}` : ''}`;

        const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

        content = (
          <div
            className={cellClassNames}
            {...interactionProps}
            style={descriptor.canEditAny ? CURSOR_CELL_STYLE : undefined}
          >
            {displayNode}
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
    [editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError, cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef]
  );

  return (
    <div style={GRID_ROOT_STYLE}>
      <div
        ref={wrapperRef}
        tabIndex={0}
        onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
        onScroll={onHorizontalScroll ? (e) => onHorizontalScroll((e.target as HTMLElement).scrollLeft) : undefined}
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
              <table className={styles.dataTable} role="grid" data-virtual-scroll={virtualScrollEnabled ? '' : undefined}>
                <thead
                  className={o.stickyHeader ? styles.stickyHeader : undefined}
                >
                  {showColumnLetters && (
                    <tr className={styles.columnLetterRow}>
                      {hasCheckboxCol && <th className={styles.columnLetterCell} />}
                      {hasRowNumbersCol && <th className={styles.columnLetterCell} />}
                      {visibleCols.map((col, colIdx) => (
                        <th
                          key={col.columnId}
                          className={`${styles.columnLetterCell}${columnMeta.hdrClasses[col.columnId] ? ` ${columnMeta.hdrClasses[col.columnId]}` : ''}`}
                          style={columnMeta.hdrStyles[col.columnId]}
                        >
                          {indexToColumnLetter(colIdx)}
                        </th>
                      ))}
                    </tr>
                  )}
                  {headerRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {/* Checkbox header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                        <th className={styles.selectionHeaderCell} scope="col" rowSpan={1}>
                          <div className={styles.selectionHeaderCellInner}>
                            <Checkbox.Root
                              className={styles.rowCheckbox}
                              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                              onCheckedChange={handleSelectAllChecked}
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
                      {/* Row numbers header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (() => {
                        const rowNumWidth = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                        return (
                          <th className={styles.rowNumberHeaderCell} scope="col" rowSpan={1} style={{ width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth }}>
                            <div className={styles.rowNumberHeaderCellInner}>
                              #
                            </div>
                            <div
                              className={styles.resizeHandle}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label="Resize row number column"
                              onMouseDown={(e) => {
                                setActiveCell(null);
                                interaction.setSelectionRange(null);
                                wrapperRef.current?.focus({ preventScroll: true });
                                handleResizeStart(e, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<T>);
                              }}
                            />
                          </th>
                        );
                      })()}
                      {/* Empty placeholder for row numbers alignment in non-leaf rows */}
                      {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol && (
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
                        if (!cell.columnDef) return null;
                        const col = cell.columnDef as IColumnDef<T>;
                        const leafRowSpan = headerRows.length > 1 && rowIdx < headerRows.length - 1
                          ? headerRows.length - rowIdx
                          : undefined;

                        // Determine aria-sort value for sorted columns
                        const isSorted = props.sortBy === col.columnId;
                        const ariaSort = isSorted
                          ? (props.sortDirection === 'asc' ? 'ascending' : 'descending')
                          : undefined;

                        return (
                          <th
                            key={col.columnId}
                            scope="col"
                            data-column-id={col.columnId}
                            rowSpan={leafRowSpan}
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
                                  if (headerMenu.isOpen && headerMenu.openForColumn === col.columnId) {
                                    headerMenu.close();
                                  } else {
                                    headerMenu.open(col.columnId, e.currentTarget);
                                  }
                                }}
                                aria-label="Column options"
                                title="Column options"
                              >
                                ⋮
                              </button>
                            </div>
                            <div
                              className={styles.resizeHandle}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={`Resize ${col.name}`}
                              onMouseDown={(e) => {
                                // Clear cell selection/focus before resize so green outlines
                                // and blue :focus-visible rings don't persist during drag.
                                setActiveCell(null);
                                interaction.setSelectionRange(null);
                                // Move DOM focus to wrapper so no cell keeps :focus-visible
                                wrapperRef.current?.focus({ preventScroll: true });
                                handleResizeStart(e, col);
                              }}
                              onDoubleClick={(e) => handleResizeDoubleClick(e, col)}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                {!showEmptyInGrid && (
                  <RadixTableBody
                    virtualScrollEnabled={virtualScrollEnabled}
                    visibleRange={visibleRange}
                    columnRange={columnRange}
                    items={items}
                    getRowId={getRowId}
                    selectedRowIds={selectedRowIds}
                    visibleCols={visibleCols}
                    columnMeta={columnMeta}
                    renderCellContent={renderCellContent}
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
                    editingCell={editingCell}
                    pinnedColumns={pinning.pinnedColumns}
                    rowNumWidth={hasRowNumbersCol ? (columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH) : undefined}
                  />
                )}
              </table>
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
                isDragging={isDragging}
              />
              {props.formulaReferences && props.formulaReferences.length > 0 && (
                <FormulaRefOverlay
                  containerRef={tableContainerRef}
                  references={props.formulaReferences}
                  colOffset={colOffset}
                />
              )}
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
            document.body
          )}

        <ColumnHeaderMenu {...getColumnHeaderMenuProps(headerMenu)} />
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
