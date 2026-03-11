/**
 * @module OGrid (Vanilla JS)
 *
 * Entry point for the vanilla JS data grid. Full feature parity with the React
 * package, implemented as class-based state objects wired together by EventEmitter.
 *
 * ## Architecture
 *
 * ```
 * OGrid (orchestrator)
 * |
 * |-- GridState              Core data state (sorting, filtering, pagination, columns)
 * |     \-- EventEmitter     emits 'stateChange' --> OGrid.renderAll()
 * |
 * |-- TableRenderer          DOM rendering (<table>, <thead>, <tbody>, pinning, selection CSS)
 * |     \-- reads GridState + InteractionState to build/patch DOM
 * |
 * +-- Interaction States (created if cellSelection or editable enabled)
 * |   |-- SelectionState       Active cell + range selection + drag selection (RAF)
 * |   |-- KeyboardNavState     Arrow/Tab/Home/End/Enter/Delete key handling
 * |   |-- ClipboardState       Copy/Cut/Paste with TSV clipboard format
 * |   |-- UndoRedoState        Edit history stack with batch support
 * |   |-- FillHandleState      Drag-to-fill (Excel-style) with RAF + batch undo
 * |   |-- RowSelectionState    Checkbox row selection (single/multiple, shift-range)
 * |   |-- ColumnResizeState    Drag column borders to resize
 * |   |-- ColumnPinningState   Sticky left/right column positioning
 * |   |-- ColumnReorderState   Drag-to-reorder columns
 * |   \-- VirtualScrollState   Windowed row rendering with overscan
 * |
 * +-- Layout & Filter States (always active)
 * |   |-- TableLayoutState     ResizeObserver container measurement, column width overrides
 * |   |-- HeaderFilterState    Per-column filter popover state (text/multiSelect/date)
 * |   \-- SideBarState         Panel management (columns, filters), position (left/right)
 * |
 * +-- UI Components
 *     |-- PaginationControls   Page navigation with page size dropdown
 *     |-- StatusBar            Row count, filtered count
 *     |-- ColumnChooser        Show/hide columns dropdown in toolbar
 *     |-- SideBar              Sidebar with columns panel + filters panel
 *     |-- HeaderFilter         Positioned filter popovers per column
 *     |-- InlineCellEditor     Text/select/checkbox/date inline editors
 *     |-- ContextMenu          Right-click menu (copy/cut/paste/undo/redo/select all)
 *     \-- MarchingAntsOverlay  SVG animated copy/cut selection border
 * ```
 *
 * ## Event Flow
 *
 * Each state class owns a private EventEmitter<TEvents>. State mutations emit
 * typed events that OGrid subscribes to during construction. The general flow:
 *
 * ```
 * User action (click, keydown, drag, etc.)
 *   --> State class mutates internal state, emits event
 *     --> OGrid subscription handler fires
 *       --> updateRendererInteractionState() or renderAll()
 *         --> TableRenderer.update() rebuilds or patches DOM
 * ```
 *
 * For performance-critical paths (drag selection, fill handle, column resize),
 * state classes throttle updates via requestAnimationFrame and use cached
 * querySelectorAll results to avoid repeated DOM queries.
 *
 * ## Rendering Pipeline
 *
 * TableRenderer has two update paths:
 *   1. Full rebuild  -- renderHeader() + renderBody() when data, columns, or
 *      sorting/filtering changes (triggered by GridState 'stateChange').
 *   2. CSS-only patch -- patchSelectionClasses() when only active cell,
 *      selection range, copy/cut range, or fill handle position changed.
 *      Uses a signature-based diff (isSelectionOnlyChange) to skip DOM rebuild.
 *
 * ## Lifecycle
 *
 *   1. Constructor: build DOM layout (toolbar, body area, table container,
 *      status bar, pagination). Create GridState + TableRenderer.
 *   2. Initialize: header filters, sidebar, column pinning, row selection.
 *   3. Initial render: TableRenderer.render() creates <table>/<thead>/<tbody>.
 *   4. Interaction init: if cellSelection/editable, create SelectionState,
 *      KeyboardNavState, ClipboardState, UndoRedoState, FillHandleState,
 *      ColumnResizeState, ColumnReorderState. Attach global mouse handlers.
 *   5. Event wiring: subscribe to all state emitters. Each fires renderAll()
 *      or updateRendererInteractionState() as appropriate.
 *   6. Destroy: unsubscribe all listeners, destroy all state + components,
 *      remove container from DOM.
 *
 * ## Public API
 *
 * - `api: IJsOGridApi<T>` -- imperative grid API (setRowData, getSelectedRows,
 *   exportToCsv, scrollToRow, etc.), created by GridState.getApi() and
 *   extended by OGrid for row selection and virtual scroll methods.
 * - `on(event, handler)` / `off(event, handler)` -- external event subscription.
 * - `destroy()` -- full cleanup.
 */
