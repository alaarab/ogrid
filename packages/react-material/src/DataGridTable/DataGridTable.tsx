import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Popover,
  Checkbox,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  type TableCellProps,
  TableContainer,
} from '@mui/material';
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
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  PREVENT_DEFAULT,
  NOOP,
  STOP_PROPAGATION,
} from '@alaarab/ogrid-react';

// ── Type helpers for MUI TableCell HTML attributes ──
// MUI's TableCellProps doesn't expose rowSpan/colSpan in its types, but they're valid HTML attrs
type TableCellWithSpan = TableCellProps & {
  rowSpan?: number;
  colSpan?: number;
};

// ── Module-scope stable styles (avoid per-render Emotion resolutions) ──

const gridRootSx = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } as const;

// Editing cell wrapper (plain div, not MUI)
const EDITING_CELL_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  outline: '2px solid var(--ogrid-selection-color, #217346)',
  outlineOffset: '-1px',
  zIndex: 2,
  position: 'relative',
  background: 'var(--ogrid-bg, #fff)',
  overflow: 'visible',
  padding: 0,
};

// Row
const ROW_HOVER_SX = { '&:hover': { bgcolor: 'action.hover' } } as const;

// Checkbox column
const CHECKBOX_CELL_SX = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, textAlign: 'center' } as const;
const CHECKBOX_WRAPPER_SX = { display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;
const CHECKBOX_PLACEHOLDER_SX = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, p: 0 } as const;

// Header
const STICKY_HEADER_SX = {
  /* Removed position: 'sticky', top: 0 - breaks horizontal sticky on pinned columns.
     Instead, apply sticky to individual header cells (HEADER_BASE_SX). */
  zIndex: 8,
  bgcolor: 'action.hover',
  '& th': { bgcolor: 'action.hover' }
} as const;
const HEADER_ROW_SX = { bgcolor: 'action.hover' } as const;
const GROUP_HEADER_CELL_SX = { textAlign: 'center', fontWeight: 600, borderBottom: 2, borderColor: 'divider', py: 0.75 } as const;

// Density padding helper
function getDensityPadding(density: 'compact' | 'normal' | 'comfortable') {
  switch (density) {
    case 'compact': return { px: '8px', py: '4px' } as const;
    case 'comfortable': return { px: '16px', py: '12px' } as const;
    default: return { px: '10px', py: '6px' } as const;
  }
}

// Cell content base variants (selected by column type + editability)
const CELL_CONTENT_BASE_SX = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'center', minWidth: 0,
  px: '10px', py: '6px', boxSizing: 'border-box', overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'none', outline: 'none',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px', zIndex: 3 },
} as const;
const CELL_CONTENT_NUMERIC_SX = { ...CELL_CONTENT_BASE_SX, justifyContent: 'flex-end', textAlign: 'right' as const } as const;
const CELL_CONTENT_BOOLEAN_SX = { ...CELL_CONTENT_BASE_SX, justifyContent: 'center', textAlign: 'center' as const } as const;
const CELL_CONTENT_EDITABLE_SX = { ...CELL_CONTENT_BASE_SX, cursor: 'cell' } as const;
const CELL_CONTENT_NUMERIC_EDITABLE_SX = { ...CELL_CONTENT_NUMERIC_SX, cursor: 'cell' } as const;
const CELL_CONTENT_BOOLEAN_EDITABLE_SX = { ...CELL_CONTENT_BOOLEAN_SX, cursor: 'cell' } as const;

// Cell overlay states (only applied to the few active/selected cells)
// Active cell: theme-aware bg so dark mode doesn't show white (MUI action.hover adapts to theme)
const CELL_ACTIVE_SX = { outline: '2px solid var(--ogrid-selection, #217346)', outlineOffset: '-1px', zIndex: 2, position: 'relative' as const, overflow: 'visible', bgcolor: 'action.hover', '&:focus-visible': { outline: '2px solid var(--ogrid-selection, #217346)', outlineOffset: '-1px' } } as const;
const CELL_IN_RANGE_SX = { bgcolor: 'var(--ogrid-bg-range, rgba(33, 115, 70, 0.12))', '&:focus-visible': { outline: 'none' } } as const;
const CELL_CUT_RANGE_SX = { bgcolor: 'action.hover', opacity: 0.7 } as const;

