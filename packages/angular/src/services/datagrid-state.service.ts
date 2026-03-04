import { Injectable, signal, computed, effect, DestroyRef, inject, NgZone } from '@angular/core';
import {
  getDataGridStatusBarConfig,
  parseValue,
  computeAggregations,
  getCellValue,
  normalizeSelectionRange,
} from '@alaarab/ogrid-core';
import type {
  RowId,
  IActiveCell,
  ISelectionRange,
  IStatusBarProps,
  IFilters,
  FilterValue,
  UserLike,
  ICellValueChangedEvent,
} from '../types';
import type { IColumnDef as IAngularColumnDef } from '../types';
import type { IColumnDef as ICoreColumnDef } from '@alaarab/ogrid-core';
import type { IOGridDataGridProps } from '../types';
import { DataGridLayoutHelper } from './datagrid-layout.service';
import { DataGridEditingHelper } from './datagrid-editing.service';
import { DataGridInteractionHelper } from './datagrid-interaction.service';

// Alias for brevity  -  Angular's IColumnDef extends Core's, safe cast at framework boundary
type IColumnDef<T> = IAngularColumnDef<T>;

// Stable no-op functions to avoid allocating new closures on every getState() call
const NOOP = () => {};
const NOOP_ASYNC = async () => {};
const NOOP_MOUSE = (_e: PointerEvent, _r: number, _c: number) => {};
const NOOP_KEY = (_e: KeyboardEvent) => {};
const NOOP_CTX = (_e: { clientX: number; clientY: number; preventDefault?: () => void }) => {};

// --- Grouped sub-interfaces (matching React) ---

export interface DataGridLayoutState<T> {
  flatColumns: IColumnDef<T>[];
  visibleCols: IColumnDef<T>[];
  visibleColumnCount: number;
  totalColCount: number;
  colOffset: number;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowIndexByRowId: Map<RowId, number>;
  containerWidth: number;
  minTableWidth: number;
  desiredTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: (overrides: Record<string, { widthPx: number }>) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  /** Called when user requests autosize for a single column (with measured width). */
  onAutosizeColumn?: (columnId: string, width: number) => void;
}

export interface DataGridRowSelectionState {
  selectedRowIds: Set<RowId>;
  updateSelection: (newSelectedIds: Set<RowId>) => void;
  handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
}

export interface DataGridEditingState<T> {
  editingCell: { rowId: RowId; columnId: string } | null;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;
  commitCellEdit: (
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number,
    options?: { skipAdvance?: boolean },
  ) => void;
  cancelPopoverEdit: () => void;
  popoverAnchorEl: HTMLElement | null;
  setPopoverAnchorEl: (el: HTMLElement | null) => void;
}

export interface DataGridCellInteractionState {
  activeCell: IActiveCell | null;
  /** Set active cell. Undefined when cell selection is disabled. */
  setActiveCell?: (cell: IActiveCell | null) => void;
  selectionRange: ISelectionRange | null;
  /** Set selection range. Undefined when cell selection is disabled. */
  setSelectionRange?: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: PointerEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  hasCellSelection: boolean;
  handleGridKeyDown: (e: KeyboardEvent) => void;
  /** Handle fill handle mouse down. Undefined when cell selection is disabled. */
  handleFillHandleMouseDown?: (e: PointerEvent) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  cutRange: ISelectionRange | null;
  copyRange: ISelectionRange | null;
  clearClipboardRanges: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isDragging: boolean;
}

