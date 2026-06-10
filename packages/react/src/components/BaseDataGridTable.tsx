import * as React from 'react';
import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { useDataGridTableOrchestration } from '../hooks/useDataGridTableOrchestration';
import { useColumnMeta } from '../hooks/useColumnMeta';
import { getColumnHeaderMenuProps } from '../hooks/useColumnHeaderMenuState';
import {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  areGridRowPropsEqual,
  partitionColumnsForVirtualization,
  getGridCellSurfaceState,
  indexToColumnLetter,
  handleBooleanCellPointerDown,
} from '../utils';
import {
  GRID_ROOT_STYLE,
  GRID_ROOT_VIRTUAL_SCROLL_STYLE,
  CURSOR_CELL_STYLE,
  PREVENT_DEFAULT,
  NOOP,
  STOP_PROPAGATION,
} from '../constants/domHelpers';
import { CellErrorBoundary } from './CellErrorBoundary';
import { MarchingAntsOverlay } from './MarchingAntsOverlay';
import { FormulaRefOverlay } from './FormulaRefOverlay';
import { WindowedPlaceholderRow } from './WindowedPlaceholderRow';
import type { GridRowProps, InlineCellEditorProps } from './createOGrid';
import type {
  IColumnDef,
  ICellEditorProps,
  IOGridDataGridProps,
  WindowedDataState,
} from '../types';
import type { IVisibleColumnRange } from '@alaarab/ogrid-core';

/**
 * CSS-module class names the shared table body needs. Adapters scope their own
 * `.module.scss` differently (e.g. `selectionCell` vs `selectionCellWrapper`),
 * so the consumer maps its module to this normalized shape.
 */
export interface DataGridStyles {
  selectedRow: string;
  selectionCell: string;
  selectionCellInner: string;
  rowNumberCell: string;
  rowNumberCellInner: string;
  tableWrapper: string;
  selectableGrid: string;
  tableScrollContent: string;
  loadingDimmed: string;
  tableWidthAnchor: string;
  dataTable: string;
  stickyHeader: string;
  columnLetterRow?: string;
  columnLetterCell: string;
  selectionHeaderCell: string;
  selectionHeaderCellInner: string;
  rowNumberHeaderCell: string;
  rowNumberHeaderCellInner: string;
  resizeHandle: string;
  groupHeaderCell: string;
  headerCellContent: string;
  headerMenuTrigger: string;
  editingCellContent: string;
  cellContent: string;
  activeCellContent: string;
  inRange: string;
  cellInRange: string;
  cellCut: string;
  cellCopied: string;
  fillHandle: string;
  // Index signature so adapters can pass their full module without listing every key.
  [key: string]: string | undefined;
}

/** Props passed to an adapter's row-checkbox renderer. */
export interface RowCheckboxRenderProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}

/** Props passed to an adapter's header select-all renderer. */
export interface HeaderSelectAllRenderProps {
  allSelected: boolean;
  someSelected: boolean;
  onChange: (checked: boolean) => void;
}

/** Props passed to an adapter's boolean-cell renderer. */
export interface BooleanCellRenderProps {
  checked: boolean;
  disabled: boolean;
  onChange: (() => void) | undefined;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}

/** Props passed to an adapter's popover-editor renderer. */
export interface PopoverEditorRenderProps {
  open: boolean;
  onClose: () => void;
  setAnchorEl: (el: HTMLElement) => void;
  anchorEl: HTMLElement | null;
  /** The display content to render inside the popover anchor. */
  anchorContent: React.ReactNode;
  /** The editor element to render in the popover surface/content. */
  editor: React.ReactNode;
}

/**
 * UI primitives an adapter (Radix / Fluent) injects to bind its component
 * library to the shared data-grid body. Element wrappers (`TableEl`, `Tr`,
 * `Td`, …) cover the structural DOM, render-props cover the interactive bits
 * (checkboxes, popovers) that have library-specific markup.
 */