// Pre-computed overlay variant arrays (avoid per-cell array allocation + filter)
// Key: `${base}_${overlay}` where overlay is 'active' | 'range' | 'cut'
const OVERLAY_VARIANTS = {
  base_active: [CELL_CONTENT_BASE_SX, CELL_ACTIVE_SX],
  base_range: [CELL_CONTENT_BASE_SX, CELL_IN_RANGE_SX],
  base_cut: [CELL_CONTENT_BASE_SX, CELL_IN_RANGE_SX, CELL_CUT_RANGE_SX],
  editable_active: [CELL_CONTENT_EDITABLE_SX, CELL_ACTIVE_SX],
  editable_range: [CELL_CONTENT_EDITABLE_SX, CELL_IN_RANGE_SX],
  editable_cut: [CELL_CONTENT_EDITABLE_SX, CELL_IN_RANGE_SX, CELL_CUT_RANGE_SX],
  numeric_active: [CELL_CONTENT_NUMERIC_SX, CELL_ACTIVE_SX],
  numeric_range: [CELL_CONTENT_NUMERIC_SX, CELL_IN_RANGE_SX],
  numeric_cut: [CELL_CONTENT_NUMERIC_SX, CELL_IN_RANGE_SX, CELL_CUT_RANGE_SX],
  numeric_editable_active: [CELL_CONTENT_NUMERIC_EDITABLE_SX, CELL_ACTIVE_SX],
  numeric_editable_range: [CELL_CONTENT_NUMERIC_EDITABLE_SX, CELL_IN_RANGE_SX],
  numeric_editable_cut: [CELL_CONTENT_NUMERIC_EDITABLE_SX, CELL_IN_RANGE_SX, CELL_CUT_RANGE_SX],
  boolean_active: [CELL_CONTENT_BOOLEAN_SX, CELL_ACTIVE_SX],
  boolean_range: [CELL_CONTENT_BOOLEAN_SX, CELL_IN_RANGE_SX],
  boolean_cut: [CELL_CONTENT_BOOLEAN_SX, CELL_IN_RANGE_SX, CELL_CUT_RANGE_SX],
  boolean_editable_active: [CELL_CONTENT_BOOLEAN_EDITABLE_SX, CELL_ACTIVE_SX],
  boolean_editable_range: [CELL_CONTENT_BOOLEAN_EDITABLE_SX, CELL_IN_RANGE_SX],
  boolean_editable_cut: [CELL_CONTENT_BOOLEAN_EDITABLE_SX, CELL_IN_RANGE_SX, CELL_CUT_RANGE_SX],
} as const;

/** Select pre-computed sx for a cell based on column type, editability, and overlay state. */
function getCellSx(
  colType: string | undefined,
  canEdit: boolean,
  isActive: boolean,
  isInRange: boolean,
  isInCutRange: boolean,
): object | readonly object[] {
  // Determine base key
  let baseKey: string;
  if (colType === 'numeric') baseKey = canEdit ? 'numeric_editable' : 'numeric';
  else if (colType === 'boolean') baseKey = canEdit ? 'boolean_editable' : 'boolean';
  else baseKey = canEdit ? 'editable' : 'base';

  // Determine overlay
  if (isInCutRange) return OVERLAY_VARIANTS[`${baseKey}_cut` as keyof typeof OVERLAY_VARIANTS];
  if (isInRange) return OVERLAY_VARIANTS[`${baseKey}_range` as keyof typeof OVERLAY_VARIANTS];
  if (isActive) return OVERLAY_VARIANTS[`${baseKey}_active` as keyof typeof OVERLAY_VARIANTS];

  // No overlay — return the base sx directly
  if (colType === 'numeric') return canEdit ? CELL_CONTENT_NUMERIC_EDITABLE_SX : CELL_CONTENT_NUMERIC_SX;
  if (colType === 'boolean') return canEdit ? CELL_CONTENT_BOOLEAN_EDITABLE_SX : CELL_CONTENT_BOOLEAN_SX;
  return canEdit ? CELL_CONTENT_EDITABLE_SX : CELL_CONTENT_BASE_SX;
}

// Fill handle
const FILL_HANDLE_SX = {
  position: 'absolute', right: -3, bottom: -3, width: 7, height: 7,
  bgcolor: 'var(--ogrid-selection, #217346)', border: '1px solid var(--ogrid-bg, #fff)', borderRadius: '1px',
  cursor: 'crosshair', pointerEvents: 'auto', zIndex: 3,
} as const;