export interface DataGridContextMenuState {
  menuPosition: { x: number; y: number } | null;
  /** Set menu position. Undefined when cell selection is disabled. */
  setMenuPosition?: (pos: { x: number; y: number } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
}

export interface DataGridViewModelState<T> {
  headerFilterInput: {
    sortBy?: string;
    sortDirection: 'asc' | 'desc';
    onColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
    filters: IFilters;
    onFilterChange: (key: string, value: FilterValue | undefined) => void;
    filterOptions: Record<string, string[]>;
    loadingFilterOptions: Record<string, boolean>;
    peopleSearch?: (query: string) => Promise<UserLike[]>;
  };
  cellDescriptorInput: {
    editingCell: { rowId: RowId; columnId: string } | null;
    activeCell: IActiveCell | null;
    selectionRange: ISelectionRange | null;
    cutRange: ISelectionRange | null;
    copyRange: ISelectionRange | null;
    colOffset: number;
    itemsLength: number;
    getRowId: (item: T) => RowId;
    editable?: boolean;
    onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
    isDragging: boolean;
    getFormulaValue?: (col: number, row: number) => unknown;
    hasFormula?: (col: number, row: number) => boolean;
    getFormula?: (col: number, row: number) => string | undefined;
    formulaVersion?: number;
  };
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  onCellError?: (error: Error, info: unknown) => void;
}

/** Column pinning state and column header menu. */
export interface DataGridPinningState {
  pinnedColumns: Record<string, 'left' | 'right'>;
  pinColumn: (columnId: string, side: 'left' | 'right') => void;
  unpinColumn: (columnId: string) => void;
  isPinned: (columnId: string) => 'left' | 'right' | undefined;
  headerMenu: {
    isOpen: boolean;
    openForColumn: string | null;
    anchorElement: HTMLElement | null;
    open: (columnId: string, anchorEl: HTMLElement) => void;
    close: () => void;
    handlePinLeft: () => void;
    handlePinRight: () => void;
    handleUnpin: () => void;
    canPinLeft: boolean;
    canPinRight: boolean;
    canUnpin: boolean;
  };
}

export interface DataGridStateResult<T> {
  layout: DataGridLayoutState<T>;
  rowSelection: DataGridRowSelectionState;
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  contextMenu: DataGridContextMenuState;
  viewModels: DataGridViewModelState<T>;
  pinning: DataGridPinningState;
}

/**
 * Single orchestration service for DataGridTable. Takes grid props,
 * returns all derived state and handlers so Angular UI packages can be thin view layers.
 *
 * Port of React's useDataGridState hook.
 */
@Injectable()
export class DataGridStateService<T> {
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  // --- Input signals ---
  readonly props = signal<IOGridDataGridProps<T> | null>(null);
  readonly wrapperEl = signal<HTMLElement | null>(null);

  // --- Sub-helpers (decomposed for modularity) ---
  /** Layout helper: column layout, visibility, sizing, container measurement. */
  readonly layoutHelper: DataGridLayoutHelper<T>;
  /** Editing helper: cell editing state, commit/cancel logic. */
  readonly editingHelper: DataGridEditingHelper<T>;
  /** Interaction helper: cell selection, keyboard nav, clipboard, fill handle, undo/redo. */
  readonly interactionHelper: DataGridInteractionHelper<T>;

  // --- Internal state (still owned by main service for backward compat) ---
  private readonly internalSelectedRows = signal<Set<RowId>>(new Set());

  // Row selection
  private lastClickedRow = -1;

  // Header menu state (for column pinning UI)
  private readonly headerMenuIsOpenSig = signal<boolean>(false);
  private readonly headerMenuOpenForColumnSig = signal<string | null>(null);
  private readonly headerMenuAnchorElementSig = signal<HTMLElement | null>(null);

  // --- Derived computed ---

  private readonly propsResolved = computed(() => {
    const p = this.props();
    if (!p) throw new Error('DataGridStateService: props must be set before use');
    return p;
  });

  readonly cellSelection = computed(() => {
    const p = this.props();
    return p ? p.cellSelection !== false : true;
  });

  // Narrow signal extractors  -  prevent full props() dependency in effects/computed
  private readonly originalOnCellValueChanged = computed(() => this.props()?.onCellValueChanged);

  // Undo/redo wrapped callback  -  only recomputes when the actual callback reference changes
  private readonly wrappedOnCellValueChanged = computed(() => {
    const original = this.originalOnCellValueChanged();
    if (!original) return undefined;
    return (event: ICellValueChangedEvent<T>) => {
      this.interactionHelper.undoRedoStack.record(event);
      if (!this.interactionHelper.undoRedoStack.isBatching) {
        this.interactionHelper.undoLengthSig.set(this.interactionHelper.undoRedoStack.historyLength);
        this.interactionHelper.redoLengthSig.set(this.interactionHelper.undoRedoStack.redoLength);
      }
      original(event);
    };
  });

  // --- Delegated computed signals from layoutHelper ---
  readonly flatColumnsRaw = computed(() => this.layoutHelper.flatColumnsRaw());
  readonly flatColumns = computed(() => this.layoutHelper.flatColumns());
  readonly visibleCols = computed(() => this.layoutHelper.visibleCols());
  readonly visibleColumnCount = computed(() => this.layoutHelper.visibleColumnCount());
  readonly hasCheckboxCol = computed(() => this.layoutHelper.hasCheckboxCol());
  readonly hasRowNumbersCol = computed(() => this.layoutHelper.hasRowNumbersCol());
  readonly specialColsCount = computed(() => this.layoutHelper.specialColsCount());
  readonly totalColCount = computed(() => this.layoutHelper.totalColCount());
  readonly colOffset = computed(() => this.layoutHelper.colOffset());
  readonly rowIndexByRowId = computed(() => this.layoutHelper.rowIndexByRowId());

