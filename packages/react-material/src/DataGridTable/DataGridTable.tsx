import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Popover,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  type TableCellProps,
} from '@mui/material';
import { injectDataGridStyles } from './DataGridTable.styles';
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
  CellErrorBoundary,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_ID,
  PREVENT_DEFAULT,
  NOOP,
  STOP_PROPAGATION,
  partitionColumnsForVirtualization,
  indexToColumnLetter,
  getColumnHeaderMenuProps,
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

// Checkbox column (header only — body uses native elements + CSS class)
const CHECKBOX_CELL_SX = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, textAlign: 'center' } as const;
const CHECKBOX_PLACEHOLDER_SX = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, p: 0 } as const;

// Body checkbox td (native element)
const CHECKBOX_TD_STYLE: React.CSSProperties = {
  width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH,
  textAlign: 'center', padding: 0, position: 'relative', height: '1px',
  borderBottom: '1px solid var(--ogrid-border, rgba(224,224,224,1))',
};

// Header — use opaque var(--ogrid-header-bg) (not semi-transparent action.hover) so sticky
// headers fully occlude pinned-column content scrolling beneath them.
// The CSS variable is theme-aware: light=#f5f5f5, dark=#2c2c2c (set by each UI package).
const HEADER_BG = 'var(--ogrid-header-bg, #f5f5f5)';
const STICKY_HEADER_SX = {
  /* Removed position: 'sticky', top: 0 - breaks horizontal sticky on pinned columns.
     Instead, apply sticky to individual header cells (HEADER_BASE_SX). */
  zIndex: 8,
  bgcolor: HEADER_BG,
  '& th': { bgcolor: HEADER_BG }
} as const;
const HEADER_ROW_SX = { bgcolor: HEADER_BG } as const;
const COLUMN_LETTER_CELL_SX = {
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 500,
  color: 'text.secondary',
  py: '2px',
  px: '4px',
  bgcolor: HEADER_BG,
  borderBottom: 1,
  borderColor: 'divider',
  userSelect: 'none',
  fontVariantNumeric: 'tabular-nums',
} as const;
const GROUP_HEADER_CELL_SX = { textAlign: 'center', fontWeight: 600, borderBottom: 2, borderColor: 'divider', py: 0.75 } as const;

// Density padding helper
function getDensityPadding(density: 'compact' | 'normal' | 'comfortable') {
  switch (density) {
    case 'compact': return { px: '8px', py: '4px' } as const;
    case 'comfortable': return { px: '16px', py: '12px' } as const;
    default: return { px: '10px', py: '6px' } as const;
  }
}

// Density padding for body cells (React.CSSProperties for native elements)
const DENSITY_CELL_STYLES: Record<string, React.CSSProperties> = {
  compact: { padding: '4px 8px' },
  normal: { padding: '6px 10px' },
  comfortable: { padding: '12px 16px' },
};

// Header cell positioning variants (sticky)
// Use opaque HEADER_BG so headers fully occlude content scrolling beneath them.
const HEADER_BASE_SX = {
  fontWeight: 600,
  position: 'sticky' as const, /* Enables vertical sticky for all headers */
  top: 0, /* Sticky vertically */
  zIndex: 8, /* Stack above body cells */
  bgcolor: HEADER_BG /* Opaque — required for sticky overlap */
} as const;
const HEADER_PINNED_LEFT_SX = {
  ...HEADER_BASE_SX, position: 'sticky' as const, left: 0, top: 0,
  zIndex: 10, bgcolor: HEADER_BG, willChange: 'transform',
  borderRight: '1px solid', borderRightColor: 'divider',
  boxShadow: '2px 0 4px -1px rgba(0,0,0,0.1)',
} as const;
const HEADER_PINNED_RIGHT_SX = {
  ...HEADER_BASE_SX, position: 'sticky' as const, right: 0, top: 0,
  zIndex: 10, bgcolor: HEADER_BG, willChange: 'transform',
  borderLeft: '1px solid', borderLeftColor: 'divider',
  boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.1)',
} as const;

