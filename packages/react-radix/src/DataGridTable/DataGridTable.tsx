import * as React from 'react';
import { useCallback, useRef, useMemo } from 'react';
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
} from '@alaarab/ogrid-react';
import {
  useDataGridState,
  useColumnResize,
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
  DEFAULT_MIN_COLUMN_WIDTH,
} from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';


// Module-scope stable constants (avoid per-render allocations)
const GRID_ROOT_STYLE: React.CSSProperties = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };
const CURSOR_CELL_STYLE: React.CSSProperties = { cursor: 'cell' };
const POPOVER_ANCHOR_STYLE: React.CSSProperties = { minHeight: '100%', minWidth: 40 };
const STOP_PROPAGATION = (e: React.MouseEvent) => e.stopPropagation();
const PREVENT_DEFAULT = (e: React.MouseEvent) => { e.preventDefault(); };
const NOOP = () => {};

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
    lastMouseShiftRef, hasCheckboxCol,
  } = props;

  return (
    <tr
      className={isSelected ? styles.selectedRow : ''}
      data-row-id={rowId}
      onClick={handleSingleRowClick}
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
      {visibleCols.map((col, colIdx) => (
        <td
          key={col.columnId}
          className={columnMeta.cellClasses[col.columnId] || undefined}
          style={columnMeta.cellStyles[col.columnId]}
        >
          {renderCellContent(item, col, rowIndex, colIdx)}
        </td>
      ))}
    </tr>
  );
}

const GridRow = React.memo(GridRowInner, areGridRowPropsEqual);

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });
  const lastMouseShiftRef = useRef(false);

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels } = state;
  const { visibleCols, totalColCount, hasCheckboxCol, colOffset, containerWidth, minTableWidth, desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides } = layout;
  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
  const { setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging } = interaction;
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
  } = props;

  // Memoize header rows (recursive tree traversal — avoid recomputing every render)
  const headerRows = useMemo(() => buildHeaderRows(columns, visibleColumns), [columns, visibleColumns]);

  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);
  const fitToContent = layoutMode === 'content';

  const { handleResizeStart, getColumnWidth } = useColumnResize<T>({
    columnSizingOverrides,
    setColumnSizingOverrides,
  });

  const editCallbacks = useMemo(() => ({ commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit }), [commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit]);
  const interactionHandlers = useMemo(() => ({ handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu }), [handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu]);

  // Refs for volatile state — lets renderCellContent be stable (same function ref across
  // selection changes) so that GridRow's React.memo comparator can skip unaffected rows.
  const cellDescriptorInputRef = useLatestRef(cellDescriptorInput);
  const pendingEditorValueRef = useLatestRef(pendingEditorValue);
  const popoverAnchorElRef = useLatestRef(popoverAnchorEl);

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
      const isFreezeCol = freezeCols != null && freezeCols >= 1 && i < freezeCols;
      const isPinnedLeft = col.pinned === 'left';
      const isPinnedRight = col.pinned === 'right';

      cellStyles[col.columnId] = {
        minWidth: col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
        width: hasExplicitWidth ? columnWidth : undefined,
        maxWidth: hasExplicitWidth ? columnWidth : undefined,
        textAlign: col.type === 'numeric' ? 'right' : col.type === 'boolean' ? 'center' : undefined,
      };

      hdrStyles[col.columnId] = {
        minWidth: col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
        width: hasExplicitWidth ? columnWidth : undefined,
        maxWidth: hasExplicitWidth ? columnWidth : undefined,
      };

      const parts: string[] = [];
      if (isFreezeCol) parts.push(styles.freezeCol);
      if (isFreezeCol && i === 0) parts.push(styles.freezeColFirst);
      if (isPinnedLeft) parts.push(styles.pinnedColLeft);
      if (isPinnedRight) parts.push(styles.pinnedColRight);
      const cn = parts.join(' ');
      cellClasses[col.columnId] = cn;
      hdrClasses[col.columnId] = cn;
    }

    return { cellStyles, cellClasses, hdrStyles, hdrClasses };
  }, [visibleCols, getColumnWidth, columnSizingOverrides, freezeCols]);

  // Stable row-click handler (avoids creating a new arrow function per row)
  const selectedRowIdsRef = useLatestRef(selectedRowIds);

  const handleSingleRowClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
    if (rowSelection !== 'single') return;
    const rowId = e.currentTarget.dataset.rowId;
    if (!rowId) return;
    const ids = selectedRowIdsRef.current;
    updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedRowIdsRef is a stable ref
  }, [rowSelection, updateSelection]);

  // Stable header select-all handler
  const handleSelectAllChecked = useCallback((c: boolean | 'indeterminate') => handleSelectAll(!!c), [handleSelectAll]);

  // renderCellContent reads volatile state from refs — keeps function identity stable so
  // GridRow's React.memo comparator can skip rows whose selection state hasn't changed.
  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current);
      const rowId = getRowId(item);

      let content: React.ReactNode;

      if (descriptor.mode === 'editing-inline') {
        content = <InlineCellEditor<T> {...buildInlineEditorProps(item, col, descriptor, editCallbacks)} />;
      } else if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
        const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValueRef.current, editCallbacks);
        const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
        content = (
          <Popover.Root open={!!popoverAnchorElRef.current} onOpenChange={(open: boolean) => { if (!open) cancelPopoverEdit(); }}>
            <Popover.Anchor asChild>
              <div ref={(el) => el && setPopoverAnchorEl(el)} style={POPOVER_ANCHOR_STYLE} aria-hidden />
            </Popover.Anchor>
            <Popover.Portal>
              <Popover.Content sideOffset={4} onOpenAutoFocus={(e: Event) => e.preventDefault()}>
                <CustomEditor {...editorProps} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      } else {
        const displayContent = resolveCellDisplayContent(col, item, descriptor.displayValue);
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
        onContextMenu={PREVENT_DEFAULT}
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
                        const leafRowSpan = headerRows.length > 1 && rowIdx < headerRows.length - 1
                          ? headerRows.length - rowIdx
                          : undefined;
                        return (
                          <th
                            key={col.columnId}
                            scope="col"
                            data-column-id={col.columnId}
                            rowSpan={leafRowSpan}
                            className={columnMeta.hdrClasses[col.columnId] || undefined}
                            style={columnMeta.hdrStyles[col.columnId]}
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
                          selectionRange={selectionRange}
                          activeCell={interaction.activeCell}
                          cutRange={cutRange}
                          copyRange={copyRange}
                          isDragging={isDragging}
                          editingRowId={editingCell?.rowId ?? null}
                        />
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
            <div className={styles.spinner} />
            <span className={styles.loadingOverlayText}>{loadingMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