  readonly selectedRowIds = computed(() => {
    const p = this.props();
    if (!p) return new Set<RowId>();
    const controlled = p.selectedRows;
    if (controlled != null) {
      return controlled instanceof Set ? controlled : new Set(controlled as Iterable<RowId>);
    }
    return this.internalSelectedRows();
  });

  readonly allSelected = computed(() => {
    const p = this.props();
    if (!p || p.items.length === 0) return false;
    const selected = this.selectedRowIds();
    // Fast path: if counts don't match, can't be all selected (avoids O(n) .every())
    if (selected.size !== p.items.length) return false;
    return p.items.every((item) => selected.has(p.getRowId(item)));
  });

  readonly someSelected = computed(() => {
    const p = this.props();
    if (!p) return false;
    const selected = this.selectedRowIds();
    return !this.allSelected() && p.items.some((item) => selected.has(p.getRowId(item)));
  });

  readonly hasCellSelection = computed(() => this.interactionHelper.hasCellSelection());

  readonly canUndo = computed(() => this.interactionHelper.canUndo());
  readonly canRedo = computed(() => this.interactionHelper.canRedo());

  // Table layout (delegated to layoutHelper)
  readonly minTableWidth = computed(() => this.layoutHelper.minTableWidth());
  readonly desiredTableWidth = computed(() => this.layoutHelper.desiredTableWidth());

  readonly aggregation = computed(() => {
    const p = this.props();
    if (!p) return null;
    return computeAggregations(
      p.items,
      this.visibleCols(),
      this.cellSelection() ? this.interactionHelper.selectionRangeSig() : null,
    );
  });

  readonly statusBarConfig = computed(() => {
    const p = this.props();
    if (!p) return null;
    const base = getDataGridStatusBarConfig(
      p.statusBar as boolean | IStatusBarProps | undefined,
      p.items.length,
      this.selectedRowIds().size,
    );
    if (!base) return null;
    return { ...base, aggregation: this.aggregation() ?? undefined };
  });

  readonly showEmptyInGrid = computed(() => {
    const p = this.props();
    if (!p) return false;
    return p.items.length === 0 && !!p.emptyState && !p.isLoading;
  });

  constructor() {
    // --- Instantiate sub-helpers ---
    this.layoutHelper = new DataGridLayoutHelper<T>(this.props, this.wrapperEl, this.ngZone);

    this.interactionHelper = new DataGridInteractionHelper<T>();

    this.editingHelper = new DataGridEditingHelper<T>(
      () => this.visibleCols(),
      () => this.props()?.items ?? [],
      () => this.wrappedOnCellValueChanged(),
      (cell) => this.setActiveCell(cell),
      (range) => this.setSelectionRange(range),
      () => this.colOffset(),
    );

    // Setup window event listeners for cell selection drag
    // Run outside NgZone to avoid 60Hz change detection during drag
    effect((onCleanup) => {
      const onMove = (e: PointerEvent) => this.onWindowMouseMove(e);
      const onUp = () => this.onWindowMouseUp();
      this.ngZone.runOutsideAngular(() => {
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
      });

      onCleanup(() => {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
      });
    });

    // Cleanup on destroy  -  cancel pending work and release references
    this.destroyRef.onDestroy(() => {
      this.interactionHelper.destroy();
      this.layoutHelper.destroy();
    });
  }

  // --- Row selection methods ---

  updateSelection(newSelectedIds: Set<RowId>): void {
    const p = this.props();
    if (!p) return;
    if (p.selectedRows === undefined) {
      this.internalSelectedRows.set(newSelectedIds);
    }
    p.onSelectionChange?.({
      selectedRowIds: Array.from(newSelectedIds),
      selectedItems: p.items.filter((item) => newSelectedIds.has(p.getRowId(item))),
    });
  }