// Header cell variants (non-sticky — stickyHeader=false)
const HEADER_BASE_NO_STICKY_SX = {
  fontWeight: 600,
  zIndex: 8,
  bgcolor: HEADER_BG,
} as const;
const HEADER_PINNED_LEFT_NO_STICKY_SX = {
  ...HEADER_BASE_NO_STICKY_SX, position: 'sticky' as const, left: 0,
  zIndex: 10, bgcolor: HEADER_BG, willChange: 'transform',
  borderRight: '1px solid', borderRightColor: 'divider',
  boxShadow: '2px 0 4px -1px rgba(0,0,0,0.1)',
} as const;
const HEADER_PINNED_RIGHT_NO_STICKY_SX = {
  ...HEADER_BASE_NO_STICKY_SX, position: 'sticky' as const, right: 0,
  zIndex: 10, bgcolor: HEADER_BG, willChange: 'transform',
  borderLeft: '1px solid', borderLeftColor: 'divider',
  boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.1)',
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

// Header cell content wrapper
const HEADER_CONTENT_FLEX_SX = { display: 'flex', alignItems: 'center', gap: 0.5 } as const;

// Column options button
const COLUMN_OPTIONS_BUTTON_SX = {
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
} as const;

// Table wrapper
const TABLE_WRAPPER_SX = { position: 'relative', opacity: 1 } as const;
const TABLE_WRAPPER_LOADING_SX = { position: 'relative', opacity: 0.6 } as const;

// --- Memoized row component (skips re-render for rows unaffected by selection changes) ---

/** Pre-computed per-column layout (avoids per-cell recalculation inside GridRow). */
interface ColumnLayout<T = unknown> {
  col: IColumnDef<T>;
  tdClassName: string;
  tdStyle: React.CSSProperties;
  minWidth: number;
  width: number;
  maxWidth: number;
}

const SPACER_TD_STYLE: React.CSSProperties = { padding: 0, border: 'none' };

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
  rowHeight?: number | string;
  leftSpacerWidth?: number;
  rightSpacerWidth?: number;
  /** Maps local column index to global index in full visibleCols. */
  globalColIndexMap?: number[];
  // Comparator-only props (drive re-render decisions, not used in render body)
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  cutRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  copyRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isDragging: boolean;
  editingRowId: string | number | null;
  rowNumWidth?: number;
}

