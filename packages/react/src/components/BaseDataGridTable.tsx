import * as React from 'react';
import { createPortal } from 'react-dom';
import { ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { useDataGridTableOrchestration } from '../hooks/useDataGridTableOrchestration';
import { useColumnMeta } from '../hooks/useColumnMeta';
import { useRenderCellContent } from '../hooks/useRenderCellContent';
import { usePortalTheme } from '../hooks/usePortalTheme';
import { useGridCellFocus } from '../hooks/useGridCellFocus';
import { useFrozenRowOffsets } from '../hooks/useFrozenRowOffsets';
import { useStructureContextMenu } from '../hooks/useStructureContextMenu';
import { useHidingContextMenu } from '../hooks/useHidingContextMenu';
import { useCellNotes } from '../hooks/useCellNotes';
import type { useGridDragDrop, UseGridDragDropParams, UseGridDragDropResult } from '../hooks/useGridDragDrop';
import { CellNotePopover } from './CellNotePopover';
import { getColumnHeaderMenuProps } from '../hooks/useColumnHeaderMenuState';
import {
  GRID_ROOT_STYLE,
  GRID_ROOT_VIRTUAL_SCROLL_STYLE,
  PREVENT_DEFAULT,
  NOOP,
} from '../constants/domHelpers';
import { MarchingAntsOverlay } from './MarchingAntsOverlay';
import { FormulaRefOverlay } from './FormulaRefOverlay';
import { BaseTableHeader } from './BaseTableHeader';
import { BaseTableBody } from './BaseTableBody';
import type { IOGridDataGridProps } from '../types';
import type { DataGridStyles, DataGridPrimitives } from './BaseDataGridTable.types';

// Public prop/contract types live in BaseDataGridTable.types.ts; re-exported
// here so existing imports keep working.
export type {
  DataGridStyles,
  DataGridPrimitives,
  RowCheckboxRenderProps,
  HeaderSelectAllRenderProps,
  BooleanCellRenderProps,
  PopoverEditorRenderProps,
  FindReplacePanelProps,
} from './BaseDataGridTable.types';

const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Floats the Find & Replace panel over the grid's top-right corner. */
const FIND_PANEL_HOST_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 'var(--ogrid-z-find, 30)' as unknown as number,
  maxWidth: 'calc(100% - 8px)',
};
let noteIdCounter = 0;

/**
 * Shared DataGridTable body. Adapters (`react-radix`, `react-fluent`) bind their
 * own UI primitives + scoped CSS module and re-export the memoized result.
 *
 * Both built-in kits set `primitives.useDelegatedCellHandlers`, so cells share
 * one set of stable interaction handlers instead of per-cell closures.
 */
export type BaseDataGridTableProps<T> = IOGridDataGridProps<T> & {
  styles: DataGridStyles;
  primitives: DataGridPrimitives;
};

const LazyDragDataGridTable = React.lazy(() => import('./DragDataGridTable.js'));

/** Mount the optional drag hooks only for opted-in grids. */
export function BaseDataGridTableInner<T>(props: BaseDataGridTableProps<T>): React.ReactElement {
  if (props.rowDragging || props.rangeMove || props.cellDrop || props.onCellDrop) {
    const DragTable = LazyDragDataGridTable as React.ComponentType<BaseDataGridTableProps<T> & { renderTable: typeof BaseDataGridTableContent<T> }>;
    return <React.Suspense fallback={null}><DragTable {...props} renderTable={BaseDataGridTableContent} /></React.Suspense>;
  }
  return <BaseDataGridTableContent {...props} />;
}

const IGNORE_DRAG = () => {};
const IGNORE_DRAG_KEY = () => false;
function useDisabledDragDrop<T>(params: UseGridDragDropParams<T>): UseGridDragDropResult<T> {
  return {
    orderedItems: params.items, isDraggingRow: false, isExternalDragOver: false,
    dropLine: null, rangeMoveHandle: null,
    handleRowDragStart: IGNORE_DRAG, handleRangeMoveDragStart: IGNORE_DRAG,
    handleKeyDown: IGNORE_DRAG_KEY,
    wrapperHandlers: { onDragOver: IGNORE_DRAG, onDragLeave: IGNORE_DRAG, onDrop: IGNORE_DRAG, onDragEnd: IGNORE_DRAG },
  };
}