  handleRowCheckboxChange(rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean): void {
    const p = this.props();
    if (!p) return;
    const rowSelection = p.rowSelection ?? 'none';
    if (rowSelection === 'single') {
      this.updateSelection(checked ? new Set([rowId]) : new Set());
      this.lastClickedRow = rowIndex;
      return;
    }

    const next = new Set(this.selectedRowIds());
    if (shiftKey && this.lastClickedRow >= 0 && this.lastClickedRow !== rowIndex) {
      const start = Math.min(this.lastClickedRow, rowIndex);
      const end = Math.max(this.lastClickedRow, rowIndex);
      for (let i = start; i <= end; i++) {
        if (i < p.items.length) {
          const id = p.getRowId(p.items[i]);
          if (checked) next.add(id);
          else next.delete(id);
        }
      }
    } else {
      if (checked) next.add(rowId);
      else next.delete(rowId);
    }
    this.lastClickedRow = rowIndex;
    this.updateSelection(next);
  }

  handleSelectAll(checked: boolean): void {
    const p = this.props();
    if (!p) return;
    if (checked) {
      this.updateSelection(new Set(p.items.map((item) => p.getRowId(item))));
    } else {
      this.updateSelection(new Set());
    }
  }

  // --- Cell editing (delegated to editingHelper) ---

  setEditingCell(cell: { rowId: RowId; columnId: string } | null): void {
    this.editingHelper.setEditingCell(cell);
  }

  setPendingEditorValue(value: unknown): void {
    this.editingHelper.setPendingEditorValue(value);
  }

  setActiveCell(cell: IActiveCell | null): void {
    this.interactionHelper.setActiveCell(cell);
  }

  setSelectionRange(range: ISelectionRange | null): void {
    this.interactionHelper.setSelectionRange(range);
  }

  commitCellEdit(
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number,
    options?: { skipAdvance?: boolean },
  ): void {
    this.editingHelper.commitCellEdit(item, columnId, oldValue, newValue, rowIndex, globalColIndex, options);
  }

  cancelPopoverEdit(): void {
    this.editingHelper.cancelPopoverEdit();
  }

  // --- Cell selection / mouse handling (delegated to interactionHelper) ---

  handleCellMouseDown(e: PointerEvent, rowIndex: number, globalColIndex: number): void {
    this.interactionHelper.handleCellMouseDown(e, rowIndex, globalColIndex, this.colOffset(), this.wrapperEl());
  }

  handleSelectAllCells(): void {
    const p = this.props();
    if (!p) return;
    this.interactionHelper.handleSelectAllCells(p.items.length, this.visibleColumnCount(), this.colOffset());
  }

  // --- Context menu (delegated to interactionHelper) ---

  setContextMenuPosition(pos: { x: number; y: number } | null): void {
    this.interactionHelper.setContextMenuPosition(pos);
  }

  handleCellContextMenu(e: { clientX: number; clientY: number; preventDefault?: () => void }): void {
    this.interactionHelper.handleCellContextMenu(e);
  }

  closeContextMenu(): void {
    this.interactionHelper.closeContextMenu();
  }

  // --- Clipboard (delegated to interactionHelper) ---

  handleCopy(): void {
    const p = this.props();
    if (!p) return;
    this.interactionHelper.handleCopy(p.items, this.visibleCols(), this.colOffset());
  }

  handleCut(): void {
    const p = this.props();
    if (!p) return;
    this.interactionHelper.handleCut(
      p.items, this.visibleCols(), this.colOffset(),
      p.editable, this.wrappedOnCellValueChanged(),
    );
  }

  async handlePaste(): Promise<void> {
    const p = this.props();
    if (!p) return;
    await this.interactionHelper.handlePaste(
      p.items, this.visibleCols(), this.colOffset(),
      p.editable, this.wrappedOnCellValueChanged(),
    );
  }

  clearClipboardRanges(): void {
    this.interactionHelper.clearClipboardRanges();
  }

  // --- Undo/Redo (delegated to interactionHelper) ---

  beginBatch(): void {
    this.interactionHelper.beginBatch();
  }

  endBatch(): void {
    this.interactionHelper.endBatch();
  }

  undo(): void {
    const p = this.props();
    this.interactionHelper.undo(p?.onCellValueChanged);
  }

  redo(): void {
    const p = this.props();
    this.interactionHelper.redo(p?.onCellValueChanged);
  }

  // --- Keyboard navigation (delegated to interactionHelper) ---

