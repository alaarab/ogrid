import type { OGridOptions, OGridEvents, IJsOGridApi } from './types/gridTypes';
import type { FilterValue } from '@alaarab/ogrid-core';
import { GridState } from './state/GridState';
import { TableRenderer } from './renderer/TableRenderer';
import { PaginationControls } from './components/PaginationControls';
import { StatusBar } from './components/StatusBar';
import { ColumnChooser } from './components/ColumnChooser';
import { SideBarState } from './state/SideBarState';
import { SideBar } from './components/SideBar';
import { HeaderFilterState } from './state/HeaderFilterState';
import { HeaderFilter } from './components/HeaderFilter';
import type { HeaderFilterConfig } from './state/HeaderFilterState';
import { SelectionState } from './state/SelectionState';
import { KeyboardNavState } from './state/KeyboardNavState';
import { ClipboardState } from './state/ClipboardState';
import { UndoRedoState } from './state/UndoRedoState';
import { ColumnResizeState } from './state/ColumnResizeState';
import { TableLayoutState } from './state/TableLayoutState';
import { FillHandleState } from './state/FillHandleState';
import { RowSelectionState } from './state/RowSelectionState';
import { ColumnPinningState } from './state/ColumnPinningState';
import { ColumnReorderState } from './state/ColumnReorderState';
import { VirtualScrollState } from './state/VirtualScrollState';
import { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
import { InlineCellEditor } from './components/InlineCellEditor';
import { ContextMenu } from './components/ContextMenu';
import { EventEmitter } from './state/EventEmitter';
import type { RowId } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, isInSelectionRange, flattenColumns, injectGlobalStyles } from '@alaarab/ogrid-core';

/** CSS variable definitions for light and dark themes (injected once per page). */
const OGRID_THEME_CSS = `
:root {
  --ogrid-bg: #ffffff;
  --ogrid-fg: rgba(0, 0, 0, 0.87);
  --ogrid-fg-secondary: rgba(0, 0, 0, 0.6);
  --ogrid-fg-muted: rgba(0, 0, 0, 0.5);
  --ogrid-border: rgba(0, 0, 0, 0.12);
  --ogrid-header-bg: rgba(0, 0, 0, 0.04);
  --ogrid-hover-bg: rgba(0, 0, 0, 0.04);
  --ogrid-selected-row-bg: #e6f0fb;
  --ogrid-active-cell-bg: rgba(0, 0, 0, 0.02);
  --ogrid-range-bg: rgba(33, 115, 70, 0.12);
  --ogrid-accent: #0078d4;
  --ogrid-selection-color: #217346;
  --ogrid-loading-overlay: rgba(255, 255, 255, 0.7);
  --ogrid-bg-subtle: #f3f2f1;
  --ogrid-bg-hover: rgba(0, 0, 0, 0.04);
  --ogrid-bg-selected: #e6f0fb;
  --ogrid-bg-selected-hover: #dae8f8;
  --ogrid-bg-range: rgba(33, 115, 70, 0.12);
  --ogrid-muted: rgba(0, 0, 0, 0.5);
  --ogrid-selection: #217346;
  --ogrid-primary: #217346;
  --ogrid-primary-fg: #fff;
  --ogrid-loading-bg: rgba(255, 255, 255, 0.7);
  --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
[data-theme='dark'] {
  --ogrid-bg: #1e1e1e;
  --ogrid-fg: rgba(255, 255, 255, 0.87);
  --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
  --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
  --ogrid-border: rgba(255, 255, 255, 0.12);
  --ogrid-header-bg: rgba(255, 255, 255, 0.06);
  --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
  --ogrid-selected-row-bg: #1a3a5c;
  --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
  --ogrid-range-bg: rgba(46, 160, 67, 0.15);
  --ogrid-accent: #4da6ff;
  --ogrid-selection-color: #2ea043;
  --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
  --ogrid-bg-subtle: #2a2a2a;
  --ogrid-bg-hover: rgba(255, 255, 255, 0.08);
  --ogrid-bg-selected: #1a3a5c;
  --ogrid-bg-selected-hover: #1f426b;
  --ogrid-bg-range: rgba(46, 160, 67, 0.15);
  --ogrid-muted: rgba(255, 255, 255, 0.5);
  --ogrid-selection: #2ea043;
  --ogrid-primary: #2ea043;
  --ogrid-primary-fg: #fff;
  --ogrid-loading-bg: rgba(0, 0, 0, 0.7);
  --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --ogrid-bg: #1e1e1e;
    --ogrid-fg: rgba(255, 255, 255, 0.87);
    --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
    --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
    --ogrid-border: rgba(255, 255, 255, 0.12);
    --ogrid-header-bg: rgba(255, 255, 255, 0.06);
    --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
    --ogrid-selected-row-bg: #1a3a5c;
    --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
    --ogrid-range-bg: rgba(46, 160, 67, 0.15);
    --ogrid-accent: #4da6ff;
    --ogrid-selection-color: #2ea043;
    --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
    --ogrid-bg-subtle: #2a2a2a;
    --ogrid-bg-hover: rgba(255, 255, 255, 0.08);
    --ogrid-bg-selected: #1a3a5c;
    --ogrid-bg-selected-hover: #1f426b;
    --ogrid-bg-range: rgba(46, 160, 67, 0.15);
    --ogrid-muted: rgba(255, 255, 255, 0.5);
    --ogrid-selection: #2ea043;
    --ogrid-primary: #2ea043;
    --ogrid-primary-fg: #fff;
    --ogrid-loading-bg: rgba(0, 0, 0, 0.7);
    --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
}
`;

