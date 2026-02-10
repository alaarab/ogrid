import * as React from 'react';
import { useCallback, useRef } from 'react';
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

/** @deprecated Use IOGridDataGridProps from @alaarab/ogrid-core for new code. */
export type IDataGridTableProps<T> = IOGridDataGridProps<T>;

function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const state = useDataGridState({ props, wrapperRef });
  const lastMouseShiftRef = useRef(false);

  const {
    visibleCols,
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
    desiredTableWidth,
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
    suppressHorizontalScroll,
    isLoading = false,
    loadingMessage = 'Loading\u2026',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const fitToContent = layoutMode === 'content';
  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);
  const headerRows = buildHeaderRows(props.columns, props.visibleColumns);

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
          <>
            <Box ref={(el: HTMLDivElement | null) => { if (el) setPopoverAnchorEl(el); }} sx={{ minHeight: '100%', minWidth: 40 }} aria-hidden />
            <Popover
              open={!!popoverAnchorEl}
              anchorEl={popoverAnchorEl}
              onClose={cancelPopoverEdit}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <Box sx={{ p: 1 }}>
                <CustomEditor {...editorProps} />
              </Box>
            </Popover>
          </>
        );
      }

      const content = resolveCellDisplayContent(col, item, descriptor.displayValue);
      const cellStyle = resolveCellStyle(col, item);
      const styledContent = cellStyle ? <Box component="span" sx={cellStyle}>{content}</Box> : content;

      const cellSx = {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        px: '10px',
        py: '6px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        outline: 'none',
        ...(col.type === 'numeric' && { justifyContent: 'flex-end', textAlign: 'right' as const }),
        ...(col.type === 'boolean' && { justifyContent: 'center', textAlign: 'center' as const }),
        ...(descriptor.isActive && !descriptor.isInRange && { outline: '2px solid #217346', outlineOffset: '-1px', zIndex: 2, position: 'relative' as const, overflow: 'visible' }),
        ...(descriptor.isInRange && { bgcolor: 'rgba(33, 115, 70, 0.12)' }),
        ...(descriptor.isInCutRange && { bgcolor: 'action.hover', opacity: 0.7 }),
      };

      const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

      return (
        <Box
          component="div"
          {...interactionProps}
          sx={descriptor.canEditAny ? [{ cursor: 'cell' }, cellSx] : cellSx}
        >
          {styledContent}
          {descriptor.canEditAny && descriptor.isSelectionEndCell && (
            <Box
              component="div"
              onMouseDown={handleFillHandleMouseDown}
              aria-label="Fill handle"
              sx={{
                position: 'absolute',
                right: -3,
                bottom: -3,
                width: 7,
                height: 7,
                bgcolor: '#217346',
                border: '1px solid #fff',
                borderRadius: '1px',
                cursor: 'crosshair',
                pointerEvents: 'auto',
                zIndex: 3,
              }}
            />
          )}
        </Box>
      );
    },
    [cellDescriptorInput, pendingEditorValue, popoverAnchorEl, editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit]
  );

  return (
    <Box
      ref={wrapperRef}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
      aria-labelledby={ariaLabelledBy}
      onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
      onKeyDown={handleGridKeyDown}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault();
      }}
      data-overflow-x={allowOverflowX ? 'true' : 'false'}
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        width: fitToContent ? 'fit-content' : '100%',
        maxWidth: '100%',
        overflowX: suppressHorizontalScroll ? 'hidden' : (allowOverflowX ? 'auto' : 'hidden'),
        overflowY: 'auto',
        bgcolor: 'background.paper',
        // Drag-range highlight applied via DOM attributes during drag (bypasses React for performance)
        '& [data-drag-range]': { bgcolor: 'rgba(33, 115, 70, 0.12) !important' },
      }}
    >
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
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <TableContainer sx={{ minWidth: allowOverflowX ? minTableWidth : undefined }}>
        <Box ref={tableContainerRef} sx={{ position: 'relative', opacity: isLoading && items.length > 0 ? 0.6 : 1 }}>
          <Table size="small" sx={{ overflow: 'hidden', minWidth: minTableWidth }}
            data-freeze-rows={freezeRows != null && freezeRows >= 1 ? freezeRows : undefined}
            data-freeze-cols={freezeCols != null && freezeCols >= 1 ? freezeCols : undefined}
          >
            <TableHead
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                bgcolor: 'action.hover',
                '& th': { bgcolor: 'action.hover' },
              }}
            >
              {headerRows.map((row, rowIdx) => (
                <TableRow key={rowIdx} sx={{ bgcolor: 'action.hover' }}>
                  {/* Checkbox column in the last (leaf) row only */}
                  {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                    <TableCell
                      padding="checkbox"
                      rowSpan={headerRows.length > 1 ? 1 : undefined}
                      sx={{ width: 48, minWidth: 48, maxWidth: 48, textAlign: 'center' }}
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
                    <TableCell rowSpan={headerRows.length - 1} sx={{ width: 48, minWidth: 48, p: 0 }} />
                  )}
                  {row.map((cell, cellIdx) => {
                    if (cell.isGroup) {
                      return (
                        <TableCell
                          key={cellIdx}
                          colSpan={cell.colSpan}
                          component="th"
                          scope="colgroup"
                          sx={{
                            textAlign: 'center',
                            fontWeight: 600,
                            borderBottom: 2,
                            borderColor: 'divider',
                            py: 0.75,
                          }}
                        >
                          {cell.label}
                        </TableCell>
                      );
                    }
                    // Leaf cell — existing header rendering with ColumnHeaderFilter + resize handle
                    const col = cell.columnDef!;
                    const colIdx = visibleCols.indexOf(col);
                    const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
                    const isPinnedLeft = col.pinned === 'left';
                    const isPinnedRight = col.pinned === 'right';
                    const columnWidth = getColumnWidth(col);
                    return (
                      <TableCell
                        key={col.columnId}
                        component="th"
                        scope="col"
                        rowSpan={headerRows.length > 1 ? headerRows.length - rowIdx : undefined}
                        sx={{
                          minWidth: col.minWidth ?? 80,
                          width: columnWidth,
                          maxWidth: columnWidth,
                          fontWeight: 600,
                          position: 'relative',
                          ...(isFreezeCol && colIdx === 0
                            ? {
                                position: 'sticky',
                                left: 0,
                                zIndex: 2,
                                bgcolor: 'action.hover',
                              }
                            : {}),
                          ...(isPinnedLeft
                            ? {
                                position: 'sticky',
                                left: 0,
                                zIndex: 2,
                                bgcolor: 'action.hover',
                              }
                            : {}),
                          ...(isPinnedRight
                            ? {
                                position: 'sticky',
                                right: 0,
                                zIndex: 2,
                                bgcolor: 'action.hover',
                              }
                            : {}),
                        }}
                      >
                        <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                        <Box
                          onMouseDown={(e) => handleResizeStart(e, col)}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: '-3px',
                            bottom: 0,
                            width: '8px',
                            cursor: 'col-resize',
                            userSelect: 'none',
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              right: '3px',
                              bottom: 0,
                              width: '2px',
                            },
                            '&:hover::after': {
                              bgcolor: 'primary.main',
                            },
                            '&:active::after': {
                              bgcolor: 'primary.dark',
                            },
                          }}
                        />
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
                      onClick={() => {
                        if (rowSelection === 'single') {
                          const id = getRowId(item);
                          updateSelection(selectedRowIds.has(id) ? new Set() : new Set([id]));
                        }
                      }}
                      sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      {hasCheckboxCol && (
                        <TableCell padding="checkbox" sx={{ width: 48, minWidth: 48, maxWidth: 48, textAlign: 'center' }}>
                          <Box
                            data-row-index={rowIndex}
                            data-col-index={0}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                        return (
                          <TableCell
                            key={col.columnId}
                            sx={{
                              minWidth: col.minWidth ?? 80,
                              width: columnWidth,
                              maxWidth: columnWidth,
                              position: 'relative',
                              p: 0,
                              height: '1px',
                              ...(isFreezeCol && colIdx === 0
                                ? {
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 2,
                                    bgcolor: 'background.paper',
                                  }
                                : {}),
                              ...(isPinnedLeft
                                ? {
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 2,
                                    bgcolor: 'background.paper',
                                  }
                                : {}),
                              ...(isPinnedRight
                                ? {
                                    position: 'sticky',
                                    right: 0,
                                    zIndex: 2,
                                    bgcolor: 'background.paper',
                                  }
                                : {}),
                            }}
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
    </Box>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