/** Shared rendering; the optional feature component supplies its hook. */
export function BaseDataGridTableContent<T>(
  props: BaseDataGridTableProps<T> & { useDragDrop?: typeof useGridDragDrop }
): React.ReactElement {
  const { styles, primitives, useDragDrop = useDisabledDragDrop, ...gridProps } = props;
  const dragKeyDownRef = React.useRef<(e: React.KeyboardEvent) => boolean>(IGNORE_DRAG_KEY);
  const onRowReorderKeyDown = React.useCallback((e: React.KeyboardEvent) => dragKeyDownRef.current(e), []);
  const o = useDataGridTableOrchestration({ props: gridProps as IOGridDataGridProps<T>, onRowReorderKeyDown });

  const {
    wrapperRef, tableContainerRef, lastMouseShiftRef,
    interaction, pinning,
    getColumnWidth, isReorderDragging, dropIndicatorX,
    virtualScrollEnabled, virtualRowHeight, visibleRange, columnRange, onHorizontalScroll,
    items, windowed, getRowId, emptyState, rowSelection,
    isLoading, loadingMessage,
    ariaLabel, ariaLabelledBy, visibleColumns, columnOrder, density, rowHeight,
    rowNumberOffset, allowOverflowX, fitToContent,
    handleSingleRowClick, handlePasteVoid,
    visibleCols, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset,
    containerWidth, minTableWidth, columnSizingOverrides, measuredColumnWidths,
    selectedRowIds, handleRowCheckboxChange,
    editingCell,
    selectionRange, hasCellSelection, handleGridKeyDown,
    handleCopy, handleCut, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
    menuPosition, closeContextMenu,
    statusBarConfig, showEmptyInGrid,
    headerMenu,
  } = o;

  const {
    TableEl,
    ColumnHeaderMenu, GridContextMenu, EmptyState, LoadingOverlay, DropIndicator, StatusBar,
    getContextMenuPortalTarget, FindReplacePanel,
  } = primitives;

  // Ctrl+F / Ctrl+H open Find & Replace; everything else goes to keyboard navigation.
  const { findReplace } = o;
  const findKeyDown = findReplace.handleKeyDown;

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

  const renderCellContent = useRenderCellContent(o, styles, primitives);

  // Drag-and-drop: row reorder, range move and external cell drops.
  const sorted = (gridProps.sortModel?.length ?? 0) > 0 || (gridProps.sortBy ?? '') !== '';
  const dragDrop = useDragDrop<T>({
    items,
    getRowId,
    visibleCols,
    colOffset,
    wrapperRef,
    containerRef: tableContainerRef,
    rowDragging: gridProps.rowDragging && !windowed,
    onRowOrderChange: gridProps.onRowOrderChange,
    sorted,
    rangeMove: gridProps.rangeMove,
    selectionRange,
    selectedRowIds,
    activeCell: interaction.activeCell,
    moveRangeTo: interaction.moveRangeTo,
    cellDrop: gridProps.cellDrop,
    onCellDrop: gridProps.onCellDrop,
    dropTextAt: interaction.dropTextAt,
    recordAction: o.recordAction,
  });
  dragKeyDownRef.current = dragDrop.handleKeyDown;

  // Ctrl+F / Ctrl+H open Find & Replace; Ctrl/Cmd+Shift+Up/Down reorders rows.
  const handleWrapperKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!findKeyDown(e)) handleGridKeyDown(e);
  }, [findKeyDown, handleGridKeyDown]);

  // ARIA grid geometry. aria-rowindex counts header rows and earlier pages;
  // aria-rowcount is -1 ("unknown") when the grid can't see the full total.
  const headerRowCount = o.headerRows.length + (o.showColumnLetters ? 1 : 0);
  const pageOffset = windowed || o.propPageSize === 'all' || o.propPageSize == null ? 0 : (o.currentPage - 1) * o.propPageSize;
  const ariaRowIndexBase = headerRowCount + pageOffset;
  const knownTotalRows = windowed
    ? windowed.rowCount
    : gridProps.totalCount != null
      ? gridProps.totalCount
    : o.statusBarConfig
      ? o.statusBarConfig.totalCount
      : pageOffset === 0 && (o.propPageSize === 'all' || o.propPageSize == null || items.length < o.propPageSize)
        ? items.length
        : -1;
  const ariaRowCount = knownTotalRows >= 0 ? headerRowCount + knownTotalRows : -1;

  // Insert/delete rows and columns (allowStructureEdits), acting on the selected cells.
  const structureMenu = useStructureContextMenu({
    actions: gridProps.structureActions,
    open: menuPosition != null,
    items,
    visibleCols,
    selectionRange,
    activeCell: interaction.activeCell,
    colOffset,
    getRowId,
    clearSelection: () => {
      interaction.setSelectionRange(null);
      interaction.setActiveCell(null);
    },
  });
  // Hide/unhide rows and columns (allowHiding), acting on the selected cells.
  const hidingMenu = useHidingContextMenu({
    actions: gridProps.hidingActions,
    open: menuPosition != null,
    items,
    visibleCols,
    columnGaps: o.layout.hiddenColumnGaps,
    selectionRange,
    activeCell: interaction.activeCell,
    colOffset,
    getRowId,
    clearSelection: () => {
      interaction.setSelectionRange(null);
      interaction.setActiveCell(null);
    },
  });
  // Excel-style cell notes: corner marker, hover/focus popover, editor (context menu, Shift+F2).
  // React 17 compatible stable id (no useId).
  const [noteIdPrefix] = React.useState(() => `ogrid-note-${++noteIdCounter}`);
  const cellNotes = useCellNotes<T>({
    notes: gridProps.cellNotes,
    onNotesChange: gridProps.onCellNotesChange,
    editable: !!gridProps.cellNotesEditable,
    author: gridProps.cellNoteAuthor,
    wrapperRef,
    getRowId,
    items: windowed?.loadedRows ?? items,
    visibleCols,
    colOffset,
    activeCell: interaction.activeCell,
    menuOpen: menuPosition != null,
    recordAction: o.recordAction,
  });
  // Theme tokens for the portaled context menu (it renders outside the grid).
  const contextMenuTheme = usePortalTheme(wrapperRef, menuPosition != null);
  // Roving tabindex: one body cell is the tab stop and holds DOM focus; the
  // wrapper is the fallback stop while that cell isn't rendered. Without cell
  // selection there is no cell navigation, so the wrapper stays the stop.
  const cellFocus = useGridCellFocus({
    wrapperRef,
    activeCell: interaction.activeCell,
    setActiveCell: interaction.setActiveCell,
    editingCell,
    colOffset,
    checkboxColumn: hasCheckboxCol,
    rowCount: windowed ? windowed.rowCount : items.length,
    colCount: gridProps.cellSelection === false ? 0 : visibleCols.length,
  });
  const { mergeLayout, frozenRows } = o.viewModels;
  // Resized rows move the frozen rows below them, so their heights are part of the key.
  const frozenRowsKey = React.useMemo(() => ({ rows: windowed ?? items, heights: o.getRowHeight }), [windowed, items, o.getRowHeight]);
  useFrozenRowOffsets(tableContainerRef, frozenRows, o.stickyHeader, frozenRowsKey);
  // Windowed placeholders are aria-hidden; announce loading once for the grid instead.
  let windowedLoading = false;
  if (windowed) {
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex && i < windowed.rowCount; i++) {
      if (windowed.getRow(i).status === 'loading') {
        windowedLoading = true;
        break;
      }
    }
  }

  return (
    <div style={virtualScrollEnabled ? GRID_ROOT_VIRTUAL_SCROLL_STYLE : GRID_ROOT_STYLE}>
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the grid wrapper hosts the centralized keyboard-navigation layer (useKeyboardNavigation); key and clipboard events from the focused cell bubble here */}
      {/* biome-ignore lint/a11y/useSemanticElements: the wrapper must stay a div scroll container; role="region" is the intended landmark semantics */}
      <div
        ref={wrapperRef}
        // Focusable for the fallback only; useGridCellFocus raises it to 0 while
        // no cell is the tab stop (rows virtualized away, or none at all).
        tabIndex={-1}
        onFocus={cellFocus.onFocus}
        onBlur={cellFocus.onBlur}
        onMouseDown={(e) => { lastMouseShiftRef.current = e.shiftKey; }}
        onPointerDownCapture={cellFocus.onPointerDownCapture}
        // A checkbox toggled from the keyboard (Space) reads Shift from its key press, not a stale mouse press.
        onKeyDownCapture={(e) => { lastMouseShiftRef.current = e.shiftKey; cellFocus.onKeyDownCapture(); }}
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
        onKeyDown={findReplace.enabled ? handleWrapperKeyDown : handleGridKeyDown}
        data-ogrid-find={findReplace.enabled ? findReplace.scopeId : undefined}
        onPaste={interaction.handleGridPaste}
        onCopy={interaction.handleGridCopy}
        onCut={interaction.handleGridCut}
        onDragOver={dragDrop.wrapperHandlers.onDragOver}
        onDrop={dragDrop.wrapperHandlers.onDrop}
        onDragLeave={dragDrop.wrapperHandlers.onDragLeave}
        onDragEnd={dragDrop.wrapperHandlers.onDragEnd}
        data-ogrid-dragging-row={dragDrop.isDraggingRow ? '' : undefined}
        data-ogrid-external-drag={dragDrop.isExternalDragOver ? '' : undefined}
        style={{
          ['--data-table-column-count' as string]: totalColCount,
          ['--data-table-width' as string]: showEmptyInGrid ? '100%' : allowOverflowX ? 'fit-content' : fitToContent ? 'fit-content' : '100%',
          ['--data-table-min-width' as string]: showEmptyInGrid ? '100%' : allowOverflowX ? 'max-content' : fitToContent ? 'max-content' : '100%',
          ['--data-table-total-min-width' as string]: `${minTableWidth}px`,
          // Virtual math assumes fixed rows, so virtual grids always pin the height it uses.
          ...((virtualScrollEnabled ? virtualRowHeight : rowHeight)
            ? { ['--ogrid-row-height' as string]: `${virtualScrollEnabled ? virtualRowHeight : rowHeight}px` } : {}),
        } as React.CSSProperties}
      >
        {windowed && (
          <div role="status" aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
            {windowedLoading ? 'Loading rows\u2026' : ''}
          </div>
        )}
        <div className={styles.tableScrollContent}>
        <div className={isLoading && items.length > 0 ? styles.loadingDimmed : undefined}>
          <div className={styles.tableWidthAnchor} ref={tableContainerRef}>
              <TableEl
                className={styles.dataTable}
                role="grid"
                aria-rowcount={ariaRowCount}
                aria-colcount={totalColCount}
                aria-multiselectable={hasCellSelection || rowSelection === 'multiple' ? true : undefined}
                data-virtual-scroll={virtualScrollEnabled ? '' : undefined}
              >
                <BaseTableHeader
                  o={o}
                  columnMeta={columnMeta}
                  sortBy={gridProps.sortBy}
                  sortDirection={gridProps.sortDirection}
                  styles={styles}
                  primitives={primitives}
                  onUnhideColumns={gridProps.hidingActions?.unhideColumns}
                />
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
                    rowNumberOf={o.rowNumberOf}
                    ariaRowIndexBase={ariaRowIndexBase}
                    selectionRange={selectionRange}
                    activeCell={interaction.activeCell}
                    cutRange={cutRange}
                    copyRange={copyRange}
                    isDragging={isDragging}
                    editingCell={editingCell}
                    tabStopCell={cellFocus.tabStopCell}
                    registerTabStop={cellFocus.registerTabStop}
                    popoverAnchorEl={o.editing.popoverAnchorEl}
                    pendingEditorValue={o.editing.pendingEditorValue}
                    onRowHeaderPointerDown={o.handleRowHeaderPointerDown}
                    rowDragging={!!gridProps.rowDragging && !sorted && !windowed}
                    onRowDragStart={dragDrop.handleRowDragStart}
                    formulaVersion={gridProps.formulaVersion}
                    conditionalFormat={gridProps.conditionalFormat}
                    pinnedColumns={pinning.pinnedColumns}
                    rowNumWidth={hasRowNumbersCol ? (columnSizingOverrides?.[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH) : undefined}
                    mergeLayout={mergeLayout}
                    frozenRows={frozenRows}
                    getRowHeight={o.getRowHeight}
                    getRowSize={o.getRowSize}
                    measureRowRef={o.measureRowRef}
                    onRowResizeStart={o.onRowResizeStart}
                    hiddenRowGaps={gridProps.hidingActions?.hiddenRowGaps}
                    onUnhideRows={gridProps.hidingActions?.unhideRows}
                    getCellNote={cellNotes.getCellNote}
                    noteIdPrefix={noteIdPrefix}
                    styles={styles}
                    primitives={primitives}
                  />
                )}
              </TableEl>
              {isReorderDragging && dropIndicatorX != null && (
                <DropIndicator dropIndicatorX={dropIndicatorX} wrapperLeft={wrapperRef.current?.getBoundingClientRect().left ?? 0} />
              )}
              {dragDrop.dropLine && (
                <div
                  data-ogrid-row-drop-line=""
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: dragDrop.dropLine.left,
                    top: dragDrop.dropLine.top,
                    width: dragDrop.dropLine.width,
                    height: 2,
                    background: 'var(--ogrid-selection, var(--ogrid-selection-color, #217346))',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              )}
              {gridProps.rangeMove && dragDrop.rangeMoveHandle && (
                <button
                  type="button"
                  data-ogrid-range-move-handle=""
                  draggable
                  aria-label="Drag to move the selection"
                  title="Drag to move the selection (Ctrl/Cmd to copy)"
                  onDragStart={dragDrop.handleRangeMoveDragStart}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: dragDrop.rangeMoveHandle.left,
                    top: dragDrop.rangeMoveHandle.top,
                    width: 11,
                    height: 11,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    border: '1px solid #fff',
                    padding: 0,
                    background: 'var(--ogrid-selection, var(--ogrid-selection-color, #217346))',
                    cursor: 'move',
                    zIndex: 6,
                  }}
                />
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
              {o.formulaReferences && o.formulaReferences.length > 0 && (
                <FormulaRefOverlay
                  containerRef={tableContainerRef}
                  references={o.formulaReferences}
                  colOffset={colOffset}
                />
              )}
            </div>
          </div>
          {/* Empty state lives directly under `.tableScrollContent` (a sibling
              of the max-content `.tableWidthAnchor`), so its box spans the
              scroll viewport width — never the wider-than-viewport grid
              content. This lets it stay centered when columns fit and fully
              visible (no off-screen-right push) when columns overflow. Shared
              body, so this applies to every adapter (radix, fluent). */}
          {showEmptyInGrid && emptyState && (
            <EmptyState emptyState={emptyState} />
          )}
      </div>

        {menuPosition &&
          createPortal(
            <div style={{ ...contextMenuTheme, display: 'contents' }}>
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
              onPasteValues={interaction.handlePasteValues}
              onSelectAll={o.interaction.handleSelectAllCells}
              onClose={closeContextMenu}
              structure={structureMenu}
              hiding={hidingMenu}
              notes={cellNotes.menu}
            />
            </div>,
            getContextMenuPortalTarget ? getContextMenuPortalTarget(wrapperRef.current) : document.body
          )}

        <ColumnHeaderMenu {...getColumnHeaderMenuProps(headerMenu)} />
      </div>
      {findReplace.highlightCss && <style>{findReplace.highlightCss}</style>}
      {findReplace.enabled && findReplace.find.isOpen && FindReplacePanel && (
        <div style={FIND_PANEL_HOST_STYLE} data-ogrid-find-panel="">
          <FindReplacePanel find={findReplace.find} onClose={findReplace.close} focusRequest={findReplace.focusRequest} />
        </div>
      )}
      {/* Outside the wrapper so the editor's keys never reach the grid's key handling. */}
      <CellNotePopover
        notes={cellNotes as Parameters<typeof CellNotePopover>[0]['notes']}
        wrapperRef={wrapperRef}
        viewId={`${noteIdPrefix}-popover`}
        styles={styles}
        primitives={primitives}
      />
      {statusBarConfig && (
        <StatusBar
          totalCount={statusBarConfig.totalCount}
          filteredCount={statusBarConfig.filteredCount}
          selectedCount={statusBarConfig.selectedCount ?? selectedRowIds.size}
          selectedCellCount={selectionRange ? (Math.abs(selectionRange.endRow - selectionRange.startRow) + 1) * (Math.abs(selectionRange.endCol - selectionRange.startCol) + 1) : undefined}
          aggregation={statusBarConfig.aggregation}
          suppressRowCount={statusBarConfig.suppressRowCount}
          panels={statusBarConfig.panels}
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