import type { OGridOptions, OGridEvents, IJsOGridApi } from './types/gridTypes';
import type { FilterValue, ICellValueChangedEvent, IGridColumnState } from '@alaarab/ogrid-core';
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
import type { SelectionState } from './state/SelectionState';
import type { KeyboardNavState } from './state/KeyboardNavState';
import type { ClipboardState } from './state/ClipboardState';
import type { UndoRedoState } from './state/UndoRedoState';
import type { ColumnResizeState } from './state/ColumnResizeState';
import { TableLayoutState } from './state/TableLayoutState';
import type { FillHandleState } from './state/FillHandleState';
import { RowSelectionState } from './state/RowSelectionState';
import { ColumnPinningState } from './state/ColumnPinningState';
import type { ColumnReorderState } from './state/ColumnReorderState';
import { VirtualScrollState } from './state/VirtualScrollState';
import type { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
import type { InlineCellEditor } from './components/InlineCellEditor';
import type { ContextMenu } from './components/ContextMenu';
import { EventEmitter } from './state/EventEmitter';
import type { RowId } from '@alaarab/ogrid-core';
import {
  DEFAULT_DATE_FORMAT,
  flattenColumns,
  formatCellReference,
  getDateInputPlaceholder,
  injectGlobalStyles,
  parseUserInputDate,
} from '@alaarab/ogrid-core';
import { OGridEventWiring } from './OGridEventWiring';
import { OGridRendering } from './OGridRendering';
import type { OGridRenderingContext } from './OGridRendering';
import { FormulaEngineState } from './state/FormulaEngineState';
import { FormulaBar } from './components/FormulaBar';
import { SheetTabs } from './components/SheetTabs';

function areArraysEqual<TValue>(left: TValue[], right: TValue[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function areSortsEqual(
  left: { field: string; direction: 'asc' | 'desc' } | undefined,
  right: { field: string; direction: 'asc' | 'desc' } | undefined,
): boolean {
  return left?.field === right?.field && left?.direction === right?.direction;
}

function areFiltersEqual(
  left: Record<string, FilterValue | undefined>,
  right: Record<string, FilterValue | undefined>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sanitizeColumnWidths(
  widths: Record<string, number> | undefined,
  validColumnIds: Set<string>,
): Record<string, number> {
  if (!widths) return {};
  const nextWidths: Record<string, number> = {};
  for (const [columnId, width] of Object.entries(widths)) {
    if (!validColumnIds.has(columnId) || !Number.isFinite(width) || width <= 0) continue;
    nextWidths[columnId] = width;
  }
  return nextWidths;
}

function sanitizePinnedColumns(
  pinnedColumns: Record<string, 'left' | 'right'> | undefined,
  validColumnIds: Set<string>,
): Record<string, 'left' | 'right'> {
  if (!pinnedColumns) return {};
  const nextPinnedColumns: Record<string, 'left' | 'right'> = {};
  for (const [columnId, side] of Object.entries(pinnedColumns)) {
    if (!validColumnIds.has(columnId)) continue;
    nextPinnedColumns[columnId] = side;
  }
  return nextPinnedColumns;
}

/**
 * CSS variable definitions for light and dark themes (injected once per page).
 * Uses :where() for zero specificity  -  consumer overrides always win.
 * Dark mode: auto via prefers-color-scheme, explicit via [data-theme='dark'].
 */
const OGRID_THEME_CSS = `
.ogrid-drag-target { box-shadow: inset 0 0 0 1px var(--ogrid-accent, #0078d4); }
:where(:root) {
  --ogrid-bg: #ffffff;
  --ogrid-fg: rgba(0, 0, 0, 0.87);
  --ogrid-fg-secondary: rgba(0, 0, 0, 0.6);
  --ogrid-fg-muted: rgba(0, 0, 0, 0.5);
  --ogrid-border: rgba(0, 0, 0, 0.12);
  --ogrid-border-strong: rgba(0, 0, 0, 0.5);
  --ogrid-border-hover: rgba(0, 0, 0, 0.3);
  --ogrid-header-bg: #f5f5f5;
  --ogrid-hover-bg: rgba(0, 0, 0, 0.04);
  --ogrid-selected-row-bg: #e6f0fb;
  --ogrid-bg-selected-hover: #dae8f8;
  --ogrid-active-cell-bg: rgba(0, 0, 0, 0.02);
  --ogrid-range-bg: rgba(33, 115, 70, 0.12);
  --ogrid-accent: #0078d4;
  --ogrid-accent-dark: #005a9e;
  --ogrid-selection-color: #217346;
  --ogrid-primary: #0078d4;
  --ogrid-primary-fg: #fff;
  --ogrid-primary-hover: #106ebe;
  --ogrid-bg-subtle: #f5f5f5;
  --ogrid-bg-hover: rgba(0, 0, 0, 0.04);
  --ogrid-active-bg: rgba(0, 0, 0, 0.06);
  --ogrid-muted: rgba(0, 0, 0, 0.5);
  --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  --ogrid-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.08);
  --ogrid-pinned-shadow: rgba(0, 0, 0, 0.1);
  --ogrid-loading-overlay: rgba(255, 255, 255, 0.7);
  --ogrid-selection: #217346;
  --ogrid-bg-range: rgba(33, 115, 70, 0.12);
  --ogrid-bg-selected: #e6f0fb;
  --ogrid-loading-bg: rgba(255, 255, 255, 0.7);
}
@media (prefers-color-scheme: dark) {
  :where(:root:not([data-theme="light"])) {
    --ogrid-bg: #1e1e1e;
    --ogrid-fg: rgba(255, 255, 255, 0.87);
    --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
    --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
    --ogrid-border: rgba(255, 255, 255, 0.12);
    --ogrid-border-strong: rgba(255, 255, 255, 0.5);
    --ogrid-border-hover: rgba(255, 255, 255, 0.3);
    --ogrid-header-bg: #2c2c2c;
    --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
    --ogrid-selected-row-bg: #1a3a5c;
    --ogrid-bg-selected-hover: #1f3650;
    --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
    --ogrid-range-bg: rgba(46, 160, 67, 0.15);
    --ogrid-accent: #4da6ff;
    --ogrid-accent-dark: #3390e0;
    --ogrid-selection-color: #2ea043;
    --ogrid-primary: #4da6ff;
    --ogrid-primary-fg: #fff;
    --ogrid-primary-hover: #66b3ff;
    --ogrid-bg-subtle: rgba(255, 255, 255, 0.04);
    --ogrid-bg-hover: rgba(255, 255, 255, 0.08);
    --ogrid-active-bg: rgba(255, 255, 255, 0.08);
    --ogrid-muted: rgba(255, 255, 255, 0.5);
    --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    --ogrid-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.25);
    --ogrid-pinned-shadow: rgba(0, 0, 0, 0.3);
    --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
    --ogrid-selection: #2ea043;
    --ogrid-bg-range: rgba(46, 160, 67, 0.15);
    --ogrid-bg-selected: #1a3a5c;
    --ogrid-loading-bg: rgba(0, 0, 0, 0.7);
  }
}
:where([data-theme='dark']) {
  --ogrid-bg: #1e1e1e;
  --ogrid-fg: rgba(255, 255, 255, 0.87);
  --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
  --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
  --ogrid-border: rgba(255, 255, 255, 0.12);
  --ogrid-border-strong: rgba(255, 255, 255, 0.5);
  --ogrid-border-hover: rgba(255, 255, 255, 0.3);
  --ogrid-header-bg: #2c2c2c;
  --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
  --ogrid-selected-row-bg: #1a3a5c;
  --ogrid-bg-selected-hover: #1f3650;
  --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
  --ogrid-range-bg: rgba(46, 160, 67, 0.15);
  --ogrid-accent: #4da6ff;
  --ogrid-accent-dark: #3390e0;
  --ogrid-selection-color: #2ea043;
  --ogrid-primary: #4da6ff;
  --ogrid-primary-fg: #fff;
  --ogrid-primary-hover: #66b3ff;
  --ogrid-bg-subtle: rgba(255, 255, 255, 0.04);
  --ogrid-bg-hover: rgba(255, 255, 255, 0.08);
  --ogrid-active-bg: rgba(255, 255, 255, 0.08);
  --ogrid-muted: rgba(255, 255, 255, 0.5);
  --ogrid-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  --ogrid-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.25);
  --ogrid-pinned-shadow: rgba(0, 0, 0, 0.3);
  --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
  --ogrid-selection: #2ea043;
  --ogrid-bg-range: rgba(46, 160, 67, 0.15);
  --ogrid-bg-selected: #1a3a5c;
  --ogrid-loading-bg: rgba(0, 0, 0, 0.7);
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
  private formulaEngine: FormulaEngineState | null = null;
  private formulaBar: FormulaBar | null = null;
  private formulaBarContainer: HTMLElement | null = null;
  private sheetTabs: SheetTabs | null = null;
  private sheetTabsContainer: HTMLElement | null = null;
  /** Tracks the text currently displayed/edited in the formula bar. */
  private formulaBarText = '';
  /** Whether the formula bar input is currently in editing mode. */
  private formulaBarEditing = false;
  private activeSheetId: string | null = null;

  private events = new EventEmitter<OGridEvents<T>>();
  private unsubscribes: (() => void)[] = [];
  private containerEl: HTMLElement;
  private tableContainer: HTMLElement;
  private toolbarEl: HTMLElement;
  private paginationContainer: HTMLElement;
  private statusBarContainer: HTMLElement;
  private options: OGridOptions<T>;
  private isFullScreen = false;
  private fullscreenBtn: HTMLButtonElement | null = null;
  private nameBoxEl: HTMLElement | null = null;
  private lastPage = 1;
  private lastPageSize = 20;
  private lastSort: { field: string; direction: 'asc' | 'desc' } | undefined;
  private lastFilters: Record<string, FilterValue | undefined> = {};
  private lastColumnOrder: string[] = [];
  private lastPinnedColumns: Record<string, 'left' | 'right'> = {};

  // Decomposed helpers
  private renderingHelper: OGridRendering<T>;
  private eventWiringHelper: OGridEventWiring<T>;

  /** The imperative grid API (extends React's IOGridApi with JS-specific methods). */
  readonly api: IJsOGridApi<T>;

  constructor(container: HTMLElement, options: OGridOptions<T>) {
    this.options = options;
    this.activeSheetId = options.activeSheet ?? options.sheetDefs?.[0]?.id ?? null;
    this.state = new GridState<T>(options);
    this.api = this.state.getApi();
    this.eventWiringHelper = new OGridEventWiring<T>();
    this.lastPage = this.state.page;
    this.lastPageSize = this.state.pageSize;
    this.lastSort = this.state.sort;
    this.lastFilters = { ...this.state.filters };
    this.lastColumnOrder = [...this.state.columnOrder];

    // Formula engine (opt-in)
    if (options.formulas) {
      this.formulaEngine = new FormulaEngineState({
        formulas: true,
        initialFormulas: options.initialFormulas,
        onFormulaRecalc: options.onFormulaRecalc,
        formulaFunctions: options.formulaFunctions,
        namedRanges: options.namedRanges,
        sheets: options.sheets,
      });
      this.state.setFormulaEngine(this.formulaEngine);
    }

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

    // Name box (Excel-style cell reference display)  -  prepended into toolbar left side
    if (options.cellReferences) {
      this.nameBoxEl = document.createElement('div');
      this.nameBoxEl.className = 'ogrid-name-box';
      this.nameBoxEl.style.cssText = 'display:inline-flex;align-items:center;padding:0 8px;font-family:\'Consolas\',\'Courier New\',monospace;font-size:12px;border:1px solid var(--ogrid-border, rgba(0,0,0,0.12));border-radius:3px;height:24px;margin-right:8px;background:var(--ogrid-bg, #fff);min-width:40px;color:var(--ogrid-fg-secondary, rgba(0,0,0,0.6));';
      this.nameBoxEl.textContent = '\u2014';
      toolbarSpacer.appendChild(this.nameBoxEl);
    }

    // Fullscreen toggle button
    if (options.fullScreen) {
      const toolbarRight = document.createElement('div');
      toolbarRight.style.display = 'flex';
      toolbarRight.style.alignItems = 'center';
      toolbarRight.style.gap = '8px';

      this.fullscreenBtn = document.createElement('button');
      this.fullscreenBtn.type = 'button';
      this.fullscreenBtn.className = 'ogrid-fullscreen-btn';
      this.fullscreenBtn.title = 'Fullscreen';
      this.fullscreenBtn.setAttribute('aria-label', 'Fullscreen');
      this.fullscreenBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 2 14 2 14 6"/><polyline points="6 14 2 14 2 10"/><line x1="14" y1="2" x2="10" y2="6"/><line x1="2" y1="14" x2="6" y2="10"/></svg>';
      this.fullscreenBtn.addEventListener('click', () => this.toggleFullScreen());
      toolbarRight.appendChild(this.fullscreenBtn);
      this.toolbarEl.appendChild(toolbarRight);

      // ESC key to exit fullscreen
      const handleEscKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.isFullScreen) this.toggleFullScreen();
      };
      document.addEventListener('keydown', handleEscKey);
      this.unsubscribes.push(() => document.removeEventListener('keydown', handleEscKey));
    }

    this.containerEl.appendChild(this.toolbarEl);

    // Formula bar (opt-in, mounted between toolbar and body area)
    if (options.formulas) {
      this.formulaBarContainer = document.createElement('div');
      this.formulaBarContainer.className = 'ogrid-formula-bar-container';
      this.formulaBar = new FormulaBar({
        onCommit: () => this.handleFormulaBarCommit(),
        onCancel: () => this.handleFormulaBarCancel(),
        onInputChange: (text) => { this.formulaBarText = text; },
        onStartEditing: () => this.handleFormulaBarStartEditing(),
      });
      this.formulaBar.mount(this.formulaBarContainer);
      this.containerEl.appendChild(this.formulaBarContainer);
    }

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

    this.sheetTabsContainer = document.createElement('div');
    this.sheetTabsContainer.className = 'ogrid-sheet-tabs-container';
    this.containerEl.appendChild(this.sheetTabsContainer);

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

    // Seed initial container width for responsive column hiding
    if (options.responsiveColumns) {
      this.state.setContainerWidth(this.layoutState.containerWidth);
    }

    // Create sub-components
    this.renderer = new TableRenderer<T>(this.tableContainer, this.state);
    if (this.formulaEngine) {
      this.renderer.setFormulaEngine(this.formulaEngine);
    }
    this.pagination = new PaginationControls<T>(this.paginationContainer, this.state);
    this.statusBar = new StatusBar(this.statusBarContainer);
    this.columnChooser = new ColumnChooser<T>(this.toolbarEl, this.state);
    this.sheetTabs = new SheetTabs(this.sheetTabsContainer);

    // Initialize header filter state
    this.headerFilterState = new HeaderFilterState((key: string, value: FilterValue | undefined) => {
      this.state.setFilter(key, value);
    });
    this.headerFilterComponent = new HeaderFilter(this.headerFilterState);
    this.buildFilterConfigs();

    try {
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

        if (this.bodyArea) {
          if (this.sideBarState.position === 'left') {
            this.bodyArea.insertBefore(this.sideBarContainer, this.tableContainer);
          } else {
            this.bodyArea.appendChild(this.sideBarContainer);
          }
        }

        this.unsubscribes.push(
          this.sideBarState.onChange(() => {
            this.renderingHelper.renderSideBar();
          })
        );
      }

      // Initialize column pinning (always active, even without interaction)
      const flatCols = flattenColumns(options.columns as unknown as Parameters<typeof flattenColumns>[0]);
      this.pinningState = new ColumnPinningState(
        options.pinnedColumns,
        flatCols as unknown as import('@alaarab/ogrid-core').IColumnDef[]
      );
      this.bindColumnStateApi();
      this.bindSheetTabsApi();

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
          this.rowSelectionState.onRowSelectionChange((event) => {
            options.onSelectionChange?.(event);
            this.events.emit('selectionChange', event);
            this.renderingHelper.updateRendererInteractionState();
          })
        );
      }

      // Create rendering helper (uses lazy context  -  state objects populated after interaction init)
      this.renderingHelper = this.createRenderingHelper();

      // Load initial formulas before the first paint so formula cells render computed values immediately.
      if (this.formulaEngine) {
        this.formulaEngine.initialize(this.buildFormulaAccessor());
      }

      // Initial render (must happen before interaction init so wrapper DOM exists)
      this.renderer.render();

      // Initialize interaction features if enabled (default: true for cellSelection)
      const shouldEnableInteraction = options.cellSelection !== false || options.editable === true;
      if (shouldEnableInteraction) {
        const interactionOptions: OGridOptions<T> = {
          ...options,
          onCellValueChanged: (event) => this.applyCellValueChange(event),
        };
        const result = this.eventWiringHelper.initializeInteraction(
          interactionOptions,
          this.state,
          this.renderer,
          this.tableContainer,
          this.layoutState,
          this.rowSelectionState,
          this.pinningState,
          {
            updateRendererInteractionState: () => this.renderingHelper.updateRendererInteractionState(),
            renderAll: () => this.renderingHelper.renderAll(),
            updateDragAttributes: () => this.renderingHelper.updateDragAttributes(),
            clearCachedDragCells: () => this.renderingHelper.clearCachedDragCells(),
            showContextMenu: (x, y) => this.showContextMenu(x, y),
            startCellEdit: (rowId, columnId) => this.startCellEdit(rowId, columnId),
          }
        );

        // Store all created state objects
        this.selectionState = result.selectionState;
        this.keyboardNavState = result.keyboardNavState;
        this.clipboardState = result.clipboardState;
        this.undoRedoState = result.undoRedoState;
        this.resizeState = result.resizeState;
        this.fillHandleState = result.fillHandleState;
        this.reorderState = result.reorderState;
        this.marchingAnts = result.marchingAnts;
        this.cellEditor = result.cellEditor;
        this.contextMenu = result.contextMenu;
        this.unsubscribes.push(...result.unsubscribes);

        this.unsubscribes.push(
          this.resizeState.onColumnWidthChange(({ columnId, widthPx }) => {
            options.onColumnResized?.(columnId, widthPx);
            this.events.emit('columnResized', { columnId, width: widthPx });
          })
        );

        // Wire name box updates on active cell change
        if (this.nameBoxEl && this.selectionState) {
          const nameBox = this.nameBoxEl;
          const sel = this.selectionState;
          let colOffset = 0;
          if (this.rowSelectionState) colOffset++;
          if (options.showRowNumbers || options.cellReferences) colOffset++;
          this.unsubscribes.push(
            sel.onSelectionChange(({ activeCell }) => {
              if (activeCell) {
                const dataColIndex = activeCell.columnIndex - colOffset;
                const rowNumber = (this.state.page - 1) * this.state.pageSize + activeCell.rowIndex + 1;
                nameBox.textContent = formatCellReference(dataColIndex, rowNumber);
              } else {
                nameBox.textContent = '\u2014';
              }
            })
          );
        }

        // Wire formula bar updates on active cell change
        if (this.formulaBar && this.selectionState && this.formulaEngine) {
          const fBar = this.formulaBar;
          const sel = this.selectionState;
          const fEngine = this.formulaEngine;
          let colOffset = 0;
          if (this.rowSelectionState) colOffset++;
          if (options.showRowNumbers || options.cellReferences) colOffset++;
          this.unsubscribes.push(
            sel.onSelectionChange(({ activeCell }) => {
              this.formulaBarEditing = false;
              fBar.setEditing(false);
              if (activeCell) {
                const dataCol = activeCell.columnIndex - colOffset;
                const dataRow = (this.state.page - 1) * this.state.pageSize + activeCell.rowIndex;
                const cellRef = formatCellReference(dataCol, dataRow + 1);
                const formula = fEngine.getFormula(dataCol, dataRow);
                if (formula) {
                  this.formulaBarText = formula;
                  fBar.update(cellRef, formula);
                } else {
                  // Show the cell's raw value
                  const { items } = this.state.getProcessedItems();
                  const visibleCols = this.state.visibleColumnDefs;
                  const item = items[activeCell.rowIndex];
                  const col = visibleCols[dataCol];
                  const value = item && col ? String((item as Record<string, unknown>)[col.columnId] ?? '') : '';
                  this.formulaBarText = value;
                  fBar.update(cellRef, value);
                }
                const activeColumn = this.state.visibleColumnDefs[dataCol];
                fBar.setPlaceholder(this.getFormulaBarPlaceholder(activeColumn));
              } else {
                this.formulaBarText = '';
                fBar.update(null, '');
                fBar.setPlaceholder('');
              }
            })
          );
        }
      }

      // Subscribe to state changes
      this.unsubscribes.push(
        this.state.onStateChange(() => {
          this.renderingHelper.renderAll();
          this.emitGridStateEvents();
        })
      );

      // Subscribe to pinning changes
      this.lastPinnedColumns = { ...this.pinningState.pinnedColumns };
      this.unsubscribes.push(
        this.pinningState.onPinningChange(({ pinnedColumns }) => {
          this.emitPinnedColumnChanges(pinnedColumns);
          this.renderingHelper.updateRendererInteractionState();
        })
      );

      // Subscribe to header filter state changes
      this.unsubscribes.push(
        this.headerFilterState.onChange(() => {
          this.renderingHelper.renderHeaderFilterPopover();
        })
      );

      // Subscribe to layout changes for width overrides and responsive column hiding
      this.unsubscribes.push(
        this.layoutState.onLayoutChange((event) => {
          if (event.type === 'columnOverride') {
            this.renderingHelper.updateRendererInteractionState();
          }
          if (event.type === 'containerResize' && options.responsiveColumns) {
            this.state.setContainerWidth(this.layoutState.containerWidth);
          }
        })
      );

      // Initialize virtual scrolling if configured
      if (options.virtualScroll?.enabled) {
        this.virtualScrollState = new VirtualScrollState(options.virtualScroll);
        this.virtualScrollState.observeContainer(this.tableContainer);
        this.renderer.setVirtualScrollState(this.virtualScrollState);

        // Wire scroll event on the table container (vertical + horizontal)
        const handleScroll = () => {
          this.virtualScrollState?.handleScroll(this.tableContainer.scrollTop);
          this.virtualScrollState?.handleHorizontalScroll(this.tableContainer.scrollLeft);
        };
        this.tableContainer.addEventListener('scroll', handleScroll, { passive: true });
        this.unsubscribes.push(() => {
          this.tableContainer.removeEventListener('scroll', handleScroll);
        });

        // Column virtualization: observe container width
        if (options.virtualScroll?.columns) {
          this.virtualScrollState.observeContainerWidth(this.tableContainer);
        }

        // Re-render when visible range changes
        this.unsubscribes.push(
          this.virtualScrollState.onRangeChanged(() => {
            this.renderingHelper.updateRendererInteractionState();
          })
        );

        // Re-render when column range changes
        this.unsubscribes.push(
          this.virtualScrollState.onColumnRangeChanged(() => {
            this.renderingHelper.updateRendererInteractionState();
          })
        );

        // Wire scrollToRow API method
        this.api.scrollToRow = (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => {
          this.virtualScrollState?.scrollToRow(index, this.tableContainer, opts?.align);
        };
      }

      // Complete initial render (pagination, status bar, column chooser, sidebar, loading)
      this.renderingHelper.renderAll();
      this.renderSheetTabs();
    } catch (e) {
      this.destroy();
      throw e;
    }
  }

  /** Creates the OGridRenderingContext that bridges OGrid state to the rendering helper. */
  private createRenderingHelper(): OGridRendering<T> {
    const liveGetter = <V>(getter: () => V) => ({ get: getter, enumerable: true, configurable: true });
    const ctx = {
      options: this.options,
      state: this.state,
      renderer: this.renderer,
      pagination: this.pagination,
      statusBar: this.statusBar,
      columnChooser: this.columnChooser,
      layoutState: this.layoutState,
      tableContainer: this.tableContainer,
      headerFilterState: this.headerFilterState,
      headerFilterComponent: this.headerFilterComponent,
      filterConfigs: this.filterConfigs,
      setLoadingOverlay: (el: HTMLElement | null) => { this.loadingOverlay = el; },
      handleCellClick: (rowIndex: number, colIndex: number, shiftKey?: boolean) => this.handleCellClick(rowIndex, colIndex, shiftKey),
      handleCellMouseDown: (rowIndex: number, colIndex: number, e: MouseEvent) => this.handleCellMouseDown(rowIndex, colIndex, e),
      handleCellContextMenu: (rowIndex: number, colIndex: number, e: MouseEvent) => this.handleCellContextMenu(rowIndex, colIndex, e),
      startCellEdit: (rowId: RowId, columnId: string) => this.startCellEdit(rowId, columnId),
      toggleBooleanCell: (rowId: RowId, columnId: string, currentValue: boolean) => this.toggleBooleanCell(rowId, columnId, currentValue),
      showContextMenu: (x: number, y: number) => this.showContextMenu(x, y),
    } as OGridRenderingContext<T>;
    Object.defineProperties(ctx, {
      selectionState: liveGetter(() => this.selectionState),
      keyboardNavState: liveGetter(() => this.keyboardNavState),
      clipboardState: liveGetter(() => this.clipboardState),
      undoRedoState: liveGetter(() => this.undoRedoState),
      resizeState: liveGetter(() => this.resizeState),
      fillHandleState: liveGetter(() => this.fillHandleState),
      rowSelectionState: liveGetter(() => this.rowSelectionState),
      pinningState: liveGetter(() => this.pinningState),
      reorderState: liveGetter(() => this.reorderState),
      virtualScrollState: liveGetter(() => this.virtualScrollState),
      marchingAnts: liveGetter(() => this.marchingAnts),
      cellEditor: liveGetter(() => this.cellEditor),
      sideBarState: liveGetter(() => this.sideBarState),
      sideBarComponent: liveGetter(() => this.sideBarComponent),
      loadingOverlay: liveGetter(() => this.loadingOverlay),
    });
    return new OGridRendering<T>(ctx);
  }

  private handleCellClick(rowIndex: number, colIndex: number, shiftKey = false): void {
    if (!this.selectionState) return;
    const colOffset = this.getGridColumnOffset();
    const dataColIndex = colIndex - colOffset;
    if (shiftKey && this.selectionState.activeCell) {
      const anchor = this.selectionState.activeCell;
      this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex }, dataColIndex);
      this.selectionState.setSelectionRange({
        startRow: anchor.rowIndex,
        startCol: anchor.columnIndex - colOffset,
        endRow: rowIndex,
        endCol: dataColIndex,
      });
      return;
    }
    this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex }, dataColIndex);
  }

  private handleCellMouseDown(rowIndex: number, colIndex: number, e: MouseEvent): void {
    if (!this.selectionState) return;
    // Close any open editor when clicking a different cell
    if (this.formulaBarEditing) {
      this.handleFormulaBarCommit();
    }
    this.cellEditor?.closeEditor();
    if (e.shiftKey && this.selectionState.activeCell) {
      return;
    }
    e.preventDefault();
    this.selectionState.startDrag(rowIndex, colIndex, colIndex - this.getGridColumnOffset());
    // Apply drag attributes synchronously so the anchor cell styling is in place
    // before the next browser paint. startDrag() now sets pendingRange to the
    // initial single-cell range, so getDragRange() is non-null here and
    // updateDragAttributes() will correctly highlight the origin cell immediately.
    this.renderingHelper.updateDragAttributes();
  }

  private handleCellContextMenu(rowIndex: number, colIndex: number, e: MouseEvent): void {
    e.preventDefault();
    if (!this.contextMenu || !this.selectionState || !this.clipboardState || !this.undoRedoState) return;

    // Set active cell if not already set
    if (!this.selectionState.activeCell || this.selectionState.activeCell.rowIndex !== rowIndex || this.selectionState.activeCell.columnIndex !== colIndex) {
      this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex }, colIndex - this.getGridColumnOffset());
      this.renderingHelper.updateRendererInteractionState();
    }

    this.showContextMenu(e.clientX, e.clientY);
  }

  private showContextMenu(x: number, y: number): void {
    if (!this.contextMenu || !this.clipboardState || !this.undoRedoState || !this.keyboardNavState || !this.selectionState) return;

    this.contextMenu.show(
      x,
      y,
      {
        onCopy: () => this.clipboardState?.handleCopy(),
        onCut: () => this.clipboardState?.handleCut(),
        onPaste: () => void this.clipboardState?.handlePaste(),
        onSelectAll: () => {
          const { items } = this.state.getProcessedItems();
          const visibleCols = this.state.visibleColumnDefs;
          if (items.length > 0 && visibleCols.length > 0) {
            this.selectionState?.setSelectionRange({
              startRow: 0,
              startCol: 0,
              endRow: items.length - 1,
              endCol: visibleCols.length - 1,
            });
            this.renderingHelper.updateRendererInteractionState();
          }
        },
        onUndo: () => this.undoRedoState?.undo(),
        onRedo: () => this.undoRedoState?.redo(),
      },
      this.undoRedoState.canUndo,
      this.undoRedoState.canRedo,
      this.selectionState.selectionRange
    );
  }

  private applyCellValueChange(event: ICellValueChangedEvent<T>): void {
    (event.item as Record<string, unknown>)[event.columnId] = event.newValue;
    this.options.onCellValueChanged?.(event);
    this.events.emit('cellValueChanged', event);
  }

  private toggleBooleanCell(rowId: RowId, columnId: string, currentValue: boolean): void {
    const { items } = this.state.getProcessedItems();
    const rowIndex = items.findIndex((it) => this.state.getRowId(it) === rowId);
    if (rowIndex < 0) return;
    const item = items[rowIndex];
    const newValue = !currentValue;
    const wrapped = this.undoRedoState?.getWrappedCallback();
    if (wrapped) {
      wrapped({ item, columnId, oldValue: currentValue, newValue, rowIndex });
    } else {
      this.applyCellValueChange({ item, columnId, oldValue: currentValue, newValue, rowIndex });
    }
    // Boolean cells mutate the existing row object, so a full render is needed to refresh the cell DOM.
    this.renderingHelper.renderAll();
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

    const rowIndex = items.indexOf(item);
    const onCommit = (_rid: RowId, cid: string, value: unknown) => {
      // Use the already-resolved item and look up the committed column
      const col = visibleCols.find((c) => c.columnId === cid);
      if (!col) return;

      const oldValue = (item as Record<string, unknown>)[cid];
      const wrapped = this.undoRedoState?.getWrappedCallback();
      if (wrapped) {
        wrapped({
          item,
          columnId: cid,
          oldValue,
          newValue: value,
          rowIndex,
        });
      } else {
        this.applyCellValueChange({
          item,
          columnId: cid,
          oldValue,
          newValue: value,
          rowIndex,
        });
      }

      this.renderingHelper.updateRendererInteractionState();
    };

    const onCancel = () => {
      this.renderingHelper.updateRendererInteractionState();
    };

    const onAfterCommit = () => {
      // After Enter-commit, move the active cell down one row (Excel-style behavior)
      if (this.selectionState) {
        const ac = this.selectionState.activeCell;
        if (ac) {
          const { items: currentItems } = this.state.getProcessedItems();
          const newRow = Math.min(ac.rowIndex + 1, currentItems.length - 1);
          const colOffset = this.renderer.getColOffset();
          const dataCol = ac.columnIndex - colOffset;
          this.selectionState.setActiveCell({ rowIndex: newRow, columnIndex: ac.columnIndex }, dataCol);
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

    // If the cell has a formula, pass the formula string as the editor value
    // so the user edits the formula (e.g. '=SUM(A1:A5)') instead of the computed result.
    let formulaOverride: unknown;
    if (this.formulaEngine) {
      const flatCols = this.state.columns;
      const dataCol = flatCols.findIndex((c) => c.columnId === columnId);
      if (dataCol >= 0 && this.formulaEngine.hasFormula(dataCol, rowIndex)) {
        formulaOverride = this.formulaEngine.getFormula(dataCol, rowIndex);
      }
    }

    this.cellEditor.startEdit(rowId, columnId, item, column, cell, onCommit, onCancel, onAfterCommit, formulaOverride);
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

  // --- Formula bar handlers ---

  /** Build a grid data accessor for the formula engine from current state. */
  private buildFormulaAccessor(): import('@alaarab/ogrid-core').IGridDataAccessor {
    const { items } = this.state.getProcessedItems();
    const visibleCols = this.state.visibleColumnDefs;
    return {
      getCellValue: (col: number, row: number) => {
        const item = items[row];
        const colDef = visibleCols[col];
        if (!item || !colDef) return undefined;
        return (item as Record<string, unknown>)[colDef.columnId];
      },
      getRowCount: () => items.length,
      getColumnCount: () => visibleCols.length,
    };
  }

  /** Count leading non-data columns that appear inside the grid table. */
  private getGridColumnOffset(): number {
    let colOffset = 0;
    if (this.rowSelectionState) colOffset++;
    if (this.options.showRowNumbers || this.options.cellReferences) colOffset++;
    return colOffset;
  }

  private getColumnDateFormat(column: { type?: unknown; dateFormat?: unknown; cellEditorParams?: unknown } | undefined): string {
    const cellEditorParams = column?.cellEditorParams as Record<string, unknown> | undefined;
    const paramFormat = typeof cellEditorParams?.['dateFormat'] === 'string'
      ? cellEditorParams['dateFormat']
      : undefined;
    return paramFormat
      ?? (typeof column?.dateFormat === 'string' ? column.dateFormat : undefined)
      ?? DEFAULT_DATE_FORMAT;
  }

  private getFormulaBarPlaceholder(column: { type?: unknown; dateFormat?: unknown; cellEditorParams?: unknown } | undefined): string {
    if (column?.type !== 'date') return '';
    return getDateInputPlaceholder(this.getColumnDateFormat(column));
  }

  private normalizeFormulaBarValue(
    text: string,
    column: { type?: unknown; dateFormat?: unknown; cellEditorParams?: unknown } | undefined,
  ): unknown {
    if (column?.type !== 'date') {
      return text;
    }

    if (!text.trim()) {
      return '';
    }

    const parsed = parseUserInputDate(text, this.getColumnDateFormat(column));
    if (!(parsed instanceof Date)) {
      return text;
    }

    const year = parsed.getUTCFullYear().toString().padStart(4, '0');
    const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = parsed.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private handleFormulaBarCommit(): void {
    if (!this.formulaEngine || !this.selectionState) return;
    const ac = this.selectionState.activeCell;
    if (!ac) return;

    const dataCol = ac.columnIndex - this.getGridColumnOffset();
    const dataRow = (this.state.page - 1) * this.state.pageSize + ac.rowIndex;
    const text = this.formulaBarText;

    const accessor = this.buildFormulaAccessor();

    if (text.startsWith('=')) {
      // Set as formula
      this.formulaEngine.setFormula(dataCol, dataRow, text, accessor);
    } else {
      // Clear any existing formula, then write plain value
      if (this.formulaEngine.hasFormula(dataCol, dataRow)) {
        this.formulaEngine.setFormula(dataCol, dataRow, null, accessor);
      }
      const { items } = this.state.getProcessedItems();
      const visibleCols = this.state.visibleColumnDefs;
      const item = items[ac.rowIndex];
      const col = visibleCols[dataCol];
      if (item && col) {
        (item as Record<string, unknown>)[col.columnId] = this.normalizeFormulaBarValue(text, col);
      }
    }

    this.formulaBarEditing = false;
    this.formulaBar?.setEditing(false);
    this.renderingHelper.updateRendererInteractionState();
    // Re-focus the grid wrapper so keyboard nav continues
    this.renderer.getWrapperElement()?.focus();
  }

  private handleFormulaBarCancel(): void {
    // Revert the formula bar text to the active cell's current value
    if (this.selectionState?.activeCell && this.formulaEngine) {
      const ac = this.selectionState.activeCell;
      const dataCol = ac.columnIndex - this.getGridColumnOffset();
      const dataRow = (this.state.page - 1) * this.state.pageSize + ac.rowIndex;
      const formula = this.formulaEngine.getFormula(dataCol, dataRow);
      if (formula) {
        this.formulaBarText = formula;
        this.formulaBar?.update(formatCellReference(dataCol, dataRow + 1), formula);
      } else {
        const { items } = this.state.getProcessedItems();
        const visibleCols = this.state.visibleColumnDefs;
        const item = items[ac.rowIndex];
        const col = visibleCols[dataCol];
        const value = item && col ? String((item as Record<string, unknown>)[col.columnId] ?? '') : '';
        this.formulaBarText = value;
        this.formulaBar?.update(formatCellReference(dataCol, dataRow + 1), value);
      }
    }
    this.formulaBarEditing = false;
    this.formulaBar?.setEditing(false);
    // Re-focus the grid wrapper
    this.renderer.getWrapperElement()?.focus();
  }

  private handleFormulaBarStartEditing(): void {
    if (!this.selectionState?.activeCell) return;
    this.formulaBarEditing = true;
    this.formulaBar?.setEditing(true);
  }

  private bindColumnStateApi(): void {
    const baseGetColumnState = this.api.getColumnState.bind(this.api);
    const baseApplyColumnState = this.api.applyColumnState.bind(this.api);

    this.api.getColumnState = (): IGridColumnState => {
      const baseState = baseGetColumnState();
      const columnWidths = this.layoutState.getAllColumnWidths();
      const pinnedColumns = this.pinningState?.pinnedColumns ?? {};
      return {
        ...baseState,
        columnOrder: [...this.state.columnOrder],
        columnWidths: Object.keys(columnWidths).length > 0 ? { ...columnWidths } : undefined,
        pinnedColumns: Object.keys(pinnedColumns).length > 0 ? { ...pinnedColumns } : undefined,
      };
    };

    this.api.applyColumnState = (state: Partial<IGridColumnState>) => {
      baseApplyColumnState(state);
      let needsInteractionSync = false;

      const validColumnIds = new Set(this.state.columns.map((column) => column.columnId));

      if (state.columnWidths !== undefined) {
        this.layoutState.applyInitialWidths(sanitizeColumnWidths(state.columnWidths, validColumnIds));
        needsInteractionSync = true;
      }

      if (state.pinnedColumns !== undefined && this.pinningState) {
        const nextPinnedColumns = sanitizePinnedColumns(state.pinnedColumns, validColumnIds);
        const currentPinnedColumns = { ...this.pinningState.pinnedColumns };

        for (const columnId of Object.keys(currentPinnedColumns)) {
          if (nextPinnedColumns[columnId]) continue;
          this.pinningState.unpinColumn(columnId);
        }

        for (const [columnId, side] of Object.entries(nextPinnedColumns)) {
          if (currentPinnedColumns[columnId] === side) continue;
          this.pinningState.pinColumn(columnId, side);
        }
        needsInteractionSync = true;
      }

      if (needsInteractionSync) {
        this.renderingHelper.updateRendererInteractionState();
      }
    };
  }

  private bindSheetTabsApi(): void {
    this.api.getActiveSheet = () => this.activeSheetId;

    this.api.setActiveSheet = (sheetId: string) => {
      this.setActiveSheet(sheetId);
    };

    this.api.getSheetDefs = () => {
      return (this.options.sheetDefs ?? []).map((sheet) => ({ ...sheet }));
    };

    this.api.setSheetDefs = (sheetDefs, options) => {
      this.options.sheetDefs = sheetDefs.map((sheet) => ({ ...sheet }));
      if (options?.activeSheet !== undefined) {
        this.activeSheetId = options.activeSheet;
      } else if (!this.options.sheetDefs.some((sheet) => sheet.id === this.activeSheetId)) {
        this.activeSheetId = this.options.sheetDefs[0]?.id ?? null;
      }
      this.options.activeSheet = this.activeSheetId ?? undefined;
      this.renderSheetTabs();
    };
  }

  private setActiveSheet(sheetId: string): void {
    const sheetDefs = this.options.sheetDefs ?? [];
    if (!sheetDefs.some((sheet) => sheet.id === sheetId) || this.activeSheetId === sheetId) {
      return;
    }

    this.activeSheetId = sheetId;
    this.options.activeSheet = sheetId;
    this.renderSheetTabs();
    this.options.onSheetChange?.(sheetId);
    this.events.emit('sheetChange', { sheetId });
  }

  private handleSheetAdd = (): void => {
    this.options.onSheetAdd?.();
    this.events.emit('sheetAdd', {});

    if (this.options.sheetDefs?.length && !this.activeSheetId) {
      this.activeSheetId = this.options.sheetDefs[0]?.id ?? null;
      this.options.activeSheet = this.activeSheetId ?? undefined;
    }

    this.renderSheetTabs();
  };

  private renderSheetTabs(): void {
    if (!this.sheetTabs) return;

    const sheetDefs = this.options.sheetDefs ?? [];
    if (sheetDefs.length === 0) {
      this.sheetTabs.render({
        sheets: [],
        activeSheet: '',
        onSheetChange: () => {},
      });
      return;
    }

    if (!sheetDefs.some((sheet) => sheet.id === this.activeSheetId)) {
      this.activeSheetId = sheetDefs[0]?.id ?? null;
      this.options.activeSheet = this.activeSheetId ?? undefined;
    }

    if (!this.activeSheetId) {
      this.sheetTabs.render({
        sheets: [],
        activeSheet: '',
        onSheetChange: () => {},
      });
      return;
    }

    this.sheetTabs.render({
      sheets: sheetDefs,
      activeSheet: this.activeSheetId,
      onSheetChange: (sheetId) => this.setActiveSheet(sheetId),
      onSheetAdd: this.options.onSheetAdd ? this.handleSheetAdd : undefined,
    });
  }

  private emitGridStateEvents(): void {
    const page = this.state.page;
    const pageSize = this.state.pageSize;
    const sort = this.state.sort;
    const filters = { ...this.state.filters };
    const columnOrder = [...this.state.columnOrder];

    if (page !== this.lastPage) {
      this.options.onPageChange?.(page);
      this.events.emit('pageChange', { page });
      this.lastPage = page;
    }

    if (pageSize !== this.lastPageSize) {
      this.options.onPageSizeChange?.(pageSize);
      this.events.emit('pageSizeChange', { page, pageSize });
      this.lastPageSize = pageSize;
    }

    if (!areSortsEqual(sort, this.lastSort)) {
      this.events.emit('sortChange', { sort });
      this.lastSort = sort;
    }

    if (!areFiltersEqual(filters, this.lastFilters)) {
      this.events.emit('filterChange', { filters });
      this.lastFilters = filters;
    }

    if (!areArraysEqual(columnOrder, this.lastColumnOrder)) {
      this.options.onColumnOrderChange?.([...columnOrder]);
      this.events.emit('columnOrderChange', { order: [...columnOrder] });
      this.lastColumnOrder = columnOrder;
    }
  }

  private emitPinnedColumnChanges(nextPinnedColumns: Record<string, 'left' | 'right'>): void {
    const columnIds = new Set([
      ...Object.keys(this.lastPinnedColumns),
      ...Object.keys(nextPinnedColumns),
    ]);

    for (const columnId of columnIds) {
      const previousPin = this.lastPinnedColumns[columnId] ?? null;
      const nextPin = nextPinnedColumns[columnId] ?? null;
      if (previousPin === nextPin) continue;
      this.options.onColumnPinned?.(columnId, nextPin);
      this.events.emit('columnPinned', { columnId, pin: nextPin });
    }

    this.lastPinnedColumns = { ...nextPinnedColumns };
  }

  // Rendering methods delegated to OGridRendering helper:
  // - updateRendererInteractionState() -> this.renderingHelper.updateRendererInteractionState()
  // - updateDragAttributes()           -> this.renderingHelper.updateDragAttributes()
  // - renderAll()                      -> this.renderingHelper.renderAll()
  // - renderHeaderFilterPopover()      -> this.renderingHelper.renderHeaderFilterPopover()
  // - renderSideBar()                  -> this.renderingHelper.renderSideBar()
  // - renderLoadingOverlay()           -> this.renderingHelper.renderLoadingOverlay()

  /** Subscribe to grid events. */
  on<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.on(event, handler);
  }

  /** Unsubscribe from grid events. */
  off<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.off(event, handler);
  }

  /** Toggle fullscreen mode. */
  private toggleFullScreen(): void {
    this.isFullScreen = !this.isFullScreen;
    if (this.isFullScreen) {
      this.containerEl.classList.add('ogrid-fullscreen');
    } else {
      this.containerEl.classList.remove('ogrid-fullscreen');
    }
    // Update button icon + label
    if (this.fullscreenBtn) {
      this.fullscreenBtn.title = this.isFullScreen ? 'Exit fullscreen' : 'Fullscreen';
      this.fullscreenBtn.setAttribute('aria-label', this.isFullScreen ? 'Exit fullscreen' : 'Fullscreen');
      this.fullscreenBtn.innerHTML = this.isFullScreen
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 10 0 10 0 14"/><polyline points="12 6 16 6 16 2"/><line x1="0" y1="10" x2="4" y2="6"/><line x1="16" y1="6" x2="12" y2="10"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 2 14 2 14 6"/><polyline points="6 14 2 14 2 10"/><line x1="14" y1="2" x2="10" y2="6"/><line x1="2" y1="14" x2="6" y2="10"/></svg>';
    }
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
    this.formulaBar?.destroy();
    this.sheetTabs?.destroy();
    this.formulaEngine?.destroy();
    this.events.removeAllListeners();
    this.containerEl.remove();
  }
}