  handleGridKeyDown(e: KeyboardEvent): void {
    const p = this.props();
    if (!p) return;
    this.interactionHelper.handleGridKeyDown(
      e,
      p.items,
      p.getRowId,
      this.visibleCols(),
      this.colOffset(),
      this.hasCheckboxCol(),
      this.visibleColumnCount(),
      p.editable,
      this.wrappedOnCellValueChanged(),
      p.onCellValueChanged,
      p.rowSelection ?? 'none',
      this.selectedRowIds(),
      this.wrapperEl(),
      (rowId, checked, rowIndex, shiftKey) => this.handleRowCheckboxChange(rowId, checked, rowIndex, shiftKey),
      this.editingHelper.editingCellSig(),
      (cell) => this.setEditingCell(cell),
      p.onKeyDown,
    );
  }

  // --- Fill handle (delegated to interactionHelper + setupFillHandleDrag) ---

  handleFillHandleMouseDown(e: PointerEvent): void {
    this.interactionHelper.handleFillHandleMouseDown(e);
    this.setupFillHandleDrag();
  }

  // --- Column pinning ---

  pinColumn(columnId: string, side: 'left' | 'right'): void {
    const props = this.props();
    props?.onColumnPinned?.(columnId, side);
  }

  unpinColumn(columnId: string): void {
    const props = this.props();
    props?.onColumnPinned?.(columnId, null);
  }

  isPinned(columnId: string): 'left' | 'right' | undefined {
    const props = this.props();
    return props?.pinnedColumns?.[columnId];
  }

  getPinState(columnId: string): { canPinLeft: boolean; canPinRight: boolean; canUnpin: boolean } {
    const pinned = this.isPinned(columnId);
    return {
      canPinLeft: pinned !== 'left',
      canPinRight: pinned !== 'right',
      canUnpin: !!pinned,
    };
  }

  // --- Header menu ---

  openHeaderMenu(columnId: string, anchorEl: HTMLElement): void {
    this.headerMenuOpenForColumnSig.set(columnId);
    this.headerMenuAnchorElementSig.set(anchorEl);
    this.headerMenuIsOpenSig.set(true);
  }

  closeHeaderMenu(): void {
    this.headerMenuIsOpenSig.set(false);
    this.headerMenuOpenForColumnSig.set(null);
    this.headerMenuAnchorElementSig.set(null);
  }

  headerMenuPinLeft(): void {
    const col = this.headerMenuOpenForColumnSig();
    if (col && this.isPinned(col) !== 'left') {
      this.pinColumn(col, 'left');
      this.closeHeaderMenu();
    }
  }

  headerMenuPinRight(): void {
    const col = this.headerMenuOpenForColumnSig();
    if (col && this.isPinned(col) !== 'right') {
      this.pinColumn(col, 'right');
      this.closeHeaderMenu();
    }
  }

  headerMenuUnpin(): void {
    const col = this.headerMenuOpenForColumnSig();
    if (col && this.isPinned(col)) {
      this.unpinColumn(col);
      this.closeHeaderMenu();
    }
  }

  // --- Stable handler closures (defined once, reused in getState()) ---
  // These arrow properties ensure Angular change detection receives the same
  // function reference on every getState() call, avoiding unnecessary re-renders.