function GridRowInner(props: GridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, columnLayouts,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset, rowHeight,
    leftSpacerWidth, rightSpacerWidth, globalColIndexMap, rowNumWidth,
  } = props;

  return (
    <tr
      data-row-id={rowId}
      onClick={handleSingleRowClick}
      aria-selected={isSelected || undefined}
      className={`ogrid-mat-row${isSelected ? ' ogrid-mat-row--selected' : ''}`}
      style={rowHeight ? { height: rowHeight } : undefined}
    >
      {hasCheckboxCol && (
        <td style={CHECKBOX_TD_STYLE}>
          <div
            data-row-index={rowIndex}
            data-col-index={0}
            onClick={STOP_PROPAGATION}
            className="ogrid-mat-checkbox-wrapper"
          >
            <Checkbox
              checked={isSelected}
              onChange={(_, checked) => handleRowCheckboxChange(rowId, checked, rowIndex, lastMouseShiftRef.current)}
              size="small"
              aria-label={`Select row ${rowIndex + 1}`}
            />
          </div>
        </td>
      )}
      {hasRowNumbersCol && (() => {
        const rnw = rowNumWidth ?? ROW_NUMBER_COLUMN_WIDTH;
        return (
          <td
            className="ogrid-mat-td ogrid-mat-row-number"
            style={{
              width: rnw,
              minWidth: rnw,
              maxWidth: rnw,
              left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
              borderBottom: '1px solid var(--ogrid-border, rgba(224,224,224,1))',
            }}
          >
            {rowNumberOffset + rowIndex + 1}
          </td>
        );
      })()}
      {leftSpacerWidth != null && leftSpacerWidth > 0 && (
        <td style={{ ...SPACER_TD_STYLE, width: leftSpacerWidth, minWidth: leftSpacerWidth }} aria-hidden />
      )}
      {columnLayouts.map((cl, colIdx) => {
        const globalIdx = globalColIndexMap ? globalColIndexMap[colIdx] : colIdx;
        return (
          <td
            key={cl.col.columnId}
            data-column-id={cl.col.columnId}
            className={cl.tdClassName}
            style={{ ...cl.tdStyle, minWidth: cl.minWidth, width: cl.width, maxWidth: cl.maxWidth }}
          >
            {renderCellContent(item, cl.col, rowIndex, globalIdx)}
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

// Inject CSS once on first render (no separate CSS file needed by consumers)
injectDataGridStyles();

// --- Table body with column virtualization support ---

interface MaterialTableBodyProps<T> {
  virtualScrollEnabled: boolean;
  visibleRange: { startIndex: number; endIndex: number; offsetTop: number; offsetBottom: number };
  columnRange: import('@alaarab/ogrid-core').IVisibleColumnRange | null;
  items: T[];
  getRowId: (item: T) => string | number;
  selectedRowIds: Set<string | number>;
  visibleCols: IColumnDef<T>[];
  columnLayouts: ColumnLayout<T>[];
  renderCellContent: (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number) => React.ReactNode;
  handleSingleRowClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  handleRowCheckboxChange: (rowId: string | number, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  lastMouseShiftRef: React.MutableRefObject<boolean>;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowNumberOffset: number;
  rowHeight?: number;
  selectionRange: GridRowProps['selectionRange'];
  activeCell: GridRowProps['activeCell'];
  cutRange: GridRowProps['cutRange'];
  copyRange: GridRowProps['copyRange'];
  isDragging: boolean;
  editingCell: { rowId: string | number; columnId: string } | null;
  pinnedColumns: Record<string, 'left' | 'right'>;
  rowNumWidth?: number;
}

function MaterialTableBody<T>(props: MaterialTableBodyProps<T>) {
  const {
    virtualScrollEnabled, visibleRange, columnRange,
    items, getRowId, selectedRowIds, visibleCols, columnLayouts,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset, rowHeight,
    selectionRange, activeCell, cutRange, copyRange, isDragging,
    editingCell, pinnedColumns, rowNumWidth,
  } = props;

  // Partition columns and produce matching columnLayouts when column virtualization is active
  const { rowLayouts, globalColIndexMap, leftSpacerWidth, rightSpacerWidth } = React.useMemo(() => {
    if (!columnRange) {
      return { rowLayouts: columnLayouts, globalColIndexMap: undefined, leftSpacerWidth: undefined, rightSpacerWidth: undefined };
    }
    const partition = partitionColumnsForVirtualization(
      visibleCols as Parameters<typeof partitionColumnsForVirtualization>[0],
      columnRange,
      pinnedColumns,
    );
    const combined = [...partition.pinnedLeft, ...partition.virtualizedUnpinned, ...partition.pinnedRight] as unknown as IColumnDef<T>[];
    // Build matching columnLayouts for the partitioned columns
    const layoutMap = new Map(columnLayouts.map(cl => [cl.col.columnId, cl]));
    const partitionedLayouts: ColumnLayout<T>[] = [];
    const idxMap: number[] = [];
    for (const col of combined) {
      const layout = layoutMap.get(col.columnId);
      if (layout) {
        partitionedLayouts.push(layout);
        idxMap.push(visibleCols.indexOf(col));
      }
    }
    return {
      rowLayouts: partitionedLayouts,
      globalColIndexMap: idxMap,
      leftSpacerWidth: partition.leftSpacerWidth,
      rightSpacerWidth: partition.rightSpacerWidth,
    };
  }, [columnRange, visibleCols, columnLayouts, pinnedColumns]);

  const renderRow = (item: T, rowIndex: number) => {
    const rowIdStr = getRowId(item);
    return (
      <GridRow
        key={rowIdStr}
        item={item}
        rowIndex={rowIndex}
        rowId={rowIdStr}
        isSelected={selectedRowIds.has(rowIdStr)}
        columnLayouts={rowLayouts as ColumnLayout<unknown>[]}
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
        rowHeight={rowHeight}
        editingRowId={editingCell?.rowId ?? null}
        leftSpacerWidth={leftSpacerWidth}
        rightSpacerWidth={rightSpacerWidth}
        globalColIndexMap={globalColIndexMap}
        rowNumWidth={rowNumWidth}
      />
    );
  };

  return (
    <tbody className="ogrid-mat-tbody">
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
    items, getRowId, emptyState,
    suppressHorizontalScroll, isLoading, loadingMessage,
    ariaLabel, ariaLabelledBy, columnReorder, density, rowHeight,
    rowNumberOffset, headerRows, allowOverflowX, fitToContent, showColumnLetters,
    editCallbacks, interactionHandlers,
    cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef,
    handleSingleRowClick, handlePasteVoid,
    visibleCols, hasCheckboxCol, hasRowNumbersCol, colOffset,
    minTableWidth, columnSizingOverrides, measuredColumnWidths,
    selectedRowIds, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected,
    editingCell, setPopoverAnchorEl, cancelPopoverEdit,
    setActiveCell, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown,
    handleCopy, handleCut, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
    menuPosition, closeContextMenu,
    headerFilterInput, statusBarConfig, showEmptyInGrid, onCellError,
    headerMenu,
  } = o;

  // Density-aware cell padding
  const densityPadding = useMemo(() => getDensityPadding(density), [density]);
  const headerCellSx = useMemo(() => ({ px: densityPadding.px, py: densityPadding.py }), [densityPadding]);

  // Shared width/minWidth computation (deduped with Radix/Fluent via useColumnMeta)
  const columnMeta = useColumnMeta({
    visibleCols,
    getColumnWidth,
    columnSizingOverrides,
    measuredColumnWidths,
    pinnedColumns: pinning.pinnedColumns,
    leftOffsets: pinning.leftOffsets,
    rightOffsets: pinning.rightOffsets,
    pinnedColLeftClass: '',
    pinnedColRightClass: '',
  });

  // Pre-compute per-column layout (className + style from columnMeta) so GridRow doesn't recalculate per-cell
  const columnLayouts = useMemo<ColumnLayout<T>[]>(() =>
    visibleCols.map((col) => {
      const isPinnedLeft = pinning.pinnedColumns[col.columnId] === 'left';
      const isPinnedRight = pinning.pinnedColumns[col.columnId] === 'right';
      let tdClassName = 'ogrid-mat-td';
      const tdStyle: React.CSSProperties = {};
      if (isPinnedLeft) {
        tdClassName += ' ogrid-mat-td--pinned-left';
        if (pinning.leftOffsets[col.columnId] != null) tdStyle.left = pinning.leftOffsets[col.columnId];
      } else if (isPinnedRight) {
        tdClassName += ' ogrid-mat-td--pinned-right';
        if (pinning.rightOffsets[col.columnId] != null) tdStyle.right = pinning.rightOffsets[col.columnId];
      }
      const cellMeta = columnMeta.cellStyles[col.columnId];
      return {
        col,
        tdClassName,
        tdStyle,
        minWidth: (cellMeta?.minWidth as number) ?? 0,
        width: (cellMeta?.width as number) ?? getColumnWidth(col),
        maxWidth: (cellMeta?.maxWidth as number) ?? getColumnWidth(col),
      };
    }),
  [visibleCols, columnMeta, pinning.pinnedColumns, pinning.leftOffsets, pinning.rightOffsets, getColumnWidth]);

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
  }), [fitToContent, suppressHorizontalScroll, allowOverflowX, isLoading, items.length]);

  // Density padding for native cell content (avoids Emotion)
  const cellDensityStyle = DENSITY_CELL_STYLES[density] ?? DENSITY_CELL_STYLES.normal;

  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current, cellDescriptorCacheRef.current);
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
        let displayNode: React.ReactNode;
        if (descriptor.columnType === 'boolean') {
          displayNode = <input type="checkbox" checked={!!descriptor.displayValue} disabled style={{ margin: 0, pointerEvents: 'none' }} aria-label={descriptor.displayValue ? 'True' : 'False'} />;
        } else {
          const content = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
          const cellStyle = resolveCellStyle(col, item, descriptor.displayValue);
          displayNode = cellStyle ? <span style={cellStyle}>{content}</span> : content;
        }

        // Build className string (CSS classes — zero Emotion overhead)
        let cls = 'ogrid-mat-cell';
        if (col.type === 'numeric') cls += ' ogrid-mat-cell--numeric';
        else if (col.type === 'boolean') cls += ' ogrid-mat-cell--boolean';
        if (descriptor.canEditAny) cls += ' ogrid-mat-cell--editable';
        if (descriptor.isActive) cls += ' ogrid-mat-cell--active';
        if (descriptor.isActive && descriptor.isInRange) cls += ' ogrid-mat-cell--active-in-range';
        if (descriptor.isInRange && !descriptor.isActive) cls += ' ogrid-mat-cell--range';
        if (descriptor.isInCutRange) cls += ' ogrid-mat-cell--cut';

        const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

        cellContent = (
          <div
            className={cls}
            {...interactionProps}
            style={cellDensityStyle}
          >
            {displayNode}
            {descriptor.canEditAny && descriptor.isSelectionEndCell && (
              <div className="ogrid-mat-fill-handle" onMouseDown={handleFillHandleMouseDown} aria-label="Fill handle" />
            )}
          </div>
        );
      }

      return (
        <CellErrorBoundary key={`${rowId}-${col.columnId}`} onError={onCellError}>
          {cellContent}
        </CellErrorBoundary>
      );
    },
    [editCallbacks, interactionHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError, cellDescriptorInputRef, cellDescriptorCacheRef, cellDensityStyle, pendingEditorValueRef, popoverAnchorElRef]
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
        onScroll={onHorizontalScroll ? (e: React.UIEvent) => onHorizontalScroll((e.target as HTMLElement).scrollLeft) : undefined}
        onKeyDown={handleGridKeyDown}
        onContextMenu={PREVENT_DEFAULT}
        data-density={density}
        data-overflow-x={allowOverflowX ? 'true' : 'false'}
        className="ogrid-mat-wrapper"
        sx={wrapperSx}
      >
      <Box sx={WRAPPER_SCROLL_SX}>
      <div style={{ minWidth: allowOverflowX ? minTableWidth : undefined, overflowX: 'clip' }}>
        <Box ref={tableContainerRef} sx={isLoading && items.length > 0 ? TABLE_WRAPPER_LOADING_SX : TABLE_WRAPPER_SX}>
          <Table size="small" role="grid" sx={{ minWidth: minTableWidth, borderCollapse: 'separate', borderSpacing: 0 }}
            data-virtual-scroll={virtualScrollEnabled ? '' : undefined}
          >
            <TableHead sx={STICKY_HEADER_SX}>
              {showColumnLetters && (
                <TableRow sx={HEADER_ROW_SX}>
                  {hasCheckboxCol && <TableCell sx={COLUMN_LETTER_CELL_SX} />}
                  {hasRowNumbersCol && <TableCell sx={COLUMN_LETTER_CELL_SX} />}
                  {visibleCols.map((col, colIdx) => {
                    const hdrStyle = columnMeta.hdrStyles[col.columnId];
                    return (
                      <TableCell
                        key={col.columnId}
                        {...({
                          component: 'th',
                          sx: {
                            ...COLUMN_LETTER_CELL_SX,
                            minWidth: hdrStyle?.minWidth,
                            width: hdrStyle?.width,
                            maxWidth: hdrStyle?.maxWidth,
                          },
                        } as TableCellWithSpan)}
                      >
                        {indexToColumnLetter(colIdx)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )}
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
                  {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (() => {
                    const rnw = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                    return (
                      <TableCell
                        {...({
                          component: "th",
                          scope: "col",
                          rowSpan: headerRows.length > 1 ? 1 : undefined,
                          sx: {
                            width: rnw,
                            minWidth: rnw,
                            maxWidth: rnw,
                            textAlign: 'center',
                            fontWeight: 600,
                            backgroundColor: HEADER_BG,
                            position: 'sticky',
                            left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
                            zIndex: 4,
                            ...headerCellSx,
                          }
                        } as TableCellWithSpan)}
                      >
                        #
                        <Box onMouseDown={(e: React.MouseEvent) => {
                          setActiveCell(null);
                          interaction.setSelectionRange(null);
                          wrapperRef.current?.focus({ preventScroll: true });
                          handleResizeStart(e, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<T>);
                        }} sx={RESIZE_HANDLE_SX} />
                      </TableCell>
                    );
                  })()}
                  {/* Empty placeholder for row numbers in the first group row */}
                  {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol && (() => {
                    const spacerRnw = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                    return (
                    <TableCell
                      {...({
                        rowSpan: headerRows.length - 1,
                        sx: {
                          width: spacerRnw,
                          minWidth: spacerRnw,
                          position: 'sticky',
                          left: hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0,
                          zIndex: 4,
                          backgroundColor: 'background.paper',
                        }
                      } as TableCellWithSpan)}
                    />
                    );
                  })()}
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
                    if (!cell.columnDef) return null;
                    const col = cell.columnDef as IColumnDef<T>;
                    const isPinnedLeft = pinning.pinnedColumns[col.columnId] === 'left';
                    const isPinnedRight = pinning.pinnedColumns[col.columnId] === 'right';
                    const baseHeaderSx = o.stickyHeader
                      ? (isPinnedLeft ? HEADER_PINNED_LEFT_SX : isPinnedRight ? HEADER_PINNED_RIGHT_SX : HEADER_BASE_SX)
                      : (isPinnedLeft ? HEADER_PINNED_LEFT_NO_STICKY_SX : isPinnedRight ? HEADER_PINNED_RIGHT_NO_STICKY_SX : HEADER_BASE_NO_STICKY_SX);
                    // Override sticky offset for pinned columns (supports multiple pinned columns)
                    const headerSx = isPinnedLeft && pinning.leftOffsets[col.columnId] != null
                      ? { ...baseHeaderSx, left: pinning.leftOffsets[col.columnId] } as typeof baseHeaderSx
                      : isPinnedRight && pinning.rightOffsets[col.columnId] != null
                        ? { ...baseHeaderSx, right: pinning.rightOffsets[col.columnId] } as typeof baseHeaderSx
                        : baseHeaderSx;

                    // Width/minWidth from shared useColumnMeta (avoids duplicate calculation)
                    const hdrStyle = columnMeta.hdrStyles[col.columnId];

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
                            minWidth: hdrStyle?.minWidth,
                            width: hdrStyle?.width,
                            maxWidth: hdrStyle?.maxWidth,
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
                        <Box sx={HEADER_CONTENT_FLEX_SX}>
                          <ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />
                          <Box
                            component="button"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              headerMenu.open(col.columnId, e.currentTarget);
                            }}
                            aria-label="Column options"
                            title="Column options"
                            sx={COLUMN_OPTIONS_BUTTON_SX}
                          >
                            ⋮
                          </Box>
                        </Box>
                        <Box onMouseDown={(e: React.MouseEvent) => {
                          setActiveCell(null);
                          interaction.setSelectionRange(null);
                          wrapperRef.current?.focus({ preventScroll: true });
                          handleResizeStart(e, col);
                        }} onDoubleClick={(e: React.MouseEvent) => handleResizeDoubleClick(e, col)} sx={RESIZE_HANDLE_SX} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            {!showEmptyInGrid && (
              <MaterialTableBody
                virtualScrollEnabled={virtualScrollEnabled}
                visibleRange={visibleRange}
                columnRange={columnRange}
                items={items}
                getRowId={getRowId}
                selectedRowIds={selectedRowIds}
                visibleCols={visibleCols}
                columnLayouts={columnLayouts}
                renderCellContent={renderCellContent}
                handleSingleRowClick={handleSingleRowClick}
                handleRowCheckboxChange={handleRowCheckboxChange}
                lastMouseShiftRef={lastMouseShiftRef}
                hasCheckboxCol={hasCheckboxCol}
                hasRowNumbersCol={hasRowNumbersCol}
                rowNumberOffset={rowNumberOffset}
                rowHeight={rowHeight}
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
        </Box>
      </div>
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

        <ColumnHeaderMenu {...getColumnHeaderMenuProps(headerMenu)} />
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
