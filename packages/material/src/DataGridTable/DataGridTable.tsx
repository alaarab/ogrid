import * as React from 'react';
import { useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  Popover,
  Checkbox,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@mui/material';
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
  buildHeaderRows,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
} from '@alaarab/ogrid-core';


// ── Module-scope stable styles (avoid per-render Emotion resolutions) ──

const gridRootSx = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } as const;

// Row
const ROW_HOVER_SX = { '&:hover': { bgcolor: 'action.hover' } } as const;

// Checkbox column
const CHECKBOX_CELL_SX = { width: 48, minWidth: 48, maxWidth: 48, textAlign: 'center' } as const;
const CHECKBOX_WRAPPER_SX = { display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;
const CHECKBOX_PLACEHOLDER_SX = { width: 48, minWidth: 48, p: 0 } as const;

// Header
const STICKY_HEADER_SX = { position: 'sticky', top: 0, zIndex: 6, bgcolor: 'action.hover', '& th': { bgcolor: 'action.hover' } } as const;
const HEADER_ROW_SX = { bgcolor: 'action.hover' } as const;
const GROUP_HEADER_CELL_SX = { textAlign: 'center', fontWeight: 600, borderBottom: 2, borderColor: 'divider', py: 0.75 } as const;

// Cell content base variants (selected by column type + editability)
const CELL_CONTENT_BASE_SX = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'center', minWidth: 0,
  px: '10px', py: '6px', boxSizing: 'border-box', overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none', outline: 'none',
} as const;
const CELL_CONTENT_NUMERIC_SX = { ...CELL_CONTENT_BASE_SX, justifyContent: 'flex-end', textAlign: 'right' as const } as const;
const CELL_CONTENT_BOOLEAN_SX = { ...CELL_CONTENT_BASE_SX, justifyContent: 'center', textAlign: 'center' as const } as const;
const CELL_CONTENT_EDITABLE_SX = { ...CELL_CONTENT_BASE_SX, cursor: 'cell' } as const;
const CELL_CONTENT_NUMERIC_EDITABLE_SX = { ...CELL_CONTENT_NUMERIC_SX, cursor: 'cell' } as const;
const CELL_CONTENT_BOOLEAN_EDITABLE_SX = { ...CELL_CONTENT_BOOLEAN_SX, cursor: 'cell' } as const;

// Cell overlay states (only applied to the few active/selected cells)
const CELL_ACTIVE_SX = { outline: '2px solid #217346', outlineOffset: '-1px', zIndex: 2, position: 'relative' as const, overflow: 'visible' } as const;
const CELL_IN_RANGE_SX = { bgcolor: 'rgba(33, 115, 70, 0.12)' } as const;
const CELL_CUT_RANGE_SX = { bgcolor: 'action.hover', opacity: 0.7 } as const;

// Fill handle
const FILL_HANDLE_SX = {
  position: 'absolute', right: -3, bottom: -3, width: 7, height: 7,
  bgcolor: '#217346', border: '1px solid #fff', borderRadius: '1px',
  cursor: 'crosshair', pointerEvents: 'auto', zIndex: 3,
} as const;

// Cell <td> positioning variants
const CELL_TD_BASE_SX = { position: 'relative' as const, p: 0, height: '1px' } as const;
const CELL_TD_PINNED_LEFT_SX = { ...CELL_TD_BASE_SX, position: 'sticky' as const, left: 0, zIndex: 2, bgcolor: 'background.paper', willChange: 'transform' } as const;
const CELL_TD_PINNED_RIGHT_SX = { ...CELL_TD_BASE_SX, position: 'sticky' as const, right: 0, zIndex: 2, bgcolor: 'background.paper', willChange: 'transform' } as const;