export class OGrid<T> {
  private state: GridState<T>;
  private renderer: TableRenderer<T>;
  private pagination: PaginationControls<T>;
  private statusBar: StatusBar;
  private columnChooser: ColumnChooser<T>;

  // Sidebar
  private sideBarState: SideBarState | null = null;
  private sideBarComponent: SideBar | null = null;
  private sideBarContainer: HTMLElement | null = null;

  // Header filter popovers
  private headerFilterState: HeaderFilterState;
  private headerFilterComponent: HeaderFilter;
  private filterConfigs: Map<string, HeaderFilterConfig> = new Map();

  // Loading overlay
  private loadingOverlay: HTMLElement | null = null;

  // Body area (holds sidebar + table)
  private bodyArea: HTMLElement | null = null;

  // Interaction states
  private selectionState: SelectionState | null = null;
  private keyboardNavState: KeyboardNavState<T> | null = null;
  private clipboardState: ClipboardState<T> | null = null;
  private undoRedoState: UndoRedoState<T> | null = null;
  private resizeState: ColumnResizeState | null = null;
  private fillHandleState: FillHandleState<T> | null = null;
  private rowSelectionState: RowSelectionState<T> | null = null;
  private pinningState: ColumnPinningState | null = null;
  private reorderState: ColumnReorderState | null = null;
  private virtualScrollState: VirtualScrollState | null = null;
  private marchingAnts: MarchingAntsOverlay | null = null;
  private cellEditor: InlineCellEditor<T> | null = null;
  private contextMenu: ContextMenu | null = null;
  private layoutState: TableLayoutState;

  private events = new EventEmitter<OGridEvents<T>>();
  private unsubscribes: (() => void)[] = [];
  private containerEl: HTMLElement;
  private tableContainer: HTMLElement;
  private toolbarEl: HTMLElement;
  private paginationContainer: HTMLElement;
  private statusBarContainer: HTMLElement;
  private options: OGridOptions<T>;
  private layoutVersion = 0; // Incremented when items, columns, sizing, or order change

  /** The imperative grid API (extends React's IOGridApi with JS-specific methods). */
  readonly api: IJsOGridApi<T>;