export interface DataGridPrimitives {
  TableEl: React.ElementType;
  Thead: React.ElementType;
  Tbody: React.ElementType;
  Tr: React.ElementType;
  Td: React.ElementType;
  Th: React.ElementType;
  /** Pass `true` to make `useColumnMeta` inline `position: sticky` (Fluent). */
  addStickyPosition?: boolean;
  /**
   * Pass `true` to omit `rowSpan` on leaf header cells (`Th`). Fluent's
   * `TableHeaderCell` doesn't support rowSpan, so it relied on native `<th>` for
   * grouped headers and never applied a rowSpan to leaf cells.
   */
  omitLeafRowSpan?: boolean;
  /**
   * Pass `true` to use the delegated (stable, zero-per-cell-closure) cell
   * interaction handlers. Radix opts in; Fluent uses the per-cell-closure
   * fallback path (it never passed delegated handlers historically).
   */
  useDelegatedCellHandlers?: boolean;
  /** Resolve the portal target for the context menu. Defaults to document.body. */
  getContextMenuPortalTarget?: (wrapper: HTMLElement | null) => HTMLElement;
  renderRowCheckbox: (p: RowCheckboxRenderProps) => React.ReactNode;
  renderHeaderSelectAll: (p: HeaderSelectAllRenderProps) => React.ReactNode;
  renderBooleanCell: (p: BooleanCellRenderProps) => React.ReactNode;
  renderPopoverEditor: (p: PopoverEditorRenderProps) => React.ReactNode;
  /** Inline editor component (adapter-specific subclass of BaseInlineCellEditor). */
  InlineCellEditor: <T>(p: InlineCellEditorProps<T>) => React.ReactElement;
  /** Column header filter component. */
  ColumnHeaderFilter: React.ComponentType<ReturnType<typeof getHeaderFilterConfig>>;
  /** Column header options menu component. */
  ColumnHeaderMenu: React.ComponentType<ReturnType<typeof getColumnHeaderMenuProps>>;
  /** Context menu component. */
  GridContextMenu: React.ComponentType<{
    x: number; y: number; hasSelection: boolean;
    canUndo: boolean; canRedo: boolean;
    onUndo: () => void; onRedo: () => void;
    onCopy: () => void; onCut: () => void; onPaste: () => void;
    onSelectAll: () => void; onClose: () => void;
  }>;
  /** Empty-state component. */
  EmptyState: React.ComponentType<{ emptyState: NonNullable<ReturnType<typeof useDataGridTableOrchestration>['emptyState']> }>;
  /** Loading overlay component. */
  LoadingOverlay: React.ComponentType<{ message: string }>;
  /** Drop indicator overlay component. */
  DropIndicator: React.ComponentType<{ dropIndicatorX: number; wrapperLeft: number }>;
  /** Status bar component. */
  StatusBar: React.ComponentType<{
    totalCount: number; filteredCount?: number; selectedCount?: number;
    selectedCellCount?: number;
    aggregation?: import('./StatusBar').StatusBarProps['aggregation'];
    suppressRowCount?: boolean;
  }>;
}

// --- Memoized row component (skips re-render for rows unaffected by selection changes) ---