// Header cell positioning variants
const HEADER_BASE_SX = { fontWeight: 600, position: 'relative' as const } as const;
const HEADER_PINNED_LEFT_SX = { ...HEADER_BASE_SX, position: 'sticky' as const, left: 0, top: 0, zIndex: 7, bgcolor: 'action.hover', willChange: 'transform' } as const;
const HEADER_PINNED_RIGHT_SX = { ...HEADER_BASE_SX, position: 'sticky' as const, right: 0, top: 0, zIndex: 7, bgcolor: 'action.hover', willChange: 'transform' } as const;

// Resize handle
const RESIZE_HANDLE_SX = {
  position: 'absolute', top: 0, right: '-3px', bottom: 0, width: '8px',
  cursor: 'col-resize', userSelect: 'none',
  '&::after': { content: '""', position: 'absolute', top: 0, right: '3px', bottom: 0, width: '2px' },
  '&:hover::after': { bgcolor: 'primary.main' },
  '&:active::after': { bgcolor: 'primary.dark' },
} as const;

// Popover
const POPOVER_ANCHOR_SX = { minHeight: '100%', minWidth: 40 } as const;
const POPOVER_CONTENT_SX = { p: 1 } as const;

// Wrapper
const WRAPPER_SCROLL_SX = { display: 'flex', flexDirection: 'column', minHeight: '100%' } as const;