// Cell <td> positioning variants
const CELL_TD_BASE_SX = { position: 'relative' as const, p: 0, height: '1px' } as const;
const CELL_TD_PINNED_LEFT_SX = {
  ...CELL_TD_BASE_SX, position: 'sticky' as const, left: 0, zIndex: 6,
  bgcolor: 'background.paper', willChange: 'transform',
  '&::after': {
    content: '""', position: 'absolute', top: '-1px', right: '-4px', bottom: '-1px',
    width: '4px', background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)', pointerEvents: 'none',
  },
} as const;
const CELL_TD_PINNED_RIGHT_SX = {
  ...CELL_TD_BASE_SX, position: 'sticky' as const, right: 0, zIndex: 6,
  bgcolor: 'background.paper', willChange: 'transform',
  '&::before': {
    content: '""', position: 'absolute', top: '-1px', left: '-4px', bottom: '-1px',
    width: '4px', background: 'linear-gradient(to left, rgba(0,0,0,0.12), transparent)', pointerEvents: 'none',
  },
} as const;

// Header cell positioning variants
const HEADER_BASE_SX = {
  fontWeight: 600,
  position: 'sticky' as const, /* Enables vertical sticky for all headers */
  top: 0, /* Sticky vertically */
  zIndex: 8, /* Stack above body cells */
  bgcolor: 'action.hover' /* Required for sticky overlap */
} as const;
const HEADER_PINNED_LEFT_SX = {
  ...HEADER_BASE_SX, position: 'sticky' as const, left: 0, top: 0,
  zIndex: 10, bgcolor: 'action.hover', willChange: 'transform',
  '&::after': {
    content: '""', position: 'absolute', top: '-1px', right: '-4px', bottom: '-1px',
    width: '4px', background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)', pointerEvents: 'none',
  },
} as const;
const HEADER_PINNED_RIGHT_SX = {
  ...HEADER_BASE_SX, position: 'sticky' as const, right: 0, top: 0,
  zIndex: 10, bgcolor: 'action.hover', willChange: 'transform',
  '&::before': {
    content: '""', position: 'absolute', top: '-1px', left: '-4px', bottom: '-1px',
    width: '4px', background: 'linear-gradient(to left, rgba(0,0,0,0.12), transparent)', pointerEvents: 'none',
  },
} as const;

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

// Table wrapper
const TABLE_WRAPPER_SX = { position: 'relative', opacity: 1 } as const;
const TABLE_WRAPPER_LOADING_SX = { position: 'relative', opacity: 0.6 } as const;

// TableBody — remove bottom border from last row so DataGridTable has no outer border
// (the OGridLayout container provides the border/radius)
const TABLE_BODY_SX = { '& tr:last-child td': { borderBottom: 'none' } } as const;

// --- Memoized row component (skips re-render for rows unaffected by selection changes) ---

/** Pre-computed per-column layout (avoids per-cell recalculation inside GridRow). */
interface ColumnLayout<T = unknown> {
  col: IColumnDef<T>;
  tdSx: object;
  minWidth: number;
  width: number;
  maxWidth: number;
}