/** Extended props for column virtualization spacers. */
interface BaseGridRowProps extends GridRowProps {
  leftSpacerWidth?: number;
  rightSpacerWidth?: number;
  /** Maps local column index to global index in full visibleCols. */
  globalColIndexMap?: number[];
  /** Dynamic width for the row number column (from resize overrides). */
  rowNumWidth?: number;
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

function GridRowInner(props: BaseGridRowProps) {
  const {
    item, rowIndex, rowId, isSelected, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
    leftSpacerWidth, rightSpacerWidth, globalColIndexMap, rowNumWidth,
    selectionRange, activeCell, cutRange, styles, primitives,
  } = props;
  const { Tr, Td, renderRowCheckbox } = primitives;

  return (
    <Tr
      className={isSelected ? styles.selectedRow : undefined}
      data-row-id={rowId}
      onClick={handleSingleRowClick}
      aria-selected={isSelected || undefined}
    >
      {hasCheckboxCol && (
        <Td className={styles.selectionCell}>
          <div
            className={styles.selectionCellInner}
            data-row-index={rowIndex}
            data-col-index={0}
            onClick={STOP_PROPAGATION}
          >
            {renderRowCheckbox({
              checked: isSelected,
              onCheckedChange: (c: boolean) =>
                handleRowCheckboxChange(rowId, c, rowIndex, lastMouseShiftRef.current),
              ariaLabel: `Select row ${rowIndex + 1}`,
            })}
          </div>
        </Td>
      )}
      {hasRowNumbersCol && (
        <Td
          className={styles.rowNumberCell}
          style={rowNumWidth ? { width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth } : undefined}
          onPointerDown={PREVENT_DEFAULT}
        >
          <div className={styles.rowNumberCellInner}>
            {rowNumberOffset + rowIndex + 1}
          </div>
        </Td>
      )}
      {leftSpacerWidth != null && leftSpacerWidth > 0 && (
        <td style={{ padding: 0, border: 'none', width: leftSpacerWidth, minWidth: leftSpacerWidth }} aria-hidden />
      )}
      {visibleCols.map((col, colIdx) => {
        const globalIdx = globalColIndexMap ? globalColIndexMap[colIdx] : colIdx;
        const surfaceState = getGridCellSurfaceState({
          rowIndex,
          columnIndex: globalIdx,
          selectionRange,
          activeCell,
          cutRange,
        });
        // Compute background override only when the cell has state.
        // For the ~99% of cells outside any selection/cut range this is
        // undefined, so we reuse the memoized baseStyle directly (zero allocation).
        const baseStyle = columnMeta.cellStyles[col.columnId];
        const bg = surfaceState.isCutCell
          ? 'var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04))'
          : surfaceState.isActiveRangeCell
          ? 'var(--ogrid-bg, #fff)'
          : surfaceState.isRangeCell
          ? 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.12))'
          : undefined;
        return (
          <Td
            key={col.columnId}
            data-column-id={col.columnId}
            className={columnMeta.cellClasses[col.columnId] || undefined}
            style={bg ? { ...baseStyle, background: bg } : baseStyle}
            onPointerDown={PREVENT_DEFAULT}
          >
            {renderCellContent(item, col, rowIndex, globalIdx)}
          </Td>
        );
      })}
      {rightSpacerWidth != null && rightSpacerWidth > 0 && (
        <td style={{ padding: 0, border: 'none', width: rightSpacerWidth, minWidth: rightSpacerWidth }} aria-hidden />
      )}
    </Tr>
  );
}

const GridRow = React.memo(GridRowInner, areGridRowPropsEqual);

// --- Table body with column virtualization support ---

interface BaseTableBodyProps<T> {
  virtualScrollEnabled: boolean;
  visibleRange: { startIndex: number; endIndex: number; offsetTop: number; offsetBottom: number };
  columnRange: IVisibleColumnRange | null;
  items: T[];
  /** Windowed (lazy) row access. When set, rows are read by index, not from `items`. */
  windowed?: WindowedDataState<T> | null;
  /** Fixed row height (px) — used to size windowed loading/error placeholder rows. */
  rowHeight: number;
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
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
}

