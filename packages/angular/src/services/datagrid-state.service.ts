import { Injectable, signal, computed, effect, DestroyRef, inject } from '@angular/core';
import {
  flattenColumns,
  getDataGridStatusBarConfig,
  parseValue,
  computeAggregations,
  getCellValue,
  normalizeSelectionRange,
  CHECKBOX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
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

// Alias for brevity — Angular's IColumnDef extends Core's, safe cast at framework boundary
type IColumnDef<T> = IAngularColumnDef<T>;

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
  ) => void;
  cancelPopoverEdit: () => void;
  popoverAnchorEl: HTMLElement | null;
  setPopoverAnchorEl: (el: HTMLElement | null) => void;
}

export interface DataGridCellInteractionState {
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  handleCellMouseDown: (e: MouseEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  hasCellSelection: boolean;
  handleGridKeyDown: (e: KeyboardEvent) => void;
  handleFillHandleMouseDown: (e: MouseEvent) => void;
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
  setMenuPosition: (pos: { x: number; y: number } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
}

export interface DataGridViewModelState<T> {
  headerFilterInput: {
    sortBy?: string;
    sortDirection: 'asc' | 'desc';
    onColumnSort: (columnKey: string) => void;
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
  };
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  onCellError?: (error: Error) => void;
}

export interface DataGridStateResult<T> {
  layout: DataGridLayoutState<T>;
  rowSelection: DataGridRowSelectionState;
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  contextMenu: DataGridContextMenuState;
  viewModels: DataGridViewModelState<T>;
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

  // --- Input signals ---
  readonly props = signal<IOGridDataGridProps<T> | null>(null);
  readonly wrapperEl = signal<HTMLElement | null>(null);

  // --- Internal state ---
  private readonly editingCellSig = signal<{ rowId: RowId; columnId: string } | null>(null);
  private readonly pendingEditorValueSig = signal<unknown>(undefined);
  private readonly activeCellSig = signal<IActiveCell | null>(null);
  private readonly selectionRangeSig = signal<ISelectionRange | null>(null);
  private readonly isDraggingSig = signal<boolean>(false);
  private readonly contextMenuPositionSig = signal<{ x: number; y: number } | null>(null);
  private readonly internalSelectedRows = signal<Set<RowId>>(new Set());
  private readonly popoverAnchorElSig = signal<HTMLElement | null>(null);
  private readonly containerWidthSig = signal<number>(0);
  private readonly columnSizingOverridesSig = signal<Record<string, { widthPx: number }>>({});

  // Clipboard state
  private readonly cutRangeSig = signal<ISelectionRange | null>(null);
  private readonly copyRangeSig = signal<ISelectionRange | null>(null);
  private internalClipboard: string | null = null;

  // Undo/redo state
  private undoHistory: ICellValueChangedEvent<T>[][] = [];
  private redoStack: ICellValueChangedEvent<T>[][] = [];
  private batch: ICellValueChangedEvent<T>[] | null = null;
  private readonly undoLengthSig = signal<number>(0);
  private readonly redoLengthSig = signal<number>(0);

  // Fill handle state
  private fillDragStart: { startRow: number; startCol: number } | null = null;

  // Row selection
  private lastClickedRow = -1;

  // Drag selection refs
  private dragStartPos: { row: number; col: number } | null = null;
  private dragMoved = false;
  private isDraggingRef = false;
  private liveDragRange: ISelectionRange | null = null;
  private rafId = 0;
  private lastMousePos: { cx: number; cy: number } | null = null;
  private autoScrollInterval: ReturnType<typeof setInterval> | null = null;

  // ResizeObserver
  private resizeObserver: ResizeObserver | null = null;

  // --- Derived computed ---

  private readonly propsResolved = computed(() => this.props()!);

  readonly cellSelection = computed(() => {
    const p = this.props();
    return p ? p.cellSelection !== false : true;
  });

  // Undo/redo wrapped callback
  private readonly wrappedOnCellValueChanged = computed(() => {
    const p = this.props();
    const original = p?.onCellValueChanged;
    if (!original) return undefined;
    return (event: ICellValueChangedEvent<T>) => {
      if (this.batch !== null) {
        this.batch.push(event);
      } else {
        this.undoHistory = [...this.undoHistory, [event]].slice(-100);
        this.redoStack = [];
        this.undoLengthSig.set(this.undoHistory.length);
        this.redoLengthSig.set(0);
      }
      original(event);
    };
  });

  readonly flatColumnsRaw = computed(() => {
    const p = this.props();
    if (!p) return [] as IColumnDef<T>[];
    return flattenColumns(p.columns) as IColumnDef<T>[];
  });

  readonly flatColumns = computed(() => {
    const raw = this.flatColumnsRaw();
    const p = this.props();
    const pinnedColumns = p?.pinnedColumns;
    if (!pinnedColumns || Object.keys(pinnedColumns).length === 0) return raw;
    return raw.map((col) => {
      const override = pinnedColumns[col.columnId];
      if (override && col.pinned !== override) return { ...col, pinned: override };
      return col;
    });
  });

  readonly visibleCols = computed(() => {
    const p = this.props();
    if (!p) return [] as IColumnDef<T>[];
    const flatCols = this.flatColumns();
    const filtered = p.visibleColumns
      ? flatCols.filter((c) => p.visibleColumns.has(c.columnId))
      : flatCols;
    const order = p.columnOrder;
    if (!order?.length) return filtered;
    // Build index map for O(1) lookup instead of repeated O(n) indexOf
    const orderMap = new Map<string, number>();
    for (let i = 0; i < order.length; i++) {
      orderMap.set(order[i], i);
    }
    return [...filtered].sort((a, b) => {
      const ia = orderMap.get(a.columnId) ?? -1;
      const ib = orderMap.get(b.columnId) ?? -1;
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  });

  readonly visibleColumnCount = computed(() => this.visibleCols().length);
  readonly hasCheckboxCol = computed(() => (this.props()?.rowSelection ?? 'none') === 'multiple');
  readonly hasRowNumbersCol = computed(() => !!this.props()?.showRowNumbers);
  readonly specialColsCount = computed(() => (this.hasCheckboxCol() ? 1 : 0) + (this.hasRowNumbersCol() ? 1 : 0));
  readonly totalColCount = computed(() => this.visibleColumnCount() + this.specialColsCount());
  readonly colOffset = computed(() => this.specialColsCount());

  readonly rowIndexByRowId = computed(() => {
    const p = this.props();
    if (!p) return new Map<RowId, number>();
    const m = new Map<RowId, number>();
    p.items.forEach((item, idx) => m.set(p.getRowId(item), idx));
    return m;
  });

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
    return p.items.every((item) => selected.has(p.getRowId(item)));
  });

  readonly someSelected = computed(() => {
    const p = this.props();
    if (!p) return false;
    const selected = this.selectedRowIds();
    return !this.allSelected() && p.items.some((item) => selected.has(p.getRowId(item)));
  });

  readonly hasCellSelection = computed(() => this.selectionRangeSig() != null || this.activeCellSig() != null);

  readonly canUndo = computed(() => this.undoLengthSig() > 0);
  readonly canRedo = computed(() => this.redoLengthSig() > 0);

  // Table layout
  readonly minTableWidth = computed(() => {
    const checkboxW = this.hasCheckboxCol() ? CHECKBOX_COLUMN_WIDTH : 0;
    return this.visibleCols().reduce(
      (sum, c) => sum + (c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH) + CELL_PADDING,
      checkboxW,
    );
  });

  readonly desiredTableWidth = computed(() => {
    const checkboxW = this.hasCheckboxCol() ? CHECKBOX_COLUMN_WIDTH : 0;
    const overrides = this.columnSizingOverridesSig();
    return this.visibleCols().reduce((sum, c) => {
      const override = overrides[c.columnId];
      const w = override
        ? override.widthPx
        : (c.idealWidth ?? c.defaultWidth ?? c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
      return sum + Math.max(c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH, w) + CELL_PADDING;
    }, checkboxW);
  });

  readonly aggregation = computed(() => {
    const p = this.props();
    if (!p) return null;
    return computeAggregations(
      p.items,
      this.visibleCols(),
      this.cellSelection() ? this.selectionRangeSig() : null,
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
    // Setup window event listeners for cell selection drag
    // Using effect with cleanup return to ensure proper removal on destroy
    effect((onCleanup) => {
      const onMove = (e: MouseEvent) => this.onWindowMouseMove(e);
      const onUp = () => this.onWindowMouseUp();
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);

      onCleanup(() => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
      });
    });

    // Initialize column sizing overrides from initial widths
    effect(() => {
      const p = this.props();
      if (p?.initialColumnWidths) {
        const result: Record<string, { widthPx: number }> = {};
        for (const [id, width] of Object.entries(p.initialColumnWidths)) {
          result[id] = { widthPx: width };
        }
        this.columnSizingOverridesSig.set(result);
      }
    });

    // Container width measurement via ResizeObserver
    effect(() => {
      const el = this.wrapperEl();
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (!el) return;
      const measure = () => {
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const borderX =
          (parseFloat(cs.borderLeftWidth || '0') || 0) +
          (parseFloat(cs.borderRightWidth || '0') || 0);
        this.containerWidthSig.set(Math.max(0, rect.width - borderX));
      };
      this.resizeObserver = new ResizeObserver(measure);
      this.resizeObserver.observe(el);
      measure();
    });

    // Cleanup on destroy — null out refs to prevent accidental reuse after teardown
    this.destroyRef.onDestroy(() => {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
      if (this.autoScrollInterval) { clearInterval(this.autoScrollInterval); this.autoScrollInterval = null; }
      if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
    });

    // Clean up column sizing overrides for removed columns
    effect(() => {
      const colIds = new Set(this.flatColumns().map((c) => c.columnId));
      this.columnSizingOverridesSig.update((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (!colIds.has(id)) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
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

  // --- Cell editing ---

  setEditingCell(cell: { rowId: RowId; columnId: string } | null): void {
    this.editingCellSig.set(cell);
  }

  setPendingEditorValue(value: unknown): void {
    this.pendingEditorValueSig.set(value);
  }

  setActiveCell(cell: IActiveCell | null): void {
    const prev = this.activeCellSig();
    if (prev === cell) return;
    if (prev && cell && prev.rowIndex === cell.rowIndex && prev.columnIndex === cell.columnIndex) return;
    this.activeCellSig.set(cell);
  }

  setSelectionRange(range: ISelectionRange | null): void {
    const prev = this.selectionRangeSig();
    if (prev === range) return;
    if (prev && range &&
        prev.startRow === range.startRow && prev.endRow === range.endRow &&
        prev.startCol === range.startCol && prev.endCol === range.endCol) return;
    this.selectionRangeSig.set(range);
  }

  commitCellEdit(
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number,
  ): void {
    const col = this.visibleCols().find((c) => c.columnId === columnId);
    if (col) {
      const result = parseValue(newValue, oldValue, item, col);
      if (!result.valid) {
        this.editingCellSig.set(null);
        this.popoverAnchorElSig.set(null);
        this.pendingEditorValueSig.set(undefined);
        return;
      }
      newValue = result.value;
    }

    const onCellValueChanged = this.wrappedOnCellValueChanged();
    onCellValueChanged?.({ item, columnId, oldValue, newValue, rowIndex });
    this.editingCellSig.set(null);
    this.popoverAnchorElSig.set(null);
    this.pendingEditorValueSig.set(undefined);

    const p = this.props();
    if (p && rowIndex < p.items.length - 1) {
      this.setActiveCell({ rowIndex: rowIndex + 1, columnIndex: globalColIndex });
    }
  }

  cancelPopoverEdit(): void {
    this.editingCellSig.set(null);
    this.popoverAnchorElSig.set(null);
    this.pendingEditorValueSig.set(undefined);
  }

  // --- Cell selection / mouse handling ---

  handleCellMouseDown(e: MouseEvent, rowIndex: number, globalColIndex: number): void {
    if (e.button !== 0) return;
    const wrapper = this.wrapperEl();
    wrapper?.focus({ preventScroll: true });
    this.clearClipboardRanges();

    const colOffset = this.colOffset();
    if (globalColIndex < colOffset) return;
    e.preventDefault();

    const dataColIndex = globalColIndex - colOffset;
    const currentRange = this.selectionRangeSig();

    if (e.shiftKey && currentRange != null) {
      this.setSelectionRange(
        normalizeSelectionRange({
          startRow: currentRange.startRow,
          startCol: currentRange.startCol,
          endRow: rowIndex,
          endCol: dataColIndex,
        }),
      );
      this.setActiveCell({ rowIndex, columnIndex: globalColIndex });
    } else {
      this.dragStartPos = { row: rowIndex, col: dataColIndex };
      this.dragMoved = false;
      const initial: ISelectionRange = {
        startRow: rowIndex, startCol: dataColIndex,
        endRow: rowIndex, endCol: dataColIndex,
      };
      this.setSelectionRange(initial);
      this.liveDragRange = initial;
      this.setActiveCell({ rowIndex, columnIndex: globalColIndex });
      this.isDraggingRef = true;
    }
  }

  handleSelectAllCells(): void {
    const p = this.props();
    if (!p) return;
    const rowCount = p.items.length;
    const visibleColCount = this.visibleColumnCount();
    if (rowCount === 0 || visibleColCount === 0) return;
    this.setSelectionRange({
      startRow: 0, startCol: 0,
      endRow: rowCount - 1, endCol: visibleColCount - 1,
    });
    this.setActiveCell({ rowIndex: 0, columnIndex: this.colOffset() });
  }

  // --- Context menu ---

  setContextMenuPosition(pos: { x: number; y: number } | null): void {
    this.contextMenuPositionSig.set(pos);
  }

  handleCellContextMenu(e: { clientX: number; clientY: number; preventDefault?: () => void }): void {
    e.preventDefault?.();
    this.contextMenuPositionSig.set({ x: e.clientX, y: e.clientY });
  }

  closeContextMenu(): void {
    this.contextMenuPositionSig.set(null);
  }

  // --- Clipboard ---

  handleCopy(): void {
    const p = this.props();
    if (!p) return;
    const range = this.getEffectiveRange();
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const visibleCols = this.visibleCols();
    const rows: string[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const cells: string[] = [];
      for (let c = norm.startCol; c <= norm.endCol; c++) {
        if (r >= p.items.length || c >= visibleCols.length) break;
        const item = p.items[r];
        const col = visibleCols[c];
        const raw = getCellValue(item, col);
        const val = col.valueFormatter ? col.valueFormatter(raw, item) : raw;
        cells.push(
          val != null && val !== '' ? String(val).replace(/\t/g, ' ').replace(/\n/g, ' ') : '',
        );
      }
      rows.push(cells.join('\t'));
    }
    const tsv = rows.join('\r\n');
    this.internalClipboard = tsv;
    this.copyRangeSig.set(norm);
    void navigator.clipboard.writeText(tsv).catch(() => {});
  }

  handleCut(): void {
    const p = this.props();
    if (!p || this.props()?.editable === false) return;
    const range = this.getEffectiveRange();
    if (range == null || !this.wrappedOnCellValueChanged()) return;
    const norm = normalizeSelectionRange(range);
    this.cutRangeSig.set(norm);
    this.copyRangeSig.set(null);
    this.handleCopy();
    this.copyRangeSig.set(null);
  }

  async handlePaste(): Promise<void> {
    const p = this.props();
    if (!p || p.editable === false) return;
    const onCellValueChanged = this.wrappedOnCellValueChanged();
    if (!onCellValueChanged) return;

    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }
    if (!text.trim() && this.internalClipboard != null) {
      text = this.internalClipboard;
    }
    if (!text.trim()) return;

    const norm = this.getEffectiveRange();
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const visibleCols = this.visibleCols();
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);

    this.beginBatch();
    for (let r = 0; r < lines.length; r++) {
      const cells = lines[r].split('\t');
      for (let c = 0; c < cells.length; c++) {
        const targetRow = anchorRow + r;
        const targetCol = anchorCol + c;
        if (targetRow >= p.items.length || targetCol >= visibleCols.length) continue;
        const item = p.items[targetRow];
        const col = visibleCols[targetCol];
        const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
        if (!colEditable) continue;
        const rawValue = cells[c] ?? '';
        const oldValue = getCellValue(item, col);
        const result = parseValue(rawValue, oldValue, item, col);
        if (!result.valid) continue;
        onCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex: targetRow });
      }
    }

    const cutRange = this.cutRangeSig();
    if (cutRange) {
      for (let r = cutRange.startRow; r <= cutRange.endRow; r++) {
        for (let c = cutRange.startCol; c <= cutRange.endCol; c++) {
          if (r >= p.items.length || c >= visibleCols.length) continue;
          const item = p.items[r];
          const col = visibleCols[c];
          const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
          if (!colEditable) continue;
          const oldValue = getCellValue(item, col);
          const result = parseValue('', oldValue, item, col);
          if (!result.valid) continue;
          onCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex: r });
        }
      }
      this.cutRangeSig.set(null);
    }
    this.endBatch();
    this.copyRangeSig.set(null);
  }

  clearClipboardRanges(): void {
    this.copyRangeSig.set(null);
    this.cutRangeSig.set(null);
  }

  // --- Undo/Redo ---

  beginBatch(): void {
    this.batch = [];
  }

  endBatch(): void {
    const batch = this.batch;
    this.batch = null;
    if (!batch || batch.length === 0) return;
    this.undoHistory = [...this.undoHistory, batch].slice(-100);
    this.redoStack = [];
    this.undoLengthSig.set(this.undoHistory.length);
    this.redoLengthSig.set(0);
  }

  undo(): void {
    const p = this.props();
    const original = p?.onCellValueChanged;
    if (!original || this.undoHistory.length === 0) return;
    const lastBatch = this.undoHistory[this.undoHistory.length - 1];
    this.undoHistory = this.undoHistory.slice(0, -1);
    this.redoStack = [...this.redoStack, lastBatch];
    this.undoLengthSig.set(this.undoHistory.length);
    this.redoLengthSig.set(this.redoStack.length);
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      original({ ...ev, oldValue: ev.newValue, newValue: ev.oldValue });
    }
  }

  redo(): void {
    const p = this.props();
    const original = p?.onCellValueChanged;
    if (!original || this.redoStack.length === 0) return;
    const nextBatch = this.redoStack[this.redoStack.length - 1];
    this.redoStack = this.redoStack.slice(0, -1);
    this.undoHistory = [...this.undoHistory, nextBatch];
    this.redoLengthSig.set(this.redoStack.length);
    this.undoLengthSig.set(this.undoHistory.length);
    for (const ev of nextBatch) {
      original(ev);
    }
  }

  // --- Keyboard navigation ---

  handleGridKeyDown(e: KeyboardEvent): void {
    const p = this.props();
    if (!p) return;
    const { items, getRowId } = p;
    const visibleCols = this.visibleCols();
    const colOffset = this.colOffset();
    const hasCheckboxCol = this.hasCheckboxCol();
    const visibleColumnCount = this.visibleColumnCount();
    const activeCell = this.activeCellSig();
    const selectionRange = this.selectionRangeSig();
    const editingCell = this.editingCellSig();
    const selectedRowIds = this.selectedRowIds();
    const editable = p.editable;
    const onCellValueChanged = this.wrappedOnCellValueChanged();
    const rowSelection = p.rowSelection ?? 'none';

    const maxRowIndex = items.length - 1;
    const maxColIndex = visibleColumnCount - 1 + colOffset;

    if (items.length === 0) return;

    if (activeCell === null) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key)) {
        this.setActiveCell({ rowIndex: 0, columnIndex: colOffset });
        e.preventDefault();
      }
      return;
    }

    const { rowIndex, columnIndex } = activeCell;
    const dataColIndex = columnIndex - colOffset;
    const shift = e.shiftKey;
    const ctrl = e.ctrlKey || e.metaKey;

    const isEmptyAt = (r: number, c: number): boolean => {
      if (r < 0 || r >= items.length || c < 0 || c >= visibleCols.length) return true;
      const v = getCellValue(items[r], visibleCols[c]);
      return v == null || v === '';
    };

    const findCtrlTarget = (pos: number, edge: number, step: number, isEmpty: (i: number) => boolean): number => {
      if (pos === edge) return pos;
      const next = pos + step;
      if (!isEmpty(pos) && !isEmpty(next)) {
        let p = next;
        while (p !== edge) {
          if (isEmpty(p + step)) return p;
          p += step;
        }
        return edge;
      }
      let pp = next;
      while (pp !== edge) {
        if (!isEmpty(pp)) return pp;
        pp += step;
      }
      return edge;
    };

    switch (e.key) {
      case 'c':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          this.handleCopy();
        }
        break;
      case 'x':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          this.handleCut();
        }
        break;
      case 'v':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          void this.handlePaste();
        }
        break;
      case 'ArrowDown': {
        e.preventDefault();
        const newRow = ctrl
          ? findCtrlTarget(rowIndex, maxRowIndex, 1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.min(rowIndex + 1, maxRowIndex);
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRow,
            endCol: selectionRange?.endCol ?? dataColIndex,
          }));
        } else {
          this.setSelectionRange({ startRow: newRow, startCol: dataColIndex, endRow: newRow, endCol: dataColIndex });
        }
        this.setActiveCell({ rowIndex: newRow, columnIndex });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const newRowUp = ctrl
          ? findCtrlTarget(rowIndex, 0, -1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.max(rowIndex - 1, 0);
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRowUp,
            endCol: selectionRange?.endCol ?? dataColIndex,
          }));
        } else {
          this.setSelectionRange({ startRow: newRowUp, startCol: dataColIndex, endRow: newRowUp, endCol: dataColIndex });
        }
        this.setActiveCell({ rowIndex: newRowUp, columnIndex });
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        let newCol: number;
        if (ctrl && dataColIndex >= 0) {
          newCol = findCtrlTarget(dataColIndex, visibleCols.length - 1, 1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
        } else {
          newCol = Math.min(columnIndex + 1, maxColIndex);
        }
        const newDataCol = newCol - colOffset;
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: selectionRange?.endRow ?? rowIndex,
            endCol: newDataCol,
          }));
        } else {
          this.setSelectionRange({ startRow: rowIndex, startCol: newDataCol, endRow: rowIndex, endCol: newDataCol });
        }
        this.setActiveCell({ rowIndex, columnIndex: newCol });
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        let newColLeft: number;
        if (ctrl && dataColIndex >= 0) {
          newColLeft = findCtrlTarget(dataColIndex, 0, -1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
        } else {
          newColLeft = Math.max(columnIndex - 1, colOffset);
        }
        const newDataColLeft = newColLeft - colOffset;
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: selectionRange?.endRow ?? rowIndex,
            endCol: newDataColLeft,
          }));
        } else {
          this.setSelectionRange({ startRow: rowIndex, startCol: newDataColLeft, endRow: rowIndex, endCol: newDataColLeft });
        }
        this.setActiveCell({ rowIndex, columnIndex: newColLeft });
        break;
      }
      case 'Tab': {
        e.preventDefault();
        let newRowTab = rowIndex;
        let newColTab = columnIndex;
        if (e.shiftKey) {
          if (columnIndex > colOffset) { newColTab = columnIndex - 1; }
          else if (rowIndex > 0) { newRowTab = rowIndex - 1; newColTab = maxColIndex; }
        } else {
          if (columnIndex < maxColIndex) { newColTab = columnIndex + 1; }
          else if (rowIndex < maxRowIndex) { newRowTab = rowIndex + 1; newColTab = colOffset; }
        }
        const newDataColTab = newColTab - colOffset;
        this.setSelectionRange({ startRow: newRowTab, startCol: newDataColTab, endRow: newRowTab, endCol: newDataColTab });
        this.setActiveCell({ rowIndex: newRowTab, columnIndex: newColTab });
        break;
      }
      case 'Home': {
        e.preventDefault();
        const newRowHome = ctrl ? 0 : rowIndex;
        this.setSelectionRange({ startRow: newRowHome, startCol: 0, endRow: newRowHome, endCol: 0 });
        this.setActiveCell({ rowIndex: newRowHome, columnIndex: colOffset });
        break;
      }
      case 'End': {
        e.preventDefault();
        const newRowEnd = ctrl ? maxRowIndex : rowIndex;
        this.setSelectionRange({ startRow: newRowEnd, startCol: visibleColumnCount - 1, endRow: newRowEnd, endCol: visibleColumnCount - 1 });
        this.setActiveCell({ rowIndex: newRowEnd, columnIndex: maxColIndex });
        break;
      }
      case 'Enter':
      case 'F2': {
        e.preventDefault();
        if (dataColIndex >= 0 && dataColIndex < visibleCols.length) {
          const col = visibleCols[dataColIndex];
          const item = items[rowIndex];
          if (item && col) {
            const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
            if (editable !== false && colEditable && onCellValueChanged != null) {
              this.setEditingCell({ rowId: getRowId(item), columnId: col.columnId });
            }
          }
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        if (editingCell != null) {
          this.setEditingCell(null);
        } else {
          this.clearClipboardRanges();
          this.setActiveCell(null);
          this.setSelectionRange(null);
        }
        break;
      case ' ':
        if (rowSelection !== 'none' && columnIndex === 0 && hasCheckboxCol) {
          e.preventDefault();
          const item = items[rowIndex];
          if (item) {
            const id = getRowId(item);
            const isSelected = selectedRowIds.has(id);
            this.handleRowCheckboxChange(id, !isSelected, rowIndex, e.shiftKey);
          }
        }
        break;
      case 'z':
        if (ctrl) {
          if (editingCell == null) {
            if (e.shiftKey) {
              e.preventDefault();
              this.redo();
            } else {
              e.preventDefault();
              this.undo();
            }
          }
        }
        break;
      case 'y':
        if (ctrl && editingCell == null) {
          e.preventDefault();
          this.redo();
        }
        break;
      case 'a':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          if (items.length > 0 && visibleColumnCount > 0) {
            this.setSelectionRange({ startRow: 0, startCol: 0, endRow: items.length - 1, endCol: visibleColumnCount - 1 });
            this.setActiveCell({ rowIndex: 0, columnIndex: colOffset });
          }
        }
        break;
      case 'Delete':
      case 'Backspace': {
        if (editingCell != null) break;
        if (editable === false) break;
        if (onCellValueChanged == null) break;
        const range = selectionRange ?? (activeCell != null
          ? { startRow: activeCell.rowIndex, startCol: activeCell.columnIndex - colOffset, endRow: activeCell.rowIndex, endCol: activeCell.columnIndex - colOffset }
          : null);
        if (range == null) break;
        e.preventDefault();
        const norm = normalizeSelectionRange(range);
        for (let r = norm.startRow; r <= norm.endRow; r++) {
          for (let c = norm.startCol; c <= norm.endCol; c++) {
            if (r >= items.length || c >= visibleCols.length) continue;
            const item = items[r];
            const col = visibleCols[c];
            const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
            if (!colEditable) continue;
            const oldValue = getCellValue(item, col);
            const result = parseValue('', oldValue, item, col);
            if (!result.valid) continue;
            onCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex: r });
          }
        }
        break;
      }
      case 'F10':
        if (e.shiftKey) {
          e.preventDefault();
          const wrapper = this.wrapperEl();
          if (activeCell != null && wrapper) {
            const sel = `[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.columnIndex}"]`;
            const cell = wrapper.querySelector(sel) as HTMLElement | null;
            if (cell) {
              const rect = cell.getBoundingClientRect();
              this.setContextMenuPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            } else {
              this.setContextMenuPosition({ x: 100, y: 100 });
            }
          } else {
            this.setContextMenuPosition({ x: 100, y: 100 });
          }
        }
        break;
      default:
        break;
    }
  }

  // --- Fill handle ---

  handleFillHandleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const range = this.selectionRangeSig();
    if (!range) return;
    this.fillDragStart = { startRow: range.startRow, startCol: range.startCol };
    this.setupFillHandleDrag();
  }

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
      containerWidth: this.containerWidthSig(),
      minTableWidth: this.minTableWidth(),
      desiredTableWidth: this.desiredTableWidth(),
      columnSizingOverrides: this.columnSizingOverridesSig(),
      setColumnSizingOverrides: (overrides) => this.columnSizingOverridesSig.set(overrides),
      onColumnResized: p?.onColumnResized,
    };

    const rowSelection: DataGridRowSelectionState = {
      selectedRowIds: this.selectedRowIds(),
      updateSelection: (ids) => this.updateSelection(ids),
      handleRowCheckboxChange: (rowId, checked, rowIndex, shiftKey) => this.handleRowCheckboxChange(rowId, checked, rowIndex, shiftKey),
      handleSelectAll: (checked) => this.handleSelectAll(checked),
      allSelected: this.allSelected(),
      someSelected: this.someSelected(),
    };

    const editing: DataGridEditingState<T> = {
      editingCell: this.editingCellSig(),
      setEditingCell: (cell) => this.setEditingCell(cell),
      pendingEditorValue: this.pendingEditorValueSig(),
      setPendingEditorValue: (v) => this.setPendingEditorValue(v),
      commitCellEdit: (item, colId, oldVal, newVal, rowIdx, globalColIdx) =>
        this.commitCellEdit(item, colId, oldVal, newVal, rowIdx, globalColIdx),
      cancelPopoverEdit: () => this.cancelPopoverEdit(),
      popoverAnchorEl: this.popoverAnchorElSig(),
      setPopoverAnchorEl: (el) => this.popoverAnchorElSig.set(el),
    };

    const noop = () => {};
    const noopAsync = async () => {};
    const noopMouse = (_e: MouseEvent, _r: number, _c: number) => {};
    const noopKey = (_e: KeyboardEvent) => {};
    const noopCtx = (_e: { clientX: number; clientY: number; preventDefault?: () => void }) => {};

    const interaction: DataGridCellInteractionState = {
      activeCell: cellSel ? this.activeCellSig() : null,
      setActiveCell: cellSel ? (cell) => this.setActiveCell(cell) : noop as never,
      selectionRange: cellSel ? this.selectionRangeSig() : null,
      setSelectionRange: cellSel ? (range) => this.setSelectionRange(range) : noop as never,
      handleCellMouseDown: cellSel ? (e, r, c) => this.handleCellMouseDown(e, r, c) : noopMouse,
      handleSelectAllCells: cellSel ? () => this.handleSelectAllCells() : noop,
      hasCellSelection: cellSel ? this.hasCellSelection() : false,
      handleGridKeyDown: cellSel ? (e) => this.handleGridKeyDown(e) : noopKey,
      handleFillHandleMouseDown: cellSel ? (e) => this.handleFillHandleMouseDown(e) : noop as never,
      handleCopy: cellSel ? () => this.handleCopy() : noop,
      handleCut: cellSel ? () => this.handleCut() : noop,
      handlePaste: cellSel ? () => this.handlePaste() : noopAsync,
      cutRange: cellSel ? this.cutRangeSig() : null,
      copyRange: cellSel ? this.copyRangeSig() : null,
      clearClipboardRanges: cellSel ? () => this.clearClipboardRanges() : noop,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      isDragging: cellSel ? this.isDraggingSig() : false,
    };

    const contextMenu: DataGridContextMenuState = {
      menuPosition: cellSel ? this.contextMenuPositionSig() : null,
      setMenuPosition: cellSel ? (pos) => this.setContextMenuPosition(pos) : noop as never,
      handleCellContextMenu: cellSel ? (e) => this.handleCellContextMenu(e) : noopCtx,
      closeContextMenu: cellSel ? () => this.closeContextMenu() : noop,
    };

    const viewModels: DataGridViewModelState<T> = {
      headerFilterInput: {
        sortBy: p?.sortBy,
        sortDirection: p?.sortDirection ?? 'asc',
        onColumnSort: (columnKey: string) => p?.onColumnSort(columnKey),
        filters: p?.filters ?? {},
        onFilterChange: (key, value) => p?.onFilterChange(key, value),
        filterOptions: p?.filterOptions ?? {},
        loadingFilterOptions: p?.loadingFilterOptions ?? {},
        peopleSearch: p?.peopleSearch,
      },
      cellDescriptorInput: {
        editingCell: this.editingCellSig(),
        activeCell: cellSel ? this.activeCellSig() : null,
        selectionRange: cellSel ? this.selectionRangeSig() : null,
        cutRange: cellSel ? this.cutRangeSig() : null,
        copyRange: cellSel ? this.copyRangeSig() : null,
        colOffset: this.colOffset(),
        itemsLength: p?.items.length ?? 0,
        getRowId: p?.getRowId ?? ((item: T) => (item as Record<string, unknown>)['id'] as RowId),
        editable: p?.editable,
        onCellValueChanged: this.wrappedOnCellValueChanged(),
        isDragging: cellSel ? this.isDraggingSig() : false,
      },
      statusBarConfig: this.statusBarConfig(),
      showEmptyInGrid: this.showEmptyInGrid(),
      onCellError: p?.onCellError,
    };

    return { layout, rowSelection, editing, interaction, contextMenu, viewModels };
  }

  // --- Private helpers ---

  private getEffectiveRange(): ISelectionRange | null {
    const sel = this.selectionRangeSig();
    const ac = this.activeCellSig();
    const colOffset = this.colOffset();
    return sel ?? (ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null);
  }

  private onWindowMouseMove(e: MouseEvent): void {
    if (!this.isDraggingRef || !this.dragStartPos) return;

    if (!this.dragMoved) {
      this.dragMoved = true;
      this.isDraggingSig.set(true);
    }

    this.lastMousePos = { cx: e.clientX, cy: e.clientY };

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      const pos = this.lastMousePos;
      if (!pos) return;
      const newRange = this.resolveRangeFromMouse(pos.cx, pos.cy);
      if (!newRange) return;

      const prev = this.liveDragRange;
      if (prev && prev.startRow === newRange.startRow && prev.startCol === newRange.startCol &&
          prev.endRow === newRange.endRow && prev.endCol === newRange.endCol) return;

      this.liveDragRange = newRange;
      this.applyDragAttrs(newRange);
    });
  }

  private onWindowMouseUp(): void {
    if (!this.isDraggingRef) return;

    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.isDraggingRef = false;
    const wasDrag = this.dragMoved;

    if (wasDrag) {
      const pos = this.lastMousePos;
      if (pos) {
        const flushed = this.resolveRangeFromMouse(pos.cx, pos.cy);
        if (flushed) this.liveDragRange = flushed;
      }

      const finalRange = this.liveDragRange;
      if (finalRange) {
        this.setSelectionRange(finalRange);
        this.setActiveCell({
          rowIndex: finalRange.endRow,
          columnIndex: finalRange.endCol + this.colOffset(),
        });
      }
    }

    this.clearDragAttrs();
    this.liveDragRange = null;
    this.lastMousePos = null;
    this.dragStartPos = null;
    if (wasDrag) this.isDraggingSig.set(false);
  }

  private resolveRangeFromMouse(cx: number, cy: number): ISelectionRange | null {
    if (!this.dragStartPos) return null;
    const target = document.elementFromPoint(cx, cy);
    const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
    if (!cell) return null;
    const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
    const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
    const colOff = this.colOffset();
    if (Number.isNaN(r) || Number.isNaN(c) || c < colOff) return null;
    const dataCol = c - colOff;
    const start = this.dragStartPos;
    return normalizeSelectionRange({
      startRow: start.row, startCol: start.col,
      endRow: r, endCol: dataCol,
    });
  }

  private applyDragAttrs(range: ISelectionRange): void {
    const wrapper = this.wrapperEl();
    if (!wrapper) return;
    const colOff = this.colOffset();
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      const r = parseInt(el.getAttribute('data-row-index')!, 10);
      const c = parseInt(el.getAttribute('data-col-index')!, 10) - colOff;
      const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      if (inRange) {
        if (!el.hasAttribute('data-drag-range')) el.setAttribute('data-drag-range', '');
      } else {
        if (el.hasAttribute('data-drag-range')) el.removeAttribute('data-drag-range');
      }
    }
  }

  private clearDragAttrs(): void {
    const wrapper = this.wrapperEl();
    if (!wrapper) return;
    const marked = wrapper.querySelectorAll('[data-drag-range]');
    for (let i = 0; i < marked.length; i++) marked[i].removeAttribute('data-drag-range');
  }

  private setupFillHandleDrag(): void {
    const p = this.props();
    if (!this.fillDragStart || p?.editable === false || !this.wrappedOnCellValueChanged()) return;

    const colOff = this.colOffset();
    const fillStart = this.fillDragStart;
    let fillDragEnd = { endRow: fillStart.startRow, endCol: fillStart.startCol };
    let liveFillRange: ISelectionRange | null = null;
    let fillRafId = 0;
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

    const onMove = (e: MouseEvent) => {
      lastFillMousePos = { cx: e.clientX, cy: e.clientY };
      if (fillRafId) cancelAnimationFrame(fillRafId);
      fillRafId = requestAnimationFrame(() => {
        fillRafId = 0;
        if (!lastFillMousePos) return;
        const newRange = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (!newRange) return;
        if (liveFillRange && liveFillRange.startRow === newRange.startRow &&
            liveFillRange.startCol === newRange.startCol &&
            liveFillRange.endRow === newRange.endRow &&
            liveFillRange.endCol === newRange.endCol) return;
        liveFillRange = newRange;
        fillDragEnd = { endRow: newRange.endRow, endCol: newRange.endCol };
        this.applyDragAttrs(newRange);
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);

      if (fillRafId) { cancelAnimationFrame(fillRafId); fillRafId = 0; }

      if (lastFillMousePos) {
        const flushed = resolveRange(lastFillMousePos.cx, lastFillMousePos.cy);
        if (flushed) { liveFillRange = flushed; fillDragEnd = { endRow: flushed.endRow, endCol: flushed.endCol }; }
      }

      this.clearDragAttrs();

      const norm = normalizeSelectionRange({
        startRow: fillStart.startRow, startCol: fillStart.startCol,
        endRow: fillDragEnd.endRow, endCol: fillDragEnd.endCol,
      });

      this.setSelectionRange(norm);
      this.setActiveCell({ rowIndex: fillDragEnd.endRow, columnIndex: fillDragEnd.endCol + colOff });

      // Apply fill values
      const items = p!.items;
      const visibleCols = this.visibleCols();
      const startItem = items[norm.startRow];
      const startColDef = visibleCols[norm.startCol];
      const onCellValueChanged = this.wrappedOnCellValueChanged()!;

      if (startItem && startColDef) {
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
      this.fillDragStart = null;

      // Remove event listeners after mouseup completes
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
  }
}