interface GridRowProps {
  item: unknown;
  rowIndex: number;
  rowId: string | number;
  isSelected: boolean;
  columnLayouts: ColumnLayout<unknown>[];
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
    item, rowIndex, rowId, isSelected, columnLayouts,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
  } = props;

  return (
    <TableRow
      selected={isSelected}
      data-row-id={rowId}
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
              checked={isSelected}
              onChange={(_, checked) => handleRowCheckboxChange(rowId, checked, rowIndex, lastMouseShiftRef.current)}
              size="small"
              aria-label={`Select row ${rowIndex + 1}`}
            />
          </Box>
        </TableCell>
      )}
      {hasRowNumbersCol && (
        <TableCell
          sx={{
            width: ROW_NUMBER_COLUMN_WIDTH,
            minWidth: ROW_NUMBER_COLUMN_WIDTH,
            maxWidth: ROW_NUMBER_COLUMN_WIDTH,
            textAlign: 'center',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'text.secondary',
            backgroundColor: 'action.hover',
            position: 'sticky',
            left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
            zIndex: 3,
          }}
        >
          {rowNumberOffset + rowIndex + 1}
        </TableCell>
      )}
      {columnLayouts.map((cl, colIdx) => (
        <TableCell
          key={cl.col.columnId}
          data-column-id={cl.col.columnId}
          sx={[cl.tdSx, { minWidth: cl.minWidth, width: cl.width, maxWidth: cl.maxWidth }]}
        >
          {renderCellContent(item, cl.col, rowIndex, colIdx)}
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
    items, getRowId, emptyState,
    suppressHorizontalScroll, isLoading, loadingMessage,
    ariaLabel, ariaLabelledBy, columnReorder, density,
    rowNumberOffset, headerRows, allowOverflowX, fitToContent,
    editCallbacks, interactionHandlers,
    cellDescriptorInputRef, pendingEditorValueRef, popoverAnchorElRef,
    handleSingleRowClick, handlePasteVoid,
    visibleCols, hasCheckboxCol, hasRowNumbersCol, colOffset,
    minTableWidth, columnSizingOverrides, measuredColumnWidths,
    selectedRowIds, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected,
    editingCell, setPopoverAnchorEl, cancelPopoverEdit,
    setActiveCell, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown,
    handleCopy, handleCut, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
    menuPosition, closeContextMenu,
    headerFilterInput, statusBarConfig, showEmptyInGrid, onCellError,
  } = o;

  // Density-aware cell padding
  const densityPadding = useMemo(() => getDensityPadding(density), [density]);
  const _cellSx = useMemo(() => ({ ...CELL_CONTENT_BASE_SX, ...densityPadding }), [densityPadding]);
  const headerCellSx = useMemo(() => ({ px: densityPadding.px, py: densityPadding.py }), [densityPadding]);

  // Pre-compute per-column layout (tdSx, widths) so GridRow doesn't recalculate per-cell
  const columnLayouts = useMemo<ColumnLayout<T>[]>(() =>
    visibleCols.map((col) => {
      const isPinnedLeft = pinning.pinnedColumns[col.columnId] === 'left';
      const isPinnedRight = pinning.pinnedColumns[col.columnId] === 'right';
      const columnWidth = getColumnWidth(col);
      const baseTdSx = isPinnedLeft ? CELL_TD_PINNED_LEFT_SX : isPinnedRight ? CELL_TD_PINNED_RIGHT_SX : CELL_TD_BASE_SX;
      // Override sticky offset for pinned columns (supports multiple pinned columns)
      const tdSx = isPinnedLeft && pinning.leftOffsets[col.columnId] != null
        ? { ...baseTdSx, left: pinning.leftOffsets[col.columnId] } as typeof baseTdSx
        : isPinnedRight && pinning.rightOffsets[col.columnId] != null
          ? { ...baseTdSx, right: pinning.rightOffsets[col.columnId] } as typeof baseTdSx
          : baseTdSx;
      const hasResizeOverride = !!columnSizingOverrides[col.columnId];
      // Use previously-measured DOM width as a minWidth floor to prevent columns
      // from shrinking when new data loads (e.g. server-side pagination).
      const measuredW = measuredColumnWidths[col.columnId];
      const baseMinWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
      const effectiveMinWidth = hasResizeOverride ? columnWidth : Math.max(baseMinWidth, measuredW ?? 0);
      return { col, tdSx, minWidth: effectiveMinWidth, width: columnWidth, maxWidth: columnWidth };
    }),
  [visibleCols, getColumnWidth, columnSizingOverrides, measuredColumnWidths, pinning.pinnedColumns, pinning.leftOffsets, pinning.rightOffsets]);

  // Wrapper sx (depends on dynamic values — memoize to avoid recreation)
  const wrapperSx = useMemo(() => ({
    position: 'relative' as const,
    flex: 1,
    minHeight: isLoading && items.length === 0 ? 200 : 0,
    width: fitToContent ? 'fit-content' : '100%',
    maxWidth: '100%',
    overflowX: suppressHorizontalScroll ? 'hidden' as const : allowOverflowX ? 'auto' as const : 'hidden' as const,
    overflowY: 'auto' as const,
    bgcolor: 'background.paper',
    willChange: 'scroll-position',
    '& [data-drag-range]': { bgcolor: 'rgba(33, 115, 70, 0.12) !important' },
    '& [data-drag-anchor]': { bgcolor: 'background.paper !important' },
  }), [fitToContent, suppressHorizontalScroll, allowOverflowX, isLoading, items.length]);

  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current);
      const rowId = getRowId(item);

      let cellContent: React.ReactNode;

      if (descriptor.mode === 'editing-inline') {
        cellContent = (
          <div style={EDITING_CELL_STYLE}>
            <InlineCellEditor<T> {...buildInlineEditorProps(item, col, descriptor, editCallbacks) as InlineCellEditorProps<T>} />
          </div>
        );
      } else if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
        const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValueRef.current, editCallbacks) as ICellEditorProps<T>;
        const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
        cellContent = (
          <>
            <Box ref={(el: HTMLDivElement | null) => { if (el) setPopoverAnchorEl(el); }} sx={POPOVER_ANCHOR_SX} aria-hidden />
            <Popover
              open={!!popoverAnchorElRef.current}
              anchorEl={popoverAnchorElRef.current}
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
      } else {
        const content = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
        const cellStyle = resolveCellStyle(col, item);
        const styledContent = cellStyle ? <Box component="span" sx={cellStyle}>{content}</Box> : content;

        // Select pre-computed sx variant (module-scope = no per-cell allocation)
        const cellSx = getCellSx(
          col.type,
          descriptor.canEditAny,
          descriptor.isActive && !descriptor.isInRange,
          descriptor.isInRange,
          descriptor.isInCutRange,
        );

        const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

        cellContent = (
          <Box
            component="div"
            {...interactionProps}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sx={Array.isArray(cellSx) ? [...cellSx, densityPadding] : { ...cellSx, ...densityPadding } as any}
          >
            {styledContent}
            {descriptor.canEditAny && descriptor.isSelectionEndCell && (
              <Box component="div" onMouseDown={handleFillHandleMouseDown} aria-label="Fill handle" sx={FILL_HANDLE_SX} />
            )}
          </Box>
        );
      }

      return (
        <CellErrorBoundary key={`${rowId}-${col.columnId}`} onError={onCellError}>
          {cellContent}
        </CellErrorBoundary>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- *Ref vars are stable refs from useLatestRef
    [editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError]
  );

  return (
    <Box sx={gridRootSx}>
      <Box
        ref={wrapperRef}
        tabIndex={0}
        role="region"
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
        aria-labelledby={ariaLabelledBy}
        onMouseDown={(e: React.MouseEvent) => { lastMouseShiftRef.current = e.shiftKey; }}
        onKeyDown={handleGridKeyDown}
        onContextMenu={PREVENT_DEFAULT}
        data-overflow-x={allowOverflowX ? 'true' : 'false'}
        data-density={density}
        sx={wrapperSx}
      >
      <Box sx={WRAPPER_SCROLL_SX}>
      <TableContainer sx={{ minWidth: allowOverflowX ? minTableWidth : undefined }}>
        <Box ref={tableContainerRef} sx={isLoading && items.length > 0 ? TABLE_WRAPPER_LOADING_SX : TABLE_WRAPPER_SX}>
          <Table size="small" sx={{ minWidth: minTableWidth, borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <TableHead sx={STICKY_HEADER_SX}>
              {headerRows.map((row, rowIdx) => (
                <TableRow key={rowIdx} sx={HEADER_ROW_SX}>
                  {/* Checkbox column in the last (leaf) row only */}
                  {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                    <TableCell
                      {...({ padding: "checkbox", rowSpan: headerRows.length > 1 ? 1 : undefined, sx: CHECKBOX_CELL_SX } as TableCellWithSpan)}
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
                    <TableCell {...({ rowSpan: headerRows.length - 1, sx: CHECKBOX_PLACEHOLDER_SX } as TableCellWithSpan)} />
                  )}
                  {/* Row numbers column in the last (leaf) row only */}
                  {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (
                    <TableCell
                      {...({
                        component: "th",
                        scope: "col",
                        rowSpan: headerRows.length > 1 ? 1 : undefined,
                        sx: {
                          width: ROW_NUMBER_COLUMN_WIDTH,
                          minWidth: ROW_NUMBER_COLUMN_WIDTH,
                          maxWidth: ROW_NUMBER_COLUMN_WIDTH,
                          textAlign: 'center',
                          fontWeight: 600,
                          backgroundColor: 'action.hover',
                          position: 'sticky',
                          left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
                          zIndex: 4,
                          ...headerCellSx,
                        }
                      } as TableCellWithSpan)}
                    >
                      #
                    </TableCell>
                  )}
                  {/* Empty placeholder for row numbers in the first group row */}
                  {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol && (
                    <TableCell
                      {...({
                        rowSpan: headerRows.length - 1,
                        sx: {
                          width: ROW_NUMBER_COLUMN_WIDTH,
                          minWidth: ROW_NUMBER_COLUMN_WIDTH,
                          position: 'sticky',
                          left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
                          zIndex: 4,
                          backgroundColor: 'background.paper',
                        }
                      } as TableCellWithSpan)}
                    />
                  )}
                  {row.map((cell, cellIdx) => {
                    if (cell.isGroup) {
                      return (
                        <TableCell
                          key={cellIdx}
                          {...({
                            colSpan: cell.colSpan,
                            component: "th",
                            scope: "colgroup",
                            sx: GROUP_HEADER_CELL_SX
                          } as TableCellWithSpan)}
                        >
                          {cell.label}
                        </TableCell>
                      );
                    }
                    // Leaf cell
                    const col = cell.columnDef! as IColumnDef<T>;
                    const isPinnedLeft = pinning.pinnedColumns[col.columnId] === 'left';
                    const isPinnedRight = pinning.pinnedColumns[col.columnId] === 'right';
                    const columnWidth = getColumnWidth(col);
                    const baseHeaderSx = isPinnedLeft ? HEADER_PINNED_LEFT_SX : isPinnedRight ? HEADER_PINNED_RIGHT_SX : HEADER_BASE_SX;
                    // Override sticky offset for pinned columns (supports multiple pinned columns)
                    const headerSx = isPinnedLeft && pinning.leftOffsets[col.columnId] != null
                      ? { ...baseHeaderSx, left: pinning.leftOffsets[col.columnId] } as typeof baseHeaderSx
                      : isPinnedRight && pinning.rightOffsets[col.columnId] != null
                        ? { ...baseHeaderSx, right: pinning.rightOffsets[col.columnId] } as typeof baseHeaderSx
                        : baseHeaderSx;

                    // Determine aria-sort value for sorted columns
                    const isSorted = props.sortBy === col.columnId;
                    const ariaSort = isSorted
                      ? (props.sortDirection === 'asc' ? 'ascending' : 'descending')
                      : undefined;

                    return (
                      <TableCell
                        key={col.columnId}
                        {...({
                          component: "th",
                          scope: "col",
                          'data-column-id': col.columnId,
                          rowSpan: headerRows.length > 1 ? headerRows.length - rowIdx : undefined,
                          'aria-sort': ariaSort as 'ascending' | 'descending' | 'none' | undefined,
                          sx: {
                            ...headerSx,
                            ...headerCellSx,
                            minWidth: Math.max(col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH, measuredColumnWidths[col.columnId] ?? 0),
                            width: columnWidth,
                            maxWidth: columnWidth,
                            ...(columnReorder ? { cursor: isReorderDragging ? 'grabbing' : 'grab' } : {}),
                            '&:focus-visible': {
                              outline: '2px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: '-2px',
                              zIndex: 11,
                            },
                          },
                          onMouseDown: columnReorder ? (e: React.MouseEvent) => handleHeaderMouseDown(col.columnId, e) : undefined
                        } as TableCellWithSpan)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                          <Box
                            component="button"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              pinning.headerMenu.open(col.columnId, e.currentTarget);
                            }}
                            aria-label="Column options"
                            title="Column options"
                            sx={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '16px',
                              lineHeight: 1,
                              color: 'text.secondary',
                              opacity: 1,
                              transition: 'background-color 0.15s',
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '20px',
                              height: '20px',
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            ⋮
                          </Box>
                        </Box>
                        <Box onMouseDown={(e: React.MouseEvent) => {
                          setActiveCell(null);
                          interaction.setSelectionRange(null);
                          wrapperRef.current?.focus({ preventScroll: true });
                          handleResizeStart(e, col);
                        }} sx={RESIZE_HANDLE_SX} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            {!showEmptyInGrid && (
              <TableBody sx={TABLE_BODY_SX}>
                {virtualScrollEnabled && visibleRange.offsetTop > 0 && (
                  <TableRow style={{ height: visibleRange.offsetTop }} aria-hidden />
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
                          columnLayouts={columnLayouts as ColumnLayout<unknown>[]}
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
                          columnLayouts={columnLayouts as ColumnLayout<unknown>[]}
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
                  <TableRow style={{ height: visibleRange.offsetBottom }} aria-hidden />
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
            visibleColumns={props.visibleColumns}
            columnSizingOverrides={columnSizingOverrides}
            columnOrder={props.columnOrder}
          />
          {showEmptyInGrid && emptyState && (
            <EmptyState emptyState={emptyState} />
          )}
        </Box>
      </TableContainer>
      </Box>

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

        <ColumnHeaderMenu
          columnId={pinning.headerMenu.openForColumn || ''}
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
        />
      </Box>
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
    </Box>
  );
}

export const DataGridTable = React.memo(DataGridTableInner) as typeof DataGridTableInner;