function BaseTableBody<T>(props: BaseTableBodyProps<T>) {
  const {
    virtualScrollEnabled, visibleRange, columnRange,
    items, windowed, rowHeight, getRowId, selectedRowIds, visibleCols, columnMeta,
    renderCellContent, handleSingleRowClick, handleRowCheckboxChange,
    lastMouseShiftRef, hasCheckboxCol, hasRowNumbersCol, rowNumberOffset,
    selectionRange, activeCell, cutRange, copyRange, isDragging,
    editingCell, pinnedColumns, rowNumWidth, styles, primitives,
  } = props;
  const { Tbody } = primitives;

  // Partition columns when column virtualization is active
  const partition = React.useMemo(() => {
    if (!columnRange) return null;
    // Cast bridges core's IColumnDef<T> to react's IColumnDef<T> — react extends
    // core but TypeScript sees them as different types from different packages.
    return partitionColumnsForVirtualization<T>(
      visibleCols as Parameters<typeof partitionColumnsForVirtualization<T>>[0],
      columnRange,
      pinnedColumns,
    ) as ReturnType<typeof partitionColumnsForVirtualization<T>> & {
      pinnedLeft: IColumnDef<T>[];
      virtualizedUnpinned: IColumnDef<T>[];
      pinnedRight: IColumnDef<T>[];
    };
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
        styles={styles}
        primitives={primitives}
      />
    );
  };

  // Columns a normal row spans — sizes the windowed loading/error placeholders.
  const placeholderColSpan =
    (hasCheckboxCol ? 1 : 0) +
    (hasRowNumbersCol ? 1 : 0) +
    rowCols.length +
    (leftSpacerWidth ? 1 : 0) +
    (rightSpacerWidth ? 1 : 0);

  // Windowed (lazy) data source: render the visible index range, reading each
  // row from the cache. Not-yet-loaded rows render a placeholder of identical
  // height so the scroll geometry holds while data streams in.
  const renderWindowedRows = (): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    if (!windowed) return out;
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      const slot = windowed.getRow(i);
      if (slot.status === 'loaded') {
        out.push(renderRow(slot.row, i));
      } else {
        out.push(
          <WindowedPlaceholderRow
            key={`w-${i}`}
            status={slot.status}
            rowIndex={i}
            colSpan={placeholderColSpan}
            rowHeight={rowHeight}
            onRetry={slot.status === 'error' ? () => windowed.retryRow(i) : undefined}
          />
        );
      }
    }
    return out;
  };

  return (
    <Tbody>
      {virtualScrollEnabled && visibleRange.offsetTop > 0 && (
        <tr style={{ height: visibleRange.offsetTop }} aria-hidden />
      )}
      {windowed
        ? renderWindowedRows()
        : virtualScrollEnabled
        ? items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, i) =>
            renderRow(item, visibleRange.startIndex + i)
          )
        : items.map((item, rowIndex) => renderRow(item, rowIndex))
      }
      {virtualScrollEnabled && visibleRange.offsetBottom > 0 && (
        <tr style={{ height: visibleRange.offsetBottom }} aria-hidden />
      )}
    </Tbody>
  );
}

/**
 * Shared DataGridTable body. Adapters (`react-radix`, `react-fluent`) bind their
 * own UI primitives + scoped CSS module and re-export the memoized result.
 *
 * `delegatedCellHandlers` is optional: Radix passes a delegated-handlers object,
 * Fluent omits it (its `getCellInteractionProps` is called with 3 args).
 */