  constructor(container: HTMLElement, options: OGridOptions<T>) {
    this.options = options;
    this.state = new GridState<T>(options);
    this.api = this.state.getApi();

    // Inject theme CSS variables (light + dark) once per page
    injectGlobalStyles('ogrid-theme-vars', OGRID_THEME_CSS);

    // Build layout
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'ogrid-container';

    // Toolbar
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'ogrid-toolbar';
    // Left spacer keeps column chooser on the right via justify-content: space-between
    const toolbarSpacer = document.createElement('div');
    this.toolbarEl.appendChild(toolbarSpacer);
    this.containerEl.appendChild(this.toolbarEl);

    // Body area (holds sidebar + table, side by side)
    this.bodyArea = document.createElement('div');
    this.bodyArea.className = 'ogrid-body-area';
    this.bodyArea.style.display = 'flex';
    this.bodyArea.style.flex = '1';
    this.bodyArea.style.overflow = 'hidden';
    this.containerEl.appendChild(this.bodyArea);

    // Table container (inside body area)
    this.tableContainer = document.createElement('div');
    this.tableContainer.className = 'ogrid-table-container';
    this.tableContainer.style.flex = '1';
    this.tableContainer.style.overflow = 'auto';
    this.tableContainer.style.position = 'relative';
    this.bodyArea.appendChild(this.tableContainer);

    // Status bar container
    this.statusBarContainer = document.createElement('div');
    this.statusBarContainer.className = 'ogrid-status-bar-container';
    this.containerEl.appendChild(this.statusBarContainer);

    // Pagination container
    this.paginationContainer = document.createElement('div');
    this.paginationContainer.className = 'ogrid-pagination-container';
    this.containerEl.appendChild(this.paginationContainer);

    container.appendChild(this.containerEl);

    // Create layout state (measures container, tracks column sizing)
    this.layoutState = new TableLayoutState();
    this.layoutState.observeContainer(this.tableContainer);

    // Create sub-components
    this.renderer = new TableRenderer<T>(this.tableContainer, this.state);
    this.pagination = new PaginationControls<T>(this.paginationContainer, this.state);
    this.statusBar = new StatusBar(this.statusBarContainer);
    this.columnChooser = new ColumnChooser<T>(this.toolbarEl, this.state);

    // Initialize header filter state
    this.headerFilterState = new HeaderFilterState((key: string, value: FilterValue | undefined) => {
      this.state.setFilter(key, value);
    });
    this.headerFilterComponent = new HeaderFilter(this.headerFilterState);
    this.buildFilterConfigs();

    // Pass filter config to renderer for filter icons in headers
    this.renderer.setHeaderFilterState(this.headerFilterState, this.filterConfigs);
    this.renderer.setOnFilterIconClick((columnId: string, headerEl: HTMLElement) => {
      this.handleFilterIconClick(columnId, headerEl);
    });

    // Initialize sidebar if configured
    if (options.sideBar) {
      this.sideBarState = new SideBarState(options.sideBar);
      this.sideBarContainer = document.createElement('div');
      this.sideBarContainer.className = 'ogrid-sidebar-container';
      this.sideBarComponent = new SideBar(this.sideBarContainer, this.sideBarState);

      if (this.sideBarState.position === 'left') {
        this.bodyArea!.insertBefore(this.sideBarContainer, this.tableContainer);
      } else {
        this.bodyArea!.appendChild(this.sideBarContainer);
      }

      this.unsubscribes.push(
        this.sideBarState.onChange(() => {
          this.renderSideBar();
        })
      );
    }

    // Initialize column pinning (always active, even without interaction)
    const flatCols = flattenColumns(options.columns as unknown as Parameters<typeof flattenColumns>[0]);
    this.pinningState = new ColumnPinningState(
      options.pinnedColumns,
      flatCols as unknown as import('@alaarab/ogrid-core').IColumnDef[]
    );

    // Initialize row selection (always active if rowSelection is set)
    if (options.rowSelection && options.rowSelection !== 'none') {
      this.rowSelectionState = new RowSelectionState<T>(
        options.rowSelection,
        options.getRowId
      );

      // Wire row selection API methods
      this.api.getSelectedRows = () => {
        return Array.from(this.rowSelectionState?.selectedRowIds ?? []);
      };
      this.api.selectAll = () => {
        const { items } = this.state.getProcessedItems();
        this.rowSelectionState?.handleSelectAll(true, items);
      };
      this.api.deselectAll = () => {
        const { items } = this.state.getProcessedItems();
        this.rowSelectionState?.handleSelectAll(false, items);
      };
      this.api.setSelectedRows = (rowIds: RowId[]) => {
        const { items } = this.state.getProcessedItems();
        this.rowSelectionState?.updateSelection(new Set(rowIds), items);
      };

      this.unsubscribes.push(
        this.rowSelectionState.onRowSelectionChange(() => {
          this.updateRendererInteractionState();
        })
      );
    }

    // Initial render (must happen before interaction init so wrapper DOM exists)
    this.renderer.render();

    // Initialize interaction features if enabled (default: true for cellSelection)
    const shouldEnableInteraction = options.cellSelection !== false || options.editable === true;
    if (shouldEnableInteraction) {
      this.initializeInteraction();
    }

    // Subscribe to state changes
    this.unsubscribes.push(
      this.state.onStateChange(() => {
        this.renderAll();
      })
    );

    // Subscribe to pinning changes
    this.unsubscribes.push(
      this.pinningState.onPinningChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Subscribe to header filter state changes
    this.unsubscribes.push(
      this.headerFilterState.onChange(() => {
        this.renderHeaderFilterPopover();
      })
    );

    // Initialize virtual scrolling if configured
    if (options.virtualScroll?.enabled) {
      this.virtualScrollState = new VirtualScrollState(options.virtualScroll);
      this.virtualScrollState.observeContainer(this.tableContainer);
      this.renderer.setVirtualScrollState(this.virtualScrollState);

      // Wire scroll event on the table container
      const handleScroll = () => {
        this.virtualScrollState?.handleScroll(this.tableContainer.scrollTop);
      };
      this.tableContainer.addEventListener('scroll', handleScroll, { passive: true });
      this.unsubscribes.push(() => {
        this.tableContainer.removeEventListener('scroll', handleScroll);
      });

      // Re-render when visible range changes
      this.unsubscribes.push(
        this.virtualScrollState.onRangeChanged(() => {
          this.updateRendererInteractionState();
        })
      );

      // Wire scrollToRow API method
      this.api.scrollToRow = (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => {
        this.virtualScrollState?.scrollToRow(index, this.tableContainer, opts?.align);
      };
    }

    // Complete initial render (pagination, status bar, column chooser, sidebar, loading)
    this.renderAll();
  }

  private initializeInteraction(): void {
    const { editable } = this.options;
    const colOffset = this.rowSelectionState ? 1 : 0;

    // Create interaction states
    this.selectionState = new SelectionState();
    this.resizeState = new ColumnResizeState();
    this.contextMenu = new ContextMenu();
    this.cellEditor = new InlineCellEditor<T>(this.tableContainer);

    // Undo/Redo (wraps onCellValueChanged if editable)
    const onCellValueChanged = this.options.onCellValueChanged;
    this.undoRedoState = new UndoRedoState<T>(onCellValueChanged);

    // Clipboard
    this.clipboardState = new ClipboardState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof ClipboardState<T>['prototype']['updateParams']>[0]['visibleCols'],
        colOffset,
        editable,
        onCellValueChanged: this.undoRedoState.getWrappedCallback(),
      },
      () => this.selectionState?.activeCell ?? null,
      () => this.selectionState?.selectionRange ?? null
    );

    // Fill handle
    this.fillHandleState = new FillHandleState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof FillHandleState<T>['prototype']['updateParams']>[0]['visibleCols'],
        editable,
        onCellValueChanged: this.undoRedoState.getWrappedCallback(),
        colOffset,
        beginBatch: () => this.undoRedoState?.beginBatch(),
        endBatch: () => this.undoRedoState?.endBatch(),
      },
      () => this.selectionState?.selectionRange ?? null,
      (range) => {
        this.selectionState?.setSelectionRange(range);
        this.updateRendererInteractionState();
      },
      (cell) => {
        this.selectionState?.setActiveCell(cell);
      }
    );

    // Keyboard navigation
    this.keyboardNavState = new KeyboardNavState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof KeyboardNavState<T>['prototype']['updateParams']>[0]['visibleCols'],
        colOffset,
        getRowId: this.state.getRowId,
        editable,
        onCellValueChanged: this.undoRedoState.getWrappedCallback(),
        onCopy: () => this.clipboardState?.handleCopy(),
        onCut: () => this.clipboardState?.handleCut(),
        onPaste: async () => { await this.clipboardState?.handlePaste(); },
        onUndo: () => this.undoRedoState?.undo(),
        onRedo: () => this.undoRedoState?.redo(),
        onContextMenu: (x, y) => this.showContextMenu(x, y),
        onStartEdit: (rowId, columnId) => this.startCellEdit(rowId, columnId),
        clearClipboardRanges: () => this.clipboardState?.clearClipboardRanges(),
      },
      () => this.selectionState?.activeCell ?? null,
      () => this.selectionState?.selectionRange ?? null,
      (cell) => this.selectionState?.setActiveCell(cell),
      (range) => this.selectionState?.setSelectionRange(range)
    );

    // Subscribe to selection changes
    this.unsubscribes.push(
      this.selectionState.onSelectionChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Subscribe to clipboard range changes
    this.unsubscribes.push(
      this.clipboardState.onRangesChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Subscribe to column resize changes
    this.unsubscribes.push(
      this.resizeState.onColumnWidthChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Column reorder
    this.reorderState = new ColumnReorderState();
    this.unsubscribes.push(
      this.reorderState.onStateChange(({ isDragging, dropIndicatorX }) => {
        this.renderer.updateDropIndicator(dropIndicatorX, isDragging);
      })
    );
    this.unsubscribes.push(
      this.reorderState.onReorder(({ columnOrder }) => {
        this.state.setColumnOrder(columnOrder);
      })
    );

    // Attach keyboard handler to wrapper
    const wrapper = this.renderer.getWrapperElement();
    if (wrapper) {
      wrapper.addEventListener('keydown', this.keyboardNavState.handleKeyDown);
      this.keyboardNavState.setWrapperRef(wrapper);
      this.fillHandleState.setWrapperRef(wrapper);

      // Initialize marching ants overlay
      this.marchingAnts = new MarchingAntsOverlay(wrapper, colOffset);
    }

    // Attach global mouse handlers for resize and drag
    this.attachGlobalHandlers();

    // Set initial interaction state on renderer
    this.updateRendererInteractionState();
  }

  private attachGlobalHandlers(): void {
    let resizing = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing && this.resizeState) {
        const newWidth = this.resizeState.updateResize(e.clientX);
        if (newWidth !== null && this.resizeState.resizingColumnId) {
          this.layoutState.setColumnOverride(this.resizeState.resizingColumnId, newWidth);
          this.updateRendererInteractionState();
        }
      }
      if (this.selectionState?.isDragging) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TD') {
          const rowIndex = parseInt(target.getAttribute('data-row-index') ?? '-1', 10);
          const colIndex = parseInt(target.getAttribute('data-col-index') ?? '-1', 10);
          if (rowIndex >= 0 && colIndex >= 0) {
            this.selectionState.updateDrag(rowIndex, colIndex, () => this.updateDragAttributes());
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizing && this.resizeState) {
        const colId = this.resizeState.resizingColumnId;
        this.resizeState.endResize(e.clientX);
        if (colId) {
          const width = this.resizeState.getColumnWidth(colId);
          if (width) this.layoutState.setColumnOverride(colId, width);
        }
        resizing = false;
        document.body.style.cursor = '';
        this.updateRendererInteractionState();
      }
      if (this.selectionState?.isDragging) {
        this.selectionState.endDrag();
      }
    };

    const handleResizeStart = (columnId: string, clientX: number, currentWidth: number) => {
      resizing = true;
      document.body.style.cursor = 'col-resize';
      this.resizeState?.startResize(columnId, clientX, currentWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Store references for cleanup
    this.unsubscribes.push(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });

    // Pass resize handler to renderer
    this.renderer.setInteractionState({
      activeCell: null,
      selectionRange: null,
      copyRange: null,
      cutRange: null,
      editingCell: null,
      columnWidths: {},
      onResizeStart: handleResizeStart,
    });
  }

  private updateRendererInteractionState(): void {
    if (!this.selectionState || !this.clipboardState || !this.resizeState) return;

    const { items } = this.state.getProcessedItems();
    const visibleCols = this.state.visibleColumnDefs;

    // Compute pinning offsets
    const columnWidths = this.layoutState.getAllColumnWidths();
    const leftOffsets = this.pinningState?.computeLeftOffsets(
      visibleCols,
      columnWidths,
      120,
      !!this.rowSelectionState,
      40,
      !!this.options.showRowNumbers
    ) ?? {};
    const rightOffsets = this.pinningState?.computeRightOffsets(
      visibleCols,
      columnWidths,
      120
    ) ?? {};

    this.renderer.setInteractionState({
      activeCell: this.selectionState.activeCell,
      selectionRange: this.selectionState.selectionRange,
      copyRange: this.clipboardState.copyRange,
      cutRange: this.clipboardState.cutRange,
      editingCell: this.cellEditor?.getEditingCell() ?? null,
      columnWidths,
      onCellClick: (rowIndex, colIndex) => this.handleCellClick(rowIndex, colIndex),
      onCellMouseDown: (rowIndex, colIndex, e) => this.handleCellMouseDown(rowIndex, colIndex, e),
      onCellDoubleClick: (rowIndex, colIndex, rowId, columnId) => this.startCellEdit(rowId, columnId),
      onCellContextMenu: (rowIndex, colIndex, e) => this.handleCellContextMenu(rowIndex, colIndex, e),
      onResizeStart: this.renderer['interactionState']?.onResizeStart,
      // Fill handle
      onFillHandleMouseDown: this.options.editable !== false ? (e) => this.fillHandleState?.startFillDrag(e) : undefined,
      // Row selection
      rowSelectionMode: this.rowSelectionState?.rowSelection ?? 'none',
      selectedRowIds: this.rowSelectionState?.selectedRowIds,
      onRowCheckboxChange: (rowId, checked, rowIndex, shiftKey) => {
        this.rowSelectionState?.handleRowCheckboxChange(rowId, checked, rowIndex, shiftKey, items);
      },
      onSelectAll: (checked) => {
        this.rowSelectionState?.handleSelectAll(checked, items);
      },
      allSelected: this.rowSelectionState?.isAllSelected(items),
      someSelected: this.rowSelectionState?.isSomeSelected(items),
      // Row numbers
      showRowNumbers: this.options.showRowNumbers,
      // Column pinning
      pinnedColumns: this.pinningState?.pinnedColumns,
      leftOffsets,
      rightOffsets,
      // Column reorder
      onColumnReorderStart: this.reorderState ? (columnId, event) => {
        const tableEl = this.renderer.getTableElement();
        if (!tableEl) return;
        this.reorderState?.startDrag(
          columnId,
          event,
          visibleCols,
          this.state.columnOrder,
          this.pinningState?.pinnedColumns,
          tableEl
        );
      } : undefined,
    });

    this.renderer.update();

    // Update marching ants overlay
    this.marchingAnts?.update(
      this.selectionState.selectionRange,
      this.clipboardState.copyRange,
      this.clipboardState.cutRange,
      this.layoutVersion
    );
  }

  private updateDragAttributes(): void {
    const wrapper = this.renderer.getWrapperElement();
    if (!wrapper || !this.selectionState) return;

    const range = this.selectionState.getDragRange();
    if (!range) return;

    const norm = normalizeSelectionRange(range);
    const anchor = this.selectionState.dragAnchor;
    const minR = norm.startRow;
    const maxR = norm.endRow;
    const minC = norm.startCol;
    const maxC = norm.endCol;
    const cells = wrapper.querySelectorAll('td[data-row-index][data-col-index]');

    for (const cell of Array.from(cells)) {
      const el = cell as HTMLElement;
      const rowIndex = parseInt(el.getAttribute('data-row-index') ?? '-1', 10);
      const colIndex = parseInt(el.getAttribute('data-col-index') ?? '-1', 10);

      if (isInSelectionRange(norm, rowIndex, colIndex)) {
        el.setAttribute('data-drag-range', 'true');
        // Anchor cell (white background)
        const isAnchor = anchor && rowIndex === anchor.rowIndex && colIndex === anchor.columnIndex;
        if (isAnchor) {
          el.setAttribute('data-drag-anchor', '');
        } else {
          el.removeAttribute('data-drag-anchor');
        }
        // Edge borders via inset box-shadow
        const shadows: string[] = [];
        if (rowIndex === minR) shadows.push('inset 0 2px 0 0 var(--ogrid-selection, #217346)');
        if (rowIndex === maxR) shadows.push('inset 0 -2px 0 0 var(--ogrid-selection, #217346)');
        if (colIndex === minC) shadows.push('inset 2px 0 0 0 var(--ogrid-selection, #217346)');
        if (colIndex === maxC) shadows.push('inset -2px 0 0 0 var(--ogrid-selection, #217346)');
        el.style.boxShadow = shadows.length > 0 ? shadows.join(', ') : '';
      } else {
        el.removeAttribute('data-drag-range');
        el.removeAttribute('data-drag-anchor');
        if (el.style.boxShadow) el.style.boxShadow = '';
      }
    }
  }

  private handleCellClick(rowIndex: number, colIndex: number): void {
    if (!this.selectionState) return;
    // setActiveCell also sets a single-cell selectionRange internally.
    // The selectionChange subscription handles re-rendering.
    this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex });
  }

  private handleCellMouseDown(rowIndex: number, colIndex: number, e: MouseEvent): void {
    if (!this.selectionState) return;
    e.preventDefault();
    this.selectionState.startDrag(rowIndex, colIndex);
    // Apply drag attributes immediately for instant visual feedback on the initial cell
    setTimeout(() => this.updateDragAttributes(), 0);
  }

  private handleCellContextMenu(rowIndex: number, colIndex: number, e: MouseEvent): void {
    e.preventDefault();
    if (!this.contextMenu || !this.selectionState || !this.clipboardState || !this.undoRedoState) return;

    // Set active cell if not already set
    if (!this.selectionState.activeCell || this.selectionState.activeCell.rowIndex !== rowIndex || this.selectionState.activeCell.columnIndex !== colIndex) {
      this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex });
      this.updateRendererInteractionState();
    }

    this.showContextMenu(e.clientX, e.clientY);
  }

  private showContextMenu(x: number, y: number): void {
    if (!this.contextMenu || !this.clipboardState || !this.undoRedoState || !this.keyboardNavState || !this.selectionState) return;

    this.contextMenu.show(
      x,
      y,
      {
        onCopy: () => this.clipboardState!.handleCopy(),
        onCut: () => this.clipboardState!.handleCut(),
        onPaste: () => void this.clipboardState!.handlePaste(),
        onSelectAll: () => {
          const { items } = this.state.getProcessedItems();
          const visibleCols = this.state.visibleColumnDefs;
          if (items.length > 0 && visibleCols.length > 0) {
            this.selectionState!.setSelectionRange({
              startRow: 0,
              startCol: 0,
              endRow: items.length - 1,
              endCol: visibleCols.length - 1,
            });
            this.updateRendererInteractionState();
          }
        },
        onUndo: () => this.undoRedoState!.undo(),
        onRedo: () => this.undoRedoState!.redo(),
      },
      this.undoRedoState.canUndo,
      this.undoRedoState.canRedo,
      this.selectionState.selectionRange
    );
  }

  private startCellEdit(rowId: RowId, columnId: string): void {
    if (!this.cellEditor || !this.undoRedoState) return;

    const { items } = this.state.getProcessedItems();
    const visibleCols = this.state.visibleColumnDefs;
    const item = items.find((it) => this.state.getRowId(it) === rowId);
    const column = visibleCols.find((col) => col.columnId === columnId);

    if (!item || !column) return;

    const wrapper = this.renderer.getWrapperElement();
    if (!wrapper) return;

    // Find the row first, then the cell within it
    const row = wrapper.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const cell = row.querySelector(`td[data-column-id="${columnId}"]`) as HTMLTableCellElement | null;
    if (!cell) return;

    const onCommit = (rid: RowId, cid: string, value: unknown) => {
      const itm = items.find((i) => this.state.getRowId(i) === rid);
      const col = visibleCols.find((c) => c.columnId === cid);
      if (!itm || !col) return;

      const oldValue = (itm as Record<string, unknown>)[cid];
      (itm as Record<string, unknown>)[cid] = value;

      const wrapped = this.undoRedoState!.getWrappedCallback();
      if (wrapped) {
        wrapped({
          item: itm,
          columnId: cid,
          oldValue,
          newValue: value,
          rowIndex: items.indexOf(itm),
        });
      }

      this.updateRendererInteractionState();
    };

    const onCancel = () => {
      this.updateRendererInteractionState();
    };

    const onAfterCommit = () => {
      // After Enter-commit, move the active cell down one row (Excel-style behavior)
      if (this.selectionState) {
        const ac = this.selectionState.activeCell;
        if (ac) {
          const { items: currentItems } = this.state.getProcessedItems();
          const newRow = Math.min(ac.rowIndex + 1, currentItems.length - 1);
          this.selectionState.setActiveCell({ rowIndex: newRow, columnIndex: ac.columnIndex });
          const colOffset = this.renderer.getColOffset();
          const dataCol = ac.columnIndex - colOffset;
          this.selectionState.setSelectionRange({
            startRow: newRow,
            startCol: dataCol,
            endRow: newRow,
            endCol: dataCol,
          });
        }
      }
      // Re-focus the grid wrapper so keyboard nav continues working
      const wrapper = this.renderer.getWrapperElement();
      wrapper?.focus();
    };

    this.cellEditor.startEdit(rowId, columnId, item, column, cell, onCommit, onCancel, onAfterCommit);
  }

  private buildFilterConfigs(): void {
    const columns = flattenColumns(this.options.columns as unknown as Parameters<typeof flattenColumns>[0]);
    for (const col of columns) {
      const filterable = col.filterable && typeof col.filterable === 'object' ? col.filterable : null;
      if (filterable && filterable.type) {
        this.filterConfigs.set(col.columnId, {
          columnId: col.columnId,
          filterField: (filterable as { filterField?: string }).filterField ?? col.columnId,
          filterType: filterable.type as HeaderFilterConfig['filterType'],
        });
      }
    }
  }

  private handleFilterIconClick(columnId: string, headerEl: HTMLElement): void {
    const config = this.filterConfigs.get(columnId);
    if (!config) return;

    if (this.headerFilterState.openColumnId === columnId) {
      this.headerFilterState.close();
      return;
    }

    // Create a temporary popover element to pass to HeaderFilterState
    const tempPopover = document.createElement('div');
    this.headerFilterState.setFilters(this.state.filters);
    this.headerFilterState.setFilterOptions(this.state.filterOptions);
    this.headerFilterState.open(columnId, config, headerEl, tempPopover);
  }

  private renderHeaderFilterPopover(): void {
    const openId = this.headerFilterState.openColumnId;
    if (!openId) {
      this.headerFilterComponent.cleanup();
      return;
    }
    const config = this.filterConfigs.get(openId);
    if (!config) return;

    this.headerFilterComponent.render(config);

    // Update the popover element reference for click-outside detection
    const popoverEl = document.querySelector('.ogrid-header-filter-popover') as HTMLElement | null;
    if (popoverEl) {
      (this.headerFilterState as unknown as { _popoverEl: HTMLElement | null })._popoverEl = popoverEl;
    }
  }

  private renderSideBar(): void {
    if (!this.sideBarComponent || !this.sideBarState) return;

    const columns = this.state.columns.map(c => ({
      columnId: c.columnId,
      name: c.name,
      required: c.required === true,
    }));

    const filterableColumns = this.state.columns
      .filter(c => c.filterable && typeof c.filterable === 'object' && c.filterable.type)
      .map(c => ({
        columnId: c.columnId,
        name: c.name,
        filterField: (c.filterable as { filterField?: string }).filterField ?? c.columnId,
        filterType: (c.filterable as { type: string }).type as 'text' | 'multiSelect' | 'people' | 'date',
      }));

    this.sideBarComponent.setConfig({
      columns,
      visibleColumns: this.state.visibleColumns,
      onVisibilityChange: (columnKey, visible) => {
        const next = new Set(this.state.visibleColumns);
        if (visible) next.add(columnKey);
        else next.delete(columnKey);
        this.state.setVisibleColumns(next);
      },
      onSetVisibleColumns: (cols) => this.state.setVisibleColumns(cols),
      filterableColumns,
      filters: this.state.filters,
      onFilterChange: (key, value) => this.state.setFilter(key, value),
      filterOptions: this.state.filterOptions,
    });

    this.sideBarComponent.render();
  }

  private renderLoadingOverlay(): void {
    if (this.state.isLoading) {
      if (!this.loadingOverlay) {
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'ogrid-loading-overlay';
        this.loadingOverlay.style.position = 'absolute';
        this.loadingOverlay.style.top = '0';
        this.loadingOverlay.style.left = '0';
        this.loadingOverlay.style.right = '0';
        this.loadingOverlay.style.bottom = '0';
        this.loadingOverlay.style.display = 'flex';
        this.loadingOverlay.style.alignItems = 'center';
        this.loadingOverlay.style.justifyContent = 'center';
        this.loadingOverlay.style.background = 'var(--ogrid-loading-overlay, rgba(255, 255, 255, 0.7))';
        this.loadingOverlay.style.zIndex = '100';

        const spinner = document.createElement('div');
        spinner.className = 'ogrid-loading-spinner';
        spinner.textContent = 'Loading...';
        this.loadingOverlay.appendChild(spinner);
      }
      if (!this.tableContainer.contains(this.loadingOverlay)) {
        this.tableContainer.appendChild(this.loadingOverlay);
      }
    } else {
      if (this.loadingOverlay && this.tableContainer.contains(this.loadingOverlay)) {
        this.loadingOverlay.remove();
      }
    }
  }

  private renderAll(): void {
    // Increment layout version to trigger marching ants re-measurement
    this.layoutVersion++;

    const colOffset = this.rowSelectionState ? 1 : 0;

    // Update header filter state with current filters and options
    this.headerFilterState.setFilters(this.state.filters);
    this.headerFilterState.setFilterOptions(this.state.filterOptions);

    // Update interaction states with current data
    if (this.keyboardNavState && this.clipboardState) {
      const { items } = this.state.getProcessedItems();
      const visibleCols = this.state.visibleColumnDefs;

      this.keyboardNavState.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof this.keyboardNavState.updateParams>[0]['visibleCols'],
        colOffset,
        getRowId: this.state.getRowId,
        editable: this.options.editable,
        onCellValueChanged: this.undoRedoState?.getWrappedCallback(),
        onCopy: () => this.clipboardState?.handleCopy(),
        onCut: () => this.clipboardState?.handleCut(),
        onPaste: async () => { await this.clipboardState?.handlePaste(); },
        onUndo: () => this.undoRedoState?.undo(),
        onRedo: () => this.undoRedoState?.redo(),
        onContextMenu: (x, y) => this.showContextMenu(x, y),
        onStartEdit: (rowId, columnId) => this.startCellEdit(rowId, columnId),
        clearClipboardRanges: () => this.clipboardState?.clearClipboardRanges(),
      });

      this.clipboardState.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof this.clipboardState.updateParams>[0]['visibleCols'],
        colOffset,
        editable: this.options.editable,
        onCellValueChanged: this.undoRedoState?.getWrappedCallback(),
      });

      // Update fill handle params
      this.fillHandleState?.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof FillHandleState<T>['prototype']['updateParams']>[0]['visibleCols'],
        editable: this.options.editable,
        onCellValueChanged: this.undoRedoState?.getWrappedCallback(),
        colOffset,
        beginBatch: () => this.undoRedoState?.beginBatch(),
        endBatch: () => this.undoRedoState?.endBatch(),
      });

      // Update renderer interaction state before rendering
      this.updateRendererInteractionState();
    } else {
      this.renderer.update();
    }

    const { totalCount } = this.state.getProcessedItems();

    // Update virtual scroll with current total row count
    this.virtualScrollState?.setTotalRows(totalCount);

    this.pagination.render(totalCount);
    this.statusBar.render({ totalCount });
    this.columnChooser.render();
    this.renderSideBar();
    this.renderLoadingOverlay();
  }

  /** Subscribe to grid events. */
  on<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.on(event, handler);
  }

  /** Unsubscribe from grid events. */
  off<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.off(event, handler);
  }

  /** Clean up all event listeners and DOM. */
  destroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.renderer.destroy();
    this.pagination.destroy();
    this.statusBar.destroy();
    this.columnChooser.destroy();
    this.sideBarState?.destroy();
    this.sideBarComponent?.destroy();
    this.headerFilterState.destroy();
    this.headerFilterComponent.destroy();
    this.state.destroy();
    this.selectionState?.destroy();
    this.clipboardState?.destroy();
    this.undoRedoState?.destroy();
    this.resizeState?.destroy();
    this.fillHandleState?.destroy();
    this.rowSelectionState?.destroy();
    this.pinningState?.destroy();
    this.reorderState?.destroy();
    this.virtualScrollState?.destroy();
    this.marchingAnts?.destroy();
    this.layoutState.destroy();
    this.cellEditor?.closeEditor();
    this.contextMenu?.close();
    this.events.removeAllListeners();
    this.containerEl.remove();
  }
}
