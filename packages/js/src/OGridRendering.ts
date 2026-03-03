/**
 * Rendering helper for OGrid (Vanilla JS).
 *
 * Extracts rendering logic from OGrid for modularity:
 *   - updateRendererInteractionState()
 *   - updateDragAttributes()
 *   - renderAll()
 *   - renderHeaderFilterPopover()
 *   - renderSideBar()
 *   - renderLoadingOverlay()
 *
 * Not exported publicly — instantiated and owned by OGrid.
 */
import type { OGridOptions } from './types/gridTypes';
import type { GridState } from './state/GridState';
import type { TableRenderer } from './renderer/TableRenderer';
import type { PaginationControls } from './components/PaginationControls';
import type { StatusBar } from './components/StatusBar';
import type { ColumnChooser } from './components/ColumnChooser';
import type { SideBarState } from './state/SideBarState';
import type { SideBar } from './components/SideBar';
import type { HeaderFilterState, HeaderFilterConfig } from './state/HeaderFilterState';
import type { HeaderFilter } from './components/HeaderFilter';
import type { SelectionState } from './state/SelectionState';
import type { KeyboardNavState } from './state/KeyboardNavState';
import type { ClipboardState } from './state/ClipboardState';
import type { UndoRedoState } from './state/UndoRedoState';
import type { ColumnResizeState } from './state/ColumnResizeState';
import type { FillHandleState } from './state/FillHandleState';
import type { RowSelectionState } from './state/RowSelectionState';
import type { ColumnPinningState } from './state/ColumnPinningState';
import type { ColumnReorderState } from './state/ColumnReorderState';
import type { VirtualScrollState } from './state/VirtualScrollState';
import type { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
import type { InlineCellEditor } from './components/InlineCellEditor';
import type { TableLayoutState } from './state/TableLayoutState';
import { normalizeSelectionRange, isInSelectionRange, CHECKBOX_COLUMN_WIDTH, measureColumnContentWidth, DEFAULT_MIN_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { getCellCoordinates } from './utils/getCellCoordinates';

/**
 * Context object providing access to OGrid's internal state for rendering.
 * OGrid populates this once during construction and keeps it current.
 */
export interface OGridRenderingContext<T> {
  options: OGridOptions<T>;
  state: GridState<T>;
  renderer: TableRenderer<T>;
  pagination: PaginationControls<T>;
  statusBar: StatusBar;
  columnChooser: ColumnChooser<T>;
  layoutState: TableLayoutState;
  tableContainer: HTMLElement;

  // Optional sub-systems (may be null if not enabled)
  selectionState: SelectionState | null;
  keyboardNavState: KeyboardNavState<T> | null;
  clipboardState: ClipboardState<T> | null;
  undoRedoState: UndoRedoState<T> | null;
  resizeState: ColumnResizeState | null;
  fillHandleState: FillHandleState<T> | null;
  rowSelectionState: RowSelectionState<T> | null;
  pinningState: ColumnPinningState | null;
  reorderState: ColumnReorderState | null;
  virtualScrollState: VirtualScrollState | null;
  marchingAnts: MarchingAntsOverlay | null;
  cellEditor: InlineCellEditor<T> | null;

  // Layout state
  sideBarState: SideBarState | null;
  sideBarComponent: SideBar | null;
  headerFilterState: HeaderFilterState;
  headerFilterComponent: HeaderFilter;
  filterConfigs: Map<string, HeaderFilterConfig>;
  loadingOverlay: HTMLElement | null;
  setLoadingOverlay: (el: HTMLElement | null) => void;

  // Callbacks back to OGrid
  handleCellClick: (rowIndex: number, colIndex: number) => void;
  handleCellMouseDown: (rowIndex: number, colIndex: number, e: MouseEvent) => void;
  handleCellContextMenu: (rowIndex: number, colIndex: number, e: MouseEvent) => void;
  startCellEdit: (rowId: import('@alaarab/ogrid-core').RowId, columnId: string) => void;
  toggleBooleanCell: (rowId: import('@alaarab/ogrid-core').RowId, columnId: string, currentValue: boolean) => void;
  showContextMenu: (x: number, y: number) => void;
}

export class OGridRendering<T> {
  private ctx: OGridRenderingContext<T>;
  private layoutVersion = 0;

  /** Cached DOM cells during drag to avoid querySelectorAll on every RAF frame. */
  private cachedDragCells: NodeListOf<Element> | null = null;

  constructor(ctx: OGridRenderingContext<T>) {
    this.ctx = ctx;
  }

  /** Increment layout version (e.g., when items, columns, sizing change). */
  incrementLayoutVersion(): void {
    this.layoutVersion++;
  }

  /** Clear cached drag cells. */
  clearCachedDragCells(): void {
    this.cachedDragCells = null;
  }

  /** Get current layout version. */
  getLayoutVersion(): number {
    return this.layoutVersion;
  }

  updateRendererInteractionState(): void {
    const { selectionState, clipboardState, resizeState, state, layoutState, pinningState, rowSelectionState, cellEditor, renderer, reorderState, marchingAnts, fillHandleState, options } = this.ctx;
    if (!selectionState || !clipboardState || !resizeState) return;

    const { items } = state.getProcessedItems();
    const visibleCols = state.visibleColumnDefs;

    // Compute pinning offsets
    const columnWidths = layoutState.getAllColumnWidths();
    const leftOffsets = pinningState?.computeLeftOffsets(
      visibleCols,
      columnWidths,
      120,
      !!rowSelectionState,
      CHECKBOX_COLUMN_WIDTH,
      !!options.showRowNumbers
    ) ?? {};
    const rightOffsets = pinningState?.computeRightOffsets(
      visibleCols,
      columnWidths,
      120
    ) ?? {};

    renderer.setInteractionState({
      activeCell: selectionState.activeCell,
      selectionRange: selectionState.selectionRange,
      copyRange: clipboardState.copyRange,
      cutRange: clipboardState.cutRange,
      editingCell: cellEditor?.getEditingCell() ?? null,
      columnWidths,
      onCellClick: (ce) => this.ctx.handleCellClick(ce.rowIndex, ce.colIndex),
      onCellMouseDown: (ce) => { if (ce.event) this.ctx.handleCellMouseDown(ce.rowIndex, ce.colIndex, ce.event); },
      onCellDoubleClick: (ce) => { if (ce.rowId != null && ce.columnId) this.ctx.startCellEdit(ce.rowId, ce.columnId); },
      onCellContextMenu: (ce) => { if (ce.event) this.ctx.handleCellContextMenu(ce.rowIndex, ce.colIndex, ce.event); },
      onResizeStart: renderer.getOnResizeStart(),
      onResizeDoubleClick: (columnId: string) => {
        const col = visibleCols.find(c => c.columnId === columnId);
        const minW = col?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
        const container = renderer.getTableElement()?.parentElement ?? undefined;
        const idealWidth = measureColumnContentWidth(columnId, minW, container);
        resizeState.setColumnWidth(columnId, idealWidth);
      },
      // Boolean toggle
      onBooleanToggle: options.editable !== false ? (rowId, columnId, currentValue) => this.ctx.toggleBooleanCell(rowId, columnId, currentValue) : undefined,
      // Fill handle
      onFillHandleMouseDown: options.editable !== false ? (e) => fillHandleState?.startFillDrag(e) : undefined,
      // Row selection
      rowSelectionMode: rowSelectionState?.rowSelection ?? 'none',
      selectedRowIds: rowSelectionState?.selectedRowIds,
      onRowCheckboxChange: (rowId, checked, rowIndex, shiftKey) => {
        rowSelectionState?.handleRowCheckboxChange(rowId, checked, rowIndex, shiftKey, items);
      },
      onSelectAll: (checked) => {
        rowSelectionState?.handleSelectAll(checked, items);
      },
      allSelected: rowSelectionState?.isAllSelected(items),
      someSelected: rowSelectionState?.isSomeSelected(items),
      // Row numbers
      showRowNumbers: options.showRowNumbers || options.cellReferences,
      // Column letters
      showColumnLetters: !!options.cellReferences,
      // Name box
      showNameBox: !!options.cellReferences,
      // Column pinning
      pinnedColumns: pinningState?.pinnedColumns,
      leftOffsets,
      rightOffsets,
      // Column reorder
      onColumnReorderStart: reorderState ? (columnId, event) => {
        const tableEl = renderer.getTableElement();
        if (!tableEl) return;
        reorderState?.startDrag(
          columnId,
          event,
          visibleCols,
          state.columnOrder,
          pinningState?.pinnedColumns,
          tableEl
        );
      } : undefined,
    });

    renderer.update();

    // Update marching ants overlay
    marchingAnts?.update(
      selectionState.selectionRange,
      clipboardState.copyRange,
      clipboardState.cutRange,
      this.layoutVersion
    );
  }

  updateDragAttributes(): void {
    const wrapper = this.ctx.renderer.getWrapperElement();
    const selectionState = this.ctx.selectionState;
    if (!wrapper || !selectionState) return;

    const range = selectionState.getDragRange();
    if (!range) return;

    const norm = normalizeSelectionRange(range);
    const anchor = selectionState.dragAnchor;
    // Cache the querySelectorAll result on first drag call; reuse for subsequent RAF frames
    if (!this.cachedDragCells) {
      this.cachedDragCells = wrapper.querySelectorAll('td[data-row-index][data-col-index]');
    }
    const cells = this.cachedDragCells;

    for (let _i = 0; _i < cells.length; _i++) {
      const cell = cells[_i];
      const el = cell as HTMLElement;
      const coords = getCellCoordinates(el);
      if (!coords) continue;
      const rowIndex = coords.rowIndex;
      const colIndex = coords.colIndex;

      if (isInSelectionRange(norm, rowIndex, colIndex)) {
        el.setAttribute('data-drag-range', 'true');
        // Anchor cell (white background)
        const isAnchor = anchor && rowIndex === anchor.rowIndex && colIndex === anchor.columnIndex;
        if (isAnchor) {
          el.setAttribute('data-drag-anchor', '');
        } else {
          el.removeAttribute('data-drag-anchor');
        }
        // Edge borders via CSS class instead of inline box-shadow
        el.classList.add('ogrid-drag-target');
      } else {
        el.removeAttribute('data-drag-range');
        el.removeAttribute('data-drag-anchor');
        el.classList.remove('ogrid-drag-target');
      }
    }
  }

  renderAll(): void {
    // Increment layout version to trigger marching ants re-measurement
    this.layoutVersion++;

    const { state, options, headerFilterState, rowSelectionState, keyboardNavState, clipboardState, undoRedoState, fillHandleState, virtualScrollState, pagination, statusBar, columnChooser, renderer } = this.ctx;
    const colOffset = rowSelectionState ? 1 : 0;

    // Update header filter state with current filters and options
    headerFilterState.setFilters(state.filters);
    headerFilterState.setFilterOptions(state.filterOptions);

    // Update interaction states with current data
    const { items, totalCount } = state.getProcessedItems();
    if (keyboardNavState && clipboardState) {
      const visibleCols = state.visibleColumnDefs;

      keyboardNavState.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof keyboardNavState.updateParams>[0]['visibleCols'],
        colOffset,
        getRowId: state.getRowId,
        editable: options.editable,
        onCellValueChanged: undoRedoState?.getWrappedCallback(),
        onCopy: () => clipboardState?.handleCopy(),
        onCut: () => clipboardState?.handleCut(),
        onPaste: async () => { await clipboardState?.handlePaste(); },
        onUndo: () => undoRedoState?.undo(),
        onRedo: () => undoRedoState?.redo(),
        onContextMenu: (x, y) => this.ctx.showContextMenu(x, y),
        onStartEdit: (rowId, columnId) => this.ctx.startCellEdit(rowId, columnId),
        clearClipboardRanges: () => clipboardState?.clearClipboardRanges(),
        onKeyDown: options.onKeyDown,
        onFillDown: fillHandleState ? () => fillHandleState.fillDown() : undefined,
      });

      clipboardState.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof clipboardState.updateParams>[0]['visibleCols'],
        colOffset,
        editable: options.editable,
        onCellValueChanged: undoRedoState?.getWrappedCallback(),
      });

      // Update fill handle params
      fillHandleState?.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof import('./state/FillHandleState').FillHandleState<T>['prototype']['updateParams']>[0]['visibleCols'],
        editable: options.editable,
        onCellValueChanged: undoRedoState?.getWrappedCallback(),
        colOffset,
        beginBatch: () => undoRedoState?.beginBatch(),
        endBatch: () => undoRedoState?.endBatch(),
      });

      // Update renderer interaction state before rendering
      this.updateRendererInteractionState();
    } else {
      renderer.update();
    }

    // Update virtual scroll with current total row count
    virtualScrollState?.setTotalRows(totalCount);

    pagination.render(totalCount, options.pageSizeOptions);
    statusBar.render({ totalCount });
    columnChooser.render();
    this.renderSideBar();
    this.renderLoadingOverlay();
  }

  renderHeaderFilterPopover(): void {
    const { headerFilterState, headerFilterComponent, filterConfigs } = this.ctx;
    const openId = headerFilterState.openColumnId;

    // Sync aria-expanded on all filter buttons
    const allBtns = this.ctx.tableContainer.querySelectorAll<HTMLElement>('.ogrid-filter-icon[aria-haspopup]');
    for (const btn of allBtns) {
      const colId = btn.closest('th[data-column-id]')?.getAttribute('data-column-id');
      btn.setAttribute('aria-expanded', colId === openId ? 'true' : 'false');
    }

    if (!openId) {
      headerFilterComponent.cleanup();
      return;
    }
    const config = filterConfigs.get(openId);
    if (!config) return;

    headerFilterComponent.render(config);

    // Update the popover element reference for click-outside detection
    const popoverEl = document.querySelector('.ogrid-header-filter-popover') as HTMLElement | null;
    headerFilterState.setPopoverEl(popoverEl);
  }

  renderSideBar(): void {
    const { sideBarComponent, sideBarState, state } = this.ctx;
    if (!sideBarComponent || !sideBarState) return;

    const columns = state.columns.map(c => ({
      columnId: c.columnId,
      name: c.name,
      required: c.required === true,
    }));

    const filterableColumns = state.columns
      .filter(c => c.filterable && typeof c.filterable === 'object' && c.filterable.type)
      .map(c => ({
        columnId: c.columnId,
        name: c.name,
        filterField: (c.filterable as { filterField?: string }).filterField ?? c.columnId,
        filterType: (c.filterable as { type: string }).type as 'text' | 'multiSelect' | 'people' | 'date',
      }));

    sideBarComponent.setConfig({
      columns,
      visibleColumns: state.visibleColumns,
      onVisibilityChange: (columnKey, visible) => {
        const next = new Set(state.visibleColumns);
        if (visible) next.add(columnKey);
        else next.delete(columnKey);
        state.setVisibleColumns(next);
      },
      onSetVisibleColumns: (cols) => state.setVisibleColumns(cols),
      filterableColumns,
      filters: state.filters,
      onFilterChange: (key, value) => state.setFilter(key, value),
      filterOptions: state.filterOptions,
    });

    sideBarComponent.render();
  }

  renderLoadingOverlay(): void {
    const { state, tableContainer } = this.ctx;
    if (state.isLoading) {
      // Ensure the container has minimum height during loading so overlay is visible
      const { items } = state.getProcessedItems();
      tableContainer.style.minHeight = (!items || items.length === 0) ? '200px' : '';
      let loadingOverlay = this.ctx.loadingOverlay;
      if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'ogrid-loading-overlay';
        loadingOverlay.style.position = 'absolute';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.right = '0';
        loadingOverlay.style.bottom = '0';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.background = 'var(--ogrid-loading-overlay, rgba(255, 255, 255, 0.7))';
        loadingOverlay.style.zIndex = '100';

        const spinner = document.createElement('div');
        spinner.className = 'ogrid-loading-spinner';
        spinner.textContent = 'Loading...';
        loadingOverlay.appendChild(spinner);
        this.ctx.setLoadingOverlay(loadingOverlay);
      }
      if (!tableContainer.contains(loadingOverlay)) {
        tableContainer.appendChild(loadingOverlay);
      }
    } else {
      tableContainer.style.minHeight = '';
      const loadingOverlay = this.ctx.loadingOverlay;
      if (loadingOverlay && tableContainer.contains(loadingOverlay)) {
        loadingOverlay.remove();
      }
    }
  }
}