export function BaseDataGridTableInner<T>(
  props: IOGridDataGridProps<T> & {
    styles: DataGridStyles;
    primitives: DataGridPrimitives;
  }
): React.ReactElement {
  const { styles, primitives, ...gridProps } = props;
  const o = useDataGridTableOrchestration({ props: gridProps as IOGridDataGridProps<T> });

  const {
    wrapperRef, tableContainerRef, lastMouseShiftRef,
    interaction, pinning,
    handleResizeStart, handleResizeDoubleClick, getColumnWidth, isReorderDragging, dropIndicatorX, handleHeaderMouseDown,
    virtualScrollEnabled, virtualRowHeight, visibleRange, columnRange, onHorizontalScroll,
    items, windowed, getRowId, emptyState, rowSelection,
    isLoading, loadingMessage,
    ariaLabel, ariaLabelledBy, visibleColumns, columnOrder, columnReorder, density, rowHeight,
    rowNumberOffset, headerRows, allowOverflowX, fitToContent, showColumnLetters,
    editCallbacks, interactionHandlers, delegatedCellHandlers,
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

  const {
    TableEl, Thead, InlineCellEditor, ColumnHeaderFilter, ColumnHeaderMenu,
    GridContextMenu, EmptyState, LoadingOverlay, DropIndicator, StatusBar,
    renderHeaderSelectAll, renderBooleanCell, renderPopoverEditor,
    getContextMenuPortalTarget,
  } = primitives;

  // Pre-compute column styles and classNames via shared hook (avoids per-cell object creation)
  const columnMeta = useColumnMeta({
    visibleCols,
    getColumnWidth,
    columnSizingOverrides,
    measuredColumnWidths,
    pinnedColumns: pinning.pinnedColumns,
    leftOffsets: pinning.leftOffsets,
    rightOffsets: pinning.rightOffsets,
    pinnedColLeftClass: styles.pinnedColLeft ?? '',
    pinnedColRightClass: styles.pinnedColRight ?? '',
    addStickyPosition: primitives.addStickyPosition,
  });

  // renderCellContent reads volatile state from refs -- keeps function identity stable so
  // GridRow's React.memo comparator can skip rows whose selection state hasn't changed.
  const renderCellContent = useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current, cellDescriptorCacheRef.current);
      const rowId = getRowId(item);

      let content: React.ReactNode;

      if (descriptor.mode === 'editing-inline') {
        const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks) as InlineCellEditorProps<T>;
        content = (
          <div className={styles.editingCellContent}>
            <InlineCellEditor<T> {...editorProps} />
          </div>
        );
      } else if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
        const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValueRef.current, editCallbacks) as ICellEditorProps<T>;
        const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
        const popoverDisplayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
        const popoverCellStyle = resolveCellStyle(col, item, descriptor.displayValue);
        content = renderPopoverEditor({
          open: !!popoverAnchorElRef.current,
          onClose: cancelPopoverEdit,
          setAnchorEl: setPopoverAnchorEl,
          anchorEl: popoverAnchorElRef.current,
          anchorContent: popoverCellStyle ? <span style={popoverCellStyle}>{popoverDisplayContent}</span> : popoverDisplayContent,
          editor: <CustomEditor {...editorProps} />,
        });
      } else {
        let displayNode: React.ReactNode;
        if (descriptor.columnType === 'boolean') {
          const boolVal = !!descriptor.displayValue;
          displayNode = renderBooleanCell({
            checked: boolVal,
            disabled: !descriptor.canEditAny,
            onChange: descriptor.canEditAny ? () => {
              const savedRow = descriptor.rowIndex;
              const savedCol = descriptor.globalColIndex;
              editCallbacks.commitCellEdit(item, col.columnId, boolVal, !boolVal, savedRow, savedCol, { skipAdvance: true });
            } : undefined,
            onPointerDown: (e: React.PointerEvent) =>
              handleBooleanCellPointerDown(e, descriptor.rowIndex, descriptor.globalColIndex, colOffset, {
                setActiveCell,
                setSelectionRange: (r) => interaction.setSelectionRange(r),
              }),
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
            ariaLabel: boolVal ? 'Checked' : 'Unchecked',
          });
        } else {
          const displayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
          const cellStyle = resolveCellStyle(col, item, descriptor.displayValue);
          displayNode = cellStyle ? <span style={cellStyle}>{displayContent}</span> : displayContent;
        }

        const cellClassNames = `${styles.cellContent}${descriptor.isActive ? ` ${styles.activeCellContent}` : ''}${descriptor.isActive && descriptor.isInRange ? ` ${styles.inRange}` : ''}${descriptor.isInRange && !descriptor.isActive ? ` ${styles.cellInRange}` : ''}${descriptor.isInCutRange ? ` ${styles.cellCut}` : ''}${descriptor.isInCopyRange ? ` ${styles.cellCopied}` : ''}`;

        const interactionProps = getCellInteractionProps(
          descriptor,
          col.columnId,
          interactionHandlers,
          primitives.useDelegatedCellHandlers ? delegatedCellHandlers : undefined,
        );

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
                onPointerDown={handleFillHandleMouseDown}
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
    [editCallbacks, interactionHandlers, delegatedCellHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError, cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef, colOffset, interaction, setActiveCell, styles, primitives, InlineCellEditor, renderPopoverEditor, renderBooleanCell]
  );

  return (
    <div style={virtualScrollEnabled ? GRID_ROOT_VIRTUAL_SCROLL_STYLE : GRID_ROOT_STYLE}>
      <div
        ref={wrapperRef}
        tabIndex={0}
        onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
        onScroll={onHorizontalScroll ? (e) => onHorizontalScroll((e.target as HTMLElement).scrollLeft) : undefined}
        className={`${styles.tableWrapper} ${rowSelection !== 'none' ? styles.selectableGrid : ''} ${styles[`density-${density}`] || ''}`}
        role="region"
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid')}
        aria-labelledby={ariaLabelledBy}
        data-ogrid-scroll-container=""
        data-virtual-scroll={virtualScrollEnabled ? '' : undefined}
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
              <TableEl className={styles.dataTable} role="grid" data-virtual-scroll={virtualScrollEnabled ? '' : undefined}>
                <Thead
                  className={o.stickyHeader ? styles.stickyHeader : undefined}
                >
                  {showColumnLetters && (
                    <primitives.Tr className={styles.columnLetterRow}>
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
                    </primitives.Tr>
                  )}
                  {headerRows.map((row, rowIdx) => (
                    <primitives.Tr key={rowIdx}>
                      {/* Checkbox header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasCheckboxCol && (
                        <primitives.Th className={styles.selectionHeaderCell} scope="col" rowSpan={1} key="__selection__">
                          <div className={styles.selectionHeaderCellInner}>
                            {renderHeaderSelectAll({ allSelected, someSelected, onChange: handleSelectAll })}
                          </div>
                        </primitives.Th>
                      )}
                      {/* Empty placeholder for checkbox alignment in non-leaf rows */}
                      {rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol && (
                        <th rowSpan={headerRows.length - 1} key="__selection_placeholder__" />
                      )}
                      {/* Row numbers header: show in last row (leaf row) */}
                      {rowIdx === headerRows.length - 1 && hasRowNumbersCol && (() => {
                        const rowNumWidth = columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                        return (
                          <primitives.Th className={styles.rowNumberHeaderCell} scope="col" rowSpan={1} key="__row_number__" style={{ width: rowNumWidth, minWidth: rowNumWidth, maxWidth: rowNumWidth }}>
                            <div className={styles.rowNumberHeaderCellInner}>
                              #
                            </div>
                            <div
                              className={styles.resizeHandle}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label="Resize row number column"
                              onPointerDown={(e) => {
                                setActiveCell(null);
                                interaction.setSelectionRange(null);
                                wrapperRef.current?.focus({ preventScroll: true });
                                handleResizeStart(e, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<T>);
                              }}
                            />
                          </primitives.Th>
                        );
                      })()}
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
                        if (!cell.columnDef) return null;
                        const col = cell.columnDef as IColumnDef<T>;
                        const leafRowSpan = primitives.omitLeafRowSpan
                          ? undefined
                          : headerRows.length > 1 && rowIdx < headerRows.length - 1
                          ? headerRows.length - rowIdx
                          : undefined;

                        // Determine aria-sort value for sorted columns
                        const isSorted = gridProps.sortBy === col.columnId;
                        const ariaSort = isSorted
                          ? (gridProps.sortDirection === 'asc' ? 'ascending' : 'descending')
                          : undefined;

                        return (
                          <primitives.Th
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
                            onPointerDown={columnReorder ? (e: React.PointerEvent) => handleHeaderMouseDown(col.columnId, e) : undefined}
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
                                {'⋮'}
                              </button>
                            </div>
                            <div
                              className={styles.resizeHandle}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label={`Resize ${col.name}`}
                              onPointerDown={(e) => {
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
                          </primitives.Th>
                        );
                      })}
                    </primitives.Tr>
                  ))}
                </Thead>
                {!showEmptyInGrid && (
                  <BaseTableBody
                    virtualScrollEnabled={virtualScrollEnabled}
                    visibleRange={visibleRange}
                    columnRange={columnRange}
                    items={items}
                    windowed={windowed}
                    rowHeight={virtualRowHeight}
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
                    styles={styles}
                    primitives={primitives}
                  />
                )}
              </TableEl>
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
              {gridProps.formulaReferences && gridProps.formulaReferences.length > 0 && (
                <FormulaRefOverlay
                  containerRef={tableContainerRef}
                  references={gridProps.formulaReferences}
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
            getContextMenuPortalTarget ? getContextMenuPortalTarget(wrapperRef.current) : document.body
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

/**
 * Build a memoized adapter `DataGridTable` from injected primitives + styles.
 * Each adapter calls this once at module scope.
 */
export function createDataGridTable(styles: DataGridStyles, primitives: DataGridPrimitives) {
  function DataGridTableInner<T>(props: IOGridDataGridProps<T>): React.ReactElement {
    return <BaseDataGridTableInner<T> {...props} styles={styles} primitives={primitives} />;
  }
  return React.memo(DataGridTableInner) as typeof DataGridTableInner;
}