  private readonly _setColumnSizingOverrides = (overrides: Record<string, { widthPx: number }>) =>
    this.layoutHelper.columnSizingOverridesSig.set(overrides);
  private readonly _updateSelection = (ids: Set<RowId>) => this.updateSelection(ids);
  private readonly _handleRowCheckboxChange = (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) =>
    this.handleRowCheckboxChange(rowId, checked, rowIndex, shiftKey);
  private readonly _handleSelectAll = (checked: boolean) => this.handleSelectAll(checked);
  private readonly _setEditingCell = (cell: { rowId: RowId; columnId: string } | null) => this.setEditingCell(cell);
  private readonly _setPendingEditorValue = (v: unknown) => this.setPendingEditorValue(v);
  private readonly _commitCellEdit = (item: T, colId: string, oldVal: unknown, newVal: unknown, rowIdx: number, globalColIdx: number, options?: { skipAdvance?: boolean }) =>
    this.commitCellEdit(item, colId, oldVal, newVal, rowIdx, globalColIdx, options);
  private readonly _cancelPopoverEdit = () => this.cancelPopoverEdit();
  private readonly _setPopoverAnchorEl = (el: HTMLElement | null) => this.editingHelper.popoverAnchorElSig.set(el);
  private readonly _setActiveCell = (cell: IActiveCell | null) => this.setActiveCell(cell);
  private readonly _setSelectionRange = (range: ISelectionRange | null) => this.setSelectionRange(range);
  private readonly _handleCellMouseDown = (e: PointerEvent, r: number, c: number) => this.handleCellMouseDown(e, r, c);
  private readonly _handleSelectAllCells = () => this.handleSelectAllCells();
  private readonly _handleGridKeyDown = (e: KeyboardEvent) => this.handleGridKeyDown(e);
  private readonly _handleFillHandleMouseDown = (e: PointerEvent) => this.handleFillHandleMouseDown(e);
  private readonly _handleCopy = () => this.handleCopy();
  private readonly _handleCut = () => this.handleCut();
  private readonly _handlePaste = () => this.handlePaste();
  private readonly _clearClipboardRanges = () => this.clearClipboardRanges();
  private readonly _onUndo = () => this.undo();
  private readonly _onRedo = () => this.redo();
  private readonly _setContextMenuPosition = (pos: { x: number; y: number } | null) => this.setContextMenuPosition(pos);
  private readonly _handleCellContextMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }) =>
    this.handleCellContextMenu(e);
  private readonly _closeContextMenu = () => this.closeContextMenu();
  private readonly _headerFilterOnColumnSort = (columnKey: string, direction?: 'asc' | 'desc' | null) =>
    this.props()?.onColumnSort(columnKey, direction);
  private readonly _headerFilterOnFilterChange = (key: string, value: FilterValue | undefined) =>
    this.props()?.onFilterChange(key, value);
  private readonly _pinColumn = (columnId: string, side: 'left' | 'right') => this.pinColumn(columnId, side);
  private readonly _unpinColumn = (columnId: string) => this.unpinColumn(columnId);
  private readonly _isPinned = (columnId: string) => this.isPinned(columnId);
  private readonly _openHeaderMenu = (columnId: string, anchorEl: HTMLElement) => this.openHeaderMenu(columnId, anchorEl);
  private readonly _closeHeaderMenu = () => this.closeHeaderMenu();
  private readonly _headerMenuPinLeft = () => this.headerMenuPinLeft();
  private readonly _headerMenuPinRight = () => this.headerMenuPinRight();
  private readonly _headerMenuUnpin = () => this.headerMenuUnpin();

  // --- Get state result ---

  getState(): DataGridStateResult<T> {
    const p = this.props();
    const cellSel = this.cellSelection();

    const layout: DataGridLayoutState<T> = {
      flatColumns: this.flatColumns(),
      visibleCols: this.visibleCols(),
      visibleColumnCount: this.visibleColumnCount(),
      totalColCount: this.totalColCount(),
      colOffset: this.colOffset(),
      hasCheckboxCol: this.hasCheckboxCol(),
      hasRowNumbersCol: this.hasRowNumbersCol(),
      rowIndexByRowId: this.rowIndexByRowId(),
      containerWidth: this.layoutHelper.containerWidthSig(),
      minTableWidth: this.minTableWidth(),
      desiredTableWidth: this.desiredTableWidth(),
      columnSizingOverrides: this.layoutHelper.columnSizingOverridesSig(),
      setColumnSizingOverrides: this._setColumnSizingOverrides,
      onColumnResized: p?.onColumnResized,
      onAutosizeColumn: p?.onAutosizeColumn,
    };

    const rowSelection: DataGridRowSelectionState = {
      selectedRowIds: this.selectedRowIds(),
      updateSelection: this._updateSelection,
      handleRowCheckboxChange: this._handleRowCheckboxChange,
      handleSelectAll: this._handleSelectAll,
      allSelected: this.allSelected(),
      someSelected: this.someSelected(),
    };

    const editing: DataGridEditingState<T> = {
      editingCell: this.editingHelper.editingCellSig(),
      setEditingCell: this._setEditingCell,
      pendingEditorValue: this.editingHelper.pendingEditorValueSig(),
      setPendingEditorValue: this._setPendingEditorValue,
      commitCellEdit: this._commitCellEdit,
      cancelPopoverEdit: this._cancelPopoverEdit,
      popoverAnchorEl: this.editingHelper.popoverAnchorElSig(),
      setPopoverAnchorEl: this._setPopoverAnchorEl,
    };

    const interaction: DataGridCellInteractionState = {
      activeCell: cellSel ? this.interactionHelper.activeCellSig() : null,
      setActiveCell: cellSel ? this._setActiveCell : undefined,
      selectionRange: cellSel ? this.interactionHelper.selectionRangeSig() : null,
      setSelectionRange: cellSel ? this._setSelectionRange : undefined,
      handleCellMouseDown: cellSel ? this._handleCellMouseDown : NOOP_MOUSE,
      handleSelectAllCells: cellSel ? this._handleSelectAllCells : NOOP,
      hasCellSelection: cellSel ? this.hasCellSelection() : false,
      handleGridKeyDown: cellSel ? this._handleGridKeyDown : NOOP_KEY,
      handleFillHandleMouseDown: cellSel ? this._handleFillHandleMouseDown : undefined,
      handleCopy: cellSel ? this._handleCopy : NOOP,
      handleCut: cellSel ? this._handleCut : NOOP,
      handlePaste: cellSel ? this._handlePaste : NOOP_ASYNC,
      cutRange: cellSel ? this.interactionHelper.cutRangeSig() : null,
      copyRange: cellSel ? this.interactionHelper.copyRangeSig() : null,
      clearClipboardRanges: cellSel ? this._clearClipboardRanges : NOOP,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      onUndo: this._onUndo,
      onRedo: this._onRedo,
      isDragging: cellSel ? this.interactionHelper.isDraggingSig() : false,
    };

    const contextMenu: DataGridContextMenuState = {
      menuPosition: cellSel ? this.interactionHelper.contextMenuPositionSig() : null,
      setMenuPosition: cellSel ? this._setContextMenuPosition : undefined,
      handleCellContextMenu: cellSel ? this._handleCellContextMenu : NOOP_CTX,
      closeContextMenu: cellSel ? this._closeContextMenu : NOOP,
    };

    const viewModels: DataGridViewModelState<T> = {
      headerFilterInput: {
        sortBy: p?.sortBy,
        sortDirection: p?.sortDirection ?? 'asc',
        onColumnSort: this._headerFilterOnColumnSort,
        filters: p?.filters ?? {},
        onFilterChange: this._headerFilterOnFilterChange,
        filterOptions: p?.filterOptions ?? {},
        loadingFilterOptions: p?.loadingFilterOptions ?? {},
        peopleSearch: p?.peopleSearch,
      },
      cellDescriptorInput: {
        editingCell: this.editingHelper.editingCellSig(),
        activeCell: cellSel ? this.interactionHelper.activeCellSig() : null,
        selectionRange: cellSel ? this.interactionHelper.selectionRangeSig() : null,
        cutRange: cellSel ? this.interactionHelper.cutRangeSig() : null,
        copyRange: cellSel ? this.interactionHelper.copyRangeSig() : null,
        colOffset: this.colOffset(),
        itemsLength: p?.items.length ?? 0,
        getRowId: p?.getRowId ?? ((item: T) => (item as Record<string, unknown>)['id'] as RowId),
        editable: p?.editable,
        onCellValueChanged: this.wrappedOnCellValueChanged(),
        isDragging: cellSel ? this.interactionHelper.isDraggingSig() : false,
        getFormulaValue: p?.getFormulaValue,
        hasFormula: p?.hasFormula,
        getFormula: p?.getFormula,
        formulaVersion: p?.formulaVersion,
      },
      statusBarConfig: this.statusBarConfig(),
      showEmptyInGrid: this.showEmptyInGrid(),
      onCellError: p?.onCellError,
    };

    // --- Pinning ---
    const openForColumn = this.headerMenuOpenForColumnSig();
    const currentPinState = openForColumn ? (p?.pinnedColumns?.[openForColumn]) : undefined;

    const pinning: DataGridPinningState = {
      pinnedColumns: p?.pinnedColumns ?? {},
      pinColumn: this._pinColumn,
      unpinColumn: this._unpinColumn,
      isPinned: this._isPinned,
      headerMenu: {
        isOpen: this.headerMenuIsOpenSig(),
        openForColumn,
        anchorElement: this.headerMenuAnchorElementSig(),
        open: this._openHeaderMenu,
        close: this._closeHeaderMenu,
        handlePinLeft: this._headerMenuPinLeft,
        handlePinRight: this._headerMenuPinRight,
        handleUnpin: this._headerMenuUnpin,
        canPinLeft: currentPinState !== 'left',
        canPinRight: currentPinState !== 'right',
        canUnpin: !!currentPinState,
      },
    };

    return { layout, rowSelection, editing, interaction, contextMenu, viewModels, pinning };
  }

  // --- Private helpers (drag selection delegated to interactionHelper) ---

  private onWindowMouseMove(e: PointerEvent): void {
    this.interactionHelper.onWindowMouseMove(e, this.colOffset(), this.wrapperEl());
  }

  private onWindowMouseUp(): void {
    this.interactionHelper.onWindowMouseUp(this.colOffset(), this.wrapperEl());
  }

  private setupFillHandleDrag(): void {
    const p = this.props();
    const fillDragStart = this.interactionHelper.fillDragStart;
    if (!fillDragStart || p?.editable === false || !this.wrappedOnCellValueChanged()) return;

    const colOff = this.colOffset();
    const fillStart = fillDragStart;
    let fillDragEnd = { endRow: fillStart.startRow, endCol: fillStart.startCol };
    let liveFillRange: ISelectionRange | null = null;
    let lastFillMousePos: { cx: number; cy: number } | null = null;

    const resolveRange = (cx: number, cy: number): ISelectionRange | null => {
      const target = document.elementFromPoint(cx, cy) as HTMLElement | null;
      const cell = target?.closest?.('[data-row-index][data-col-index]');
      const wrapper = this.wrapperEl();
      if (!cell || !wrapper?.contains(cell)) return null;
      const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
      if (Number.isNaN(r) || Number.isNaN(c) || c < colOff) return null;
      const dataCol = c - colOff;
      return normalizeSelectionRange({
        startRow: fillStart.startRow, startCol: fillStart.startCol,
        endRow: r, endCol: dataCol,
      });
    };

    const onMove = (e: PointerEvent) => {
      lastFillMousePos = { cx: e.clientX, cy: e.clientY };
      if (this.interactionHelper.fillRafId) cancelAnimationFrame(this.interactionHelper.fillRafId);
      this.interactionHelper.fillRafId = requestAnimationFrame(() => {
        this.interactionHelper.fillRafId = 0;
        if (!lastFillMousePos) return;
        const newRange = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (!newRange) return;
        if (liveFillRange && liveFillRange.startRow === newRange.startRow &&
            liveFillRange.startCol === newRange.startCol &&
            liveFillRange.endRow === newRange.endRow &&
            liveFillRange.endCol === newRange.endCol) return;
        liveFillRange = newRange;
        fillDragEnd = { endRow: newRange.endRow, endCol: newRange.endCol };
        this.interactionHelper.applyDragAttrs(newRange, colOff, this.wrapperEl());
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      this.interactionHelper.fillMoveHandler = null;
      this.interactionHelper.fillUpHandler = null;

      if (this.interactionHelper.fillRafId) { cancelAnimationFrame(this.interactionHelper.fillRafId); this.interactionHelper.fillRafId = 0; }

      if (lastFillMousePos) {
        const flushed = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (flushed) { liveFillRange = flushed; fillDragEnd = { endRow: flushed.endRow, endCol: flushed.endCol }; }
      }

      this.interactionHelper.clearDragAttrs(this.wrapperEl());

      const norm = normalizeSelectionRange({
        startRow: fillStart.startRow, startCol: fillStart.startCol,
        endRow: fillDragEnd.endRow, endCol: fillDragEnd.endCol,
      });

      this.setSelectionRange(norm);
      this.setActiveCell({ rowIndex: fillStart.startRow, columnIndex: fillStart.startCol + colOff });

      // Apply fill values
      if (!p) return;
      const items = p.items;
      const visibleCols = this.visibleCols();
      const startItem = items[norm.startRow];
      const startColDef = visibleCols[norm.startCol];
      const onCellValueChanged = this.wrappedOnCellValueChanged();

      if (startItem && startColDef && onCellValueChanged) {
        const startValue = getCellValue(startItem, startColDef as ICoreColumnDef<T>);
        this.beginBatch();
        for (let row = norm.startRow; row <= norm.endRow; row++) {
          for (let col = norm.startCol; col <= norm.endCol; col++) {
            if (row === fillStart.startRow && col === fillStart.startCol) continue;
            if (row >= items.length || col >= visibleCols.length) continue;
            const item = items[row];
            const colDef = visibleCols[col];
            const colEditable = colDef.editable === true || (typeof colDef.editable === 'function' && colDef.editable(item));
            if (!colEditable) continue;
            const oldValue = getCellValue(item, colDef);
            const result = parseValue(startValue, oldValue, item, colDef);
            if (!result.valid) continue;
            onCellValueChanged({ item, columnId: colDef.columnId, oldValue, newValue: result.value, rowIndex: row });
          }
        }
        this.endBatch();
      }
      this.interactionHelper.fillDragStart = null;
    };

    // Track handlers for cleanup on destroy
    this.interactionHelper.fillMoveHandler = onMove;
    this.interactionHelper.fillUpHandler = onUp;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    });
  }
}
