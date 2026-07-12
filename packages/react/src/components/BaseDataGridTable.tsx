import * as React from 'react';
import { createPortal } from 'react-dom';
import { ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { useDataGridTableOrchestration } from '../hooks/useDataGridTableOrchestration';
import { useColumnMeta } from '../hooks/useColumnMeta';
import { useRenderCellContent } from '../hooks/useRenderCellContent';
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
} from './BaseDataGridTable.types';

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

  const renderCellContent = useRenderCellContent(o, styles, primitives);

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
                <BaseTableHeader
                  o={o}
                  columnMeta={columnMeta}
                  sortBy={gridProps.sortBy}
                  sortDirection={gridProps.sortDirection}
                  styles={styles}
                  primitives={primitives}
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