// Module-scope event handlers
const STOP_PROPAGATION = (e: React.MouseEvent) => e.stopPropagation();
const PREVENT_DEFAULT = (e: React.MouseEvent) => { e.preventDefault(); };

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });
  const lastMouseShiftRef = useRef(false);

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels } = state;
  const { visibleCols, hasCheckboxCol, colOffset, containerWidth, minTableWidth, desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides } = layout;
  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
  const { setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo } = interaction;
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

  const fitToContent = layoutMode === 'content';
  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);

  // Memoize header rows (recursive tree traversal)
  const headerRows = useMemo(() => buildHeaderRows(props.columns, props.visibleColumns), [props.columns, props.visibleColumns]);

  const { handleResizeStart, getColumnWidth } = useColumnResize<T>({
    columnSizingOverrides,
    setColumnSizingOverrides,
  });

  const editCallbacks = useMemo(() => ({ commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit }), [commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit]);
  const interactionHandlers = useMemo(() => ({ handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu }), [handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu]);

  // Stable row-click handler
  const selectedRowIdsRef = useRef(selectedRowIds);
  selectedRowIdsRef.current = selectedRowIds;

  const handleSingleRowClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
    if (rowSelection !== 'single') return;
    const rowId = e.currentTarget.dataset.rowId;
    if (!rowId) return;
    const ids = selectedRowIdsRef.current;
    updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  }, [rowSelection, updateSelection]);

  // Wrapper sx (depends on dynamic values — memoize to avoid recreation)
  const wrapperSx = useMemo(() => ({
    position: 'relative' as const,
    flex: 1,
    minHeight: 0,
    width: fitToContent ? 'fit-content' : '100%',
    maxWidth: '100%',
    overflowX: suppressHorizontalScroll ? 'hidden' as const : allowOverflowX ? 'auto' as const : 'hidden' as const,
    overflowY: 'auto' as const,
    bgcolor: 'background.paper',
    willChange: 'scroll-position',
    '& [data-drag-range]': { bgcolor: 'rgba(33, 115, 70, 0.12) !important' },
  }), [fitToContent, suppressHorizontalScroll, allowOverflowX]);

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
          <>
            <Box ref={(el: HTMLDivElement | null) => { if (el) setPopoverAnchorEl(el); }} sx={POPOVER_ANCHOR_SX} aria-hidden />
            <Popover
              open={!!popoverAnchorEl}
              anchorEl={popoverAnchorEl}
              onClose={cancelPopoverEdit}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <Box sx={POPOVER_CONTENT_SX}>
                <CustomEditor {...editorProps} />
              </Box>
            </Popover>
          </>
        );
      }

      const content = resolveCellDisplayContent(col, item, descriptor.displayValue);
      const cellStyle = resolveCellStyle(col, item);
      const styledContent = cellStyle ? <Box component="span" sx={cellStyle}>{content}</Box> : content;

      // Select stable base sx by column type + editability (module-scope = Emotion cache hit)
      let baseSx;
      if (col.type === 'numeric') baseSx = descriptor.canEditAny ? CELL_CONTENT_NUMERIC_EDITABLE_SX : CELL_CONTENT_NUMERIC_SX;
      else if (col.type === 'boolean') baseSx = descriptor.canEditAny ? CELL_CONTENT_BOOLEAN_EDITABLE_SX : CELL_CONTENT_BOOLEAN_SX;
      else baseSx = descriptor.canEditAny ? CELL_CONTENT_EDITABLE_SX : CELL_CONTENT_BASE_SX;

      // Only build array sx for the few cells with overlay state
      const hasOverlay = (descriptor.isActive && !descriptor.isInRange) || descriptor.isInRange || descriptor.isInCutRange;
      const cellSx = hasOverlay
        ? [
            baseSx,
            descriptor.isActive && !descriptor.isInRange ? CELL_ACTIVE_SX : false,
            descriptor.isInRange ? CELL_IN_RANGE_SX : false,
            descriptor.isInCutRange ? CELL_CUT_RANGE_SX : false,
          ].filter(Boolean)
        : baseSx;

      const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

      return (
        <Box
          component="div"
          {...interactionProps}
          sx={cellSx}
        >
          {styledContent}
          {descriptor.canEditAny && descriptor.isSelectionEndCell && (
            <Box component="div" onMouseDown={handleFillHandleMouseDown} aria-label="Fill handle" sx={FILL_HANDLE_SX} />
          )}
        </Box>
      );
    },
    [cellDescriptorInput, pendingEditorValue, popoverAnchorEl, editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit]
  );

  return (
    <Box sx={gridRootSx}>
      <Box
        ref={wrapperRef}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
        aria-labelledby={ariaLabelledBy}
        onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
        onKeyDown={handleGridKeyDown}
        onContextMenu={PREVENT_DEFAULT}
        data-overflow-x={allowOverflowX ? 'true' : 'false'}
        sx={wrapperSx}
      >
      <Box sx={WRAPPER_SCROLL_SX}>
      <TableContainer sx={{ minWidth: allowOverflowX ? minTableWidth : undefined }}>
        <Box ref={tableContainerRef} sx={{ position: 'relative', opacity: isLoading && items.length > 0 ? 0.6 : 1 }}>
          <Table size="small" sx={{ overflow: 'hidden', minWidth: minTableWidth }}
            data-freeze-rows={freezeRows != null && freezeRows >= 1 ? freezeRows : undefined}
            data-freeze-cols={freezeCols != null && freezeCols >= 1 ? freezeCols : undefined}
          >
            <TableHead sx={STICKY_HEADER_SX}>
              {headerRows.map((row, rowIdx) => (
                <TableRow key={rowIdx} sx={HEADER_ROW_SX}>
                  {/* Checkbox column in the last (leaf) row only */}
                  {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                    <TableCell
                      padding="checkbox"
                      rowSpan={headerRows.length > 1 ? 1 : undefined}
                      sx={CHECKBOX_CELL_SX}
                    >
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={(_, c) => handleSelectAll(!!c)}
                        size="small"
                        aria-label="Select all rows"
                      />
                    </TableCell>
                  )}
                  {/* Empty placeholder for checkbox in the first group row */}
                  {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol && (
                    <TableCell rowSpan={headerRows.length - 1} sx={CHECKBOX_PLACEHOLDER_SX} />
                  )}
                  {row.map((cell, cellIdx) => {
                    if (cell.isGroup) {
                      return (
                        <TableCell
                          key={cellIdx}
                          colSpan={cell.colSpan}
                          component="th"
                          scope="colgroup"
                          sx={GROUP_HEADER_CELL_SX}
                        >
                          {cell.label}
                        </TableCell>
                      );
                    }
                    // Leaf cell
                    const col = cell.columnDef!;
                    const colIdx = visibleCols.indexOf(col);
                    const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                    const isPinnedLeft = col.pinned === 'left';
                    const isPinnedRight = col.pinned === 'right';
                    const columnWidth = getColumnWidth(col);
                    const headerSx = isPinnedLeft || (isFreezeCol && colIdx === 0) ? HEADER_PINNED_LEFT_SX : isPinnedRight ? HEADER_PINNED_RIGHT_SX : HEADER_BASE_SX;
                    return (
                      <TableCell
                        key={col.columnId}
                        component="th"
                        scope="col"
                        rowSpan={headerRows.length > 1 ? headerRows.length - rowIdx : undefined}
                        sx={headerSx}
                        style={{ minWidth: col.minWidth ?? 80, width: columnWidth, maxWidth: columnWidth }}
                      >
                        <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                        <Box onMouseDown={(e) => handleResizeStart(e, col)} sx={RESIZE_HANDLE_SX} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            {!showEmptyInGrid && (
              <TableBody>
                {items.map((item, rowIndex) => {
                  const rowIdStr = getRowId(item);
                  const isSelected = selectedRowIds.has(rowIdStr);
                  return (
                    <TableRow
                      key={rowIdStr}
                      selected={isSelected}
                      data-row-id={rowIdStr}
                      onClick={handleSingleRowClick}
                      sx={ROW_HOVER_SX}
                    >
                      {hasCheckboxCol && (
                        <TableCell padding="checkbox" sx={CHECKBOX_CELL_SX}>
                          <Box
                            data-row-index={rowIndex}
                            data-col-index={0}
                            onClick={STOP_PROPAGATION}
                            sx={CHECKBOX_WRAPPER_SX}
                          >
                            <Checkbox
                              checked={selectedRowIds.has(rowIdStr)}
                              onChange={(_, checked) => handleRowCheckboxChange(rowIdStr, checked, rowIndex, lastMouseShiftRef.current)}
                              size="small"
                              aria-label={`Select row ${rowIndex + 1}`}
                            />
                          </Box>
                        </TableCell>
                      )}
                      {visibleCols.map((col, colIdx) => {
                        const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                        const isPinnedLeft = col.pinned === 'left';
                        const isPinnedRight = col.pinned === 'right';
                        const columnWidth = getColumnWidth(col);
                        const tdSx = isPinnedLeft || (isFreezeCol && colIdx === 0) ? CELL_TD_PINNED_LEFT_SX : isPinnedRight ? CELL_TD_PINNED_RIGHT_SX : CELL_TD_BASE_SX;
                        return (
                          <TableCell
                            key={col.columnId}
                            sx={tdSx}
                            style={{ minWidth: col.minWidth ?? 80, width: columnWidth, maxWidth: columnWidth }}
                          >
                            {renderCellContent(item, col, rowIndex, colIdx)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </Table>
          <MarchingAntsOverlay
            containerRef={tableContainerRef}
            selectionRange={selectionRange}
            copyRange={copyRange}
            cutRange={cutRange}
            colOffset={colOffset}
          />
          {showEmptyInGrid && emptyState && (
            <Box sx={{ py: 4, px: 2, textAlign: 'center', borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
              {emptyState.render ? (
                emptyState.render()
              ) : (
                <>
                  <Typography variant="h6" gutterBottom>No results found</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {emptyState.message != null ? (
                      emptyState.message
                    ) : emptyState.hasActiveFilters ? (
                      <>
                        No items match your current filters. Try adjusting your search or{' '}
                        <Button variant="text" size="small" onClick={emptyState.onClearAll}>clear all filters</Button>{' '}
                        to see all items.
                      </>
                    ) : (
                      'There are no items available at this time.'
                    )}
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
      </TableContainer>
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
      </Box>

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
      </Box>
      {isLoading && items.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.7)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">{loadingMessage}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
