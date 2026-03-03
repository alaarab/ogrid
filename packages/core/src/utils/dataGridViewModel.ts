/**
 * View model helpers for DataGridTable.
 * Pure TypeScript  -  no framework dependencies (React, Angular, Vue).
 * Framework packages re-export these and may add thin framework-specific wrappers.
 */

import type { ColumnFilterType, IDateFilterValue, ICellEditorProps } from '../types/columnTypes';
import type { IColumnDef } from '../types/columnTypes';
import { formatDateForDisplay, DEFAULT_DATE_FORMAT } from './dateFormatter';
import type { RowId, UserLike, IFilters, FilterValue } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { isInSelectionRange } from '../types/dataGridTypes';
import { isFilterConfig } from './ogridHelpers';
import { FormulaError } from '../formula/types';

// ---------------------------------------------------------------------------
// Header filter config
// ---------------------------------------------------------------------------

export interface HeaderFilterConfigInput {
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
}

/** Props to pass to ColumnHeaderFilter. Matches IColumnHeaderFilterProps. */
export interface HeaderFilterConfig {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  isSorted?: boolean;
  isSortedDescending?: boolean;
  onSort?: () => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  isLoadingOptions?: boolean;
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  dateValue?: IDateFilterValue;
  onDateChange?: (value: IDateFilterValue | undefined) => void;
}

/**
 * Returns ColumnHeaderFilter props from column def and grid filter/sort state.
 */
export function getHeaderFilterConfig<T>(
  col: IColumnDef<T>,
  input: HeaderFilterConfigInput
): HeaderFilterConfig {
  const filterable = isFilterConfig(col.filterable) ? col.filterable : null;
  const filterType = (filterable?.type ?? 'none') as ColumnFilterType;
  const filterField = filterable?.filterField ?? col.columnId;
  const sortable = col.sortable !== false;
  const filterValue = input.filters[filterField];

  const base = {
    columnKey: col.columnId,
    columnName: col.name,
    filterType,
    isSorted: input.sortBy === col.columnId,
    isSortedDescending: input.sortBy === col.columnId && input.sortDirection === 'desc',
    onSort: sortable ? () => input.onColumnSort(col.columnId) : undefined,
  };

  if (filterType === 'text') {
    return {
      ...base,
      textValue: filterValue?.type === 'text' ? filterValue.value : '',
      onTextChange: (v: string) =>
        input.onFilterChange(filterField, v.trim() ? { type: 'text', value: v } : undefined),
    };
  }
  if (filterType === 'people') {
    return {
      ...base,
      selectedUser: filterValue?.type === 'people' ? filterValue.value : undefined,
      onUserChange: (u: UserLike | undefined) =>
        input.onFilterChange(filterField, u ? { type: 'people', value: u } : undefined),
      peopleSearch: input.peopleSearch,
    };
  }
  if (filterType === 'multiSelect') {
    return {
      ...base,
      options: input.filterOptions[filterField] ?? [],
      isLoadingOptions: input.loadingFilterOptions[filterField] ?? false,
      selectedValues: filterValue?.type === 'multiSelect' ? filterValue.value : [],
      onFilterChange: (values: string[]) =>
        input.onFilterChange(filterField, values.length ? { type: 'multiSelect', value: values } : undefined),
    };
  }
  if (filterType === 'date') {
    return {
      ...base,
      dateValue: filterValue?.type === 'date' ? filterValue.value : undefined,
      onDateChange: (v: IDateFilterValue | undefined) =>
        input.onFilterChange(filterField, v ? { type: 'date', value: v } : undefined),
    };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Cell render descriptor
// ---------------------------------------------------------------------------

export type CellRenderMode = 'editing-inline' | 'editing-popover' | 'display';

export interface CellRenderDescriptorInput<T> {
  editingCell: { rowId: RowId; columnId: string } | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  selectionRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  cutRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  copyRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  colOffset: number;
  itemsLength?: number;
  getRowId: (item: T) => RowId;
  editable?: boolean;
  onCellValueChanged?: unknown;
  /** True while user is drag-selecting cells  -  hides fill handle during drag. */
  isDragging?: boolean;
  /** Get the formula engine's computed value for a cell (colIdx, rowIndex). */
  getFormulaValue?: (col: number, row: number) => unknown;
  /** Check if a cell has a formula at the given coordinate. */
  hasFormula?: (col: number, row: number) => boolean;
  /** Get the formula string for a cell (e.g. '=SUM(A1:A5)'). Used to populate the editor with the formula instead of the computed value. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Monotonic counter incremented on each formula recalculation  -  used for cache invalidation. */
  formulaVersion?: number;
}

export interface CellRenderDescriptor {
  mode: CellRenderMode;
  editorType?: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  value?: unknown;
  isActive: boolean;
  isInRange: boolean;
  isInCutRange: boolean;
  isInCopyRange: boolean;
  isSelectionEndCell: boolean;
  canEditAny: boolean;
  isPinned: boolean;
  pinnedSide?: 'left' | 'right';
  globalColIndex: number;
  rowId: RowId;
  rowIndex: number;
  /** Raw value for display (when mode === 'display'). UI uses col.renderCell or col.valueFormatter. */
  displayValue?: unknown;
  /** The column's declared type (text, numeric, date, boolean). */
  columnType?: 'text' | 'numeric' | 'date' | 'boolean';
}

// ---------------------------------------------------------------------------
// Descriptor cache
// ---------------------------------------------------------------------------

/**
 * Per-grid cache for cell render descriptors.
 *
 * Problem: A 50-column × 100-row grid calls getCellRenderDescriptor 5,000 times per render.
 * Most cells don't change between renders  -  only cells in the active row, selection range,
 * or editing row need recomputation. The cache skips recomputation for unchanged cells.
 *
 * Design:
 * - Keyed by (rowIndex * MAX_COL_STRIDE + colIdx) for O(1) flat-array-style access.
 * - Tracks a "volatile version" string derived from all inputs that affect per-cell output.
 * - On version match (cache hit), returns the cached descriptor without recomputing.
 * - On version mismatch (cache miss or first render), recomputes and stores the result.
 *
 * Usage: Create one instance per grid (e.g. useRef in React) and pass to getCellRenderDescriptor.
 *
 * @example
 *   const descriptorCache = useRef(new CellDescriptorCache());
 *   // In renderCellContent:
 *   getCellRenderDescriptor(item, col, rowIndex, colIdx, input, descriptorCache.current);
 */
export class CellDescriptorCache {
  /**
   * Stride used to compute a flat cache key: rowIndex * MAX_COL_STRIDE + colIdx.
   * 1024 supports grids up to 1024 columns, which covers all realistic use cases.
   * Using a power-of-2 stride lets the JS engine optimize the multiplication.
   */
  private static readonly MAX_COL_STRIDE = 1024;

  private readonly cache = new Map<number, { version: string; descriptor: CellRenderDescriptor }>();

  /** Last seen volatile version string. Used to detect when to skip per-cell version checks. */
  private lastVersion = '';

  /**
   * Compute a version string from the volatile parts of CellRenderDescriptorInput.
   * This string changes whenever any input that affects per-cell output changes.
   * Cheap to compute (simple string concat)  -  O(1) regardless of grid size.
   */
  static computeVersion<T>(input: CellRenderDescriptorInput<T>): string {
    const ec = input.editingCell;
    const ac = input.activeCell;
    const sr = input.selectionRange;
    const cr = input.cutRange;
    const cp = input.copyRange;
    return (
      (ec ? `${String(ec.rowId)}\x00${ec.columnId}` : '') +
      '\x01' +
      (ac ? `${ac.rowIndex}\x00${ac.columnIndex}` : '') +
      '\x01' +
      (sr ? `${sr.startRow}\x00${sr.startCol}\x00${sr.endRow}\x00${sr.endCol}` : '') +
      '\x01' +
      (cr ? `${cr.startRow}\x00${cr.startCol}\x00${cr.endRow}\x00${cr.endCol}` : '') +
      '\x01' +
      (cp ? `${cp.startRow}\x00${cp.startCol}\x00${cp.endRow}\x00${cp.endCol}` : '') +
      '\x01' +
      (input.isDragging ? '1' : '0') +
      '\x01' +
      (input.editable !== false ? '1' : '0') +
      '\x01' +
      (input.onCellValueChanged ? '1' : '0') +
      '\x01' +
      (input.formulaVersion ?? 0)
    );
  }

  /**
   * Get a cached descriptor or compute a new one.
   *
   * @param rowIndex - Row index in the dataset.
   * @param colIdx - Column index within the visible columns.
   * @param version - Volatile version string (from CellDescriptorCache.computeVersion).
   * @param compute - Factory function called on cache miss.
   * @returns The descriptor (cached or freshly computed).
   */
  get(
    rowIndex: number,
    colIdx: number,
    version: string,
    compute: () => CellRenderDescriptor
  ): CellRenderDescriptor {
    const key = rowIndex * CellDescriptorCache.MAX_COL_STRIDE + colIdx;
    const entry = this.cache.get(key);

    if (entry !== undefined && entry.version === version) {
      // Cache hit: volatile state is unchanged for this cell  -  return cached descriptor.
      return entry.descriptor;
    }

    // Cache miss: recompute and store.
    const descriptor = compute();
    this.cache.set(key, { version, descriptor });
    return descriptor;
  }

  /**
   * Update the last-seen version and return it.
   * Call once per render pass to track whether any volatile state changed.
   * If the version is unchanged from last render, the entire render is a no-op for all cells.
   */
  updateVersion(version: string): void {
    this.lastVersion = version;
  }

  /** The last version string set via updateVersion(). */
  get currentVersion(): string {
    return this.lastVersion;
  }

  /**
   * Clear all cached entries. Call when the grid's data changes (new items array,
   * different column count, etc.) to prevent stale cell values from being served.
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Returns a descriptor for rendering a cell. UI uses this to decide editing-inline vs editing-popover vs display
 * and to apply isActive, isInRange, etc. without duplicating the boolean logic.
 *
 * @param item - The row data object.
 * @param col - The column definition.
 * @param rowIndex - Row index in the dataset.
 * @param colIdx - Column index within the visible columns.
 * @param input - Volatile state inputs (editing cell, active cell, selection ranges, etc.).
 * @param cache - Optional descriptor cache. When provided and the volatile state is unchanged,
 *   the cached descriptor is returned without recomputation. Pass a `CellDescriptorCache`
 *   instance created once per grid (e.g. via `useRef`) and updated each render via
 *   `CellDescriptorCache.computeVersion`. This eliminates ~5,000 allocations/render on a
 *   50-col × 100-row grid when selection/editing state hasn't changed for a given cell.
 */
export function getCellRenderDescriptor<T>(
  item: T,
  col: IColumnDef<T>,
  rowIndex: number,
  colIdx: number,
  input: CellRenderDescriptorInput<T>,
  cache?: { get(rowIndex: number, colIdx: number, version: string, compute: () => CellRenderDescriptor): CellRenderDescriptor; currentVersion: string }
): CellRenderDescriptor {
  if (cache !== undefined) {
    return cache.get(rowIndex, colIdx, cache.currentVersion, () =>
      computeCellDescriptor(item, col, rowIndex, colIdx, input)
    );
  }
  return computeCellDescriptor(item, col, rowIndex, colIdx, input);
}

/**
 * Internal pure computation  -  separated so cache.get() can call it on miss
 * without the overhead of the optional cache parameter check.
 */
function computeCellDescriptor<T>(
  item: T,
  col: IColumnDef<T>,
  rowIndex: number,
  colIdx: number,
  input: CellRenderDescriptorInput<T>
): CellRenderDescriptor {
  const rowId = input.getRowId(item);
  const globalColIndex = colIdx + input.colOffset;

  const colEditable = isColumnEditable(col, item);
  const canEditInline =
    input.editable !== false &&
    colEditable &&
    !!input.onCellValueChanged &&
    typeof col.cellEditor !== 'function';
  const canEditPopup =
    input.editable !== false &&
    colEditable &&
    !!input.onCellValueChanged &&
    typeof col.cellEditor === 'function' &&
    col.cellEditorPopup !== false;
  const canEditAny = canEditInline || canEditPopup;

  const isEditing =
    input.editingCell?.rowId === rowId &&
    input.editingCell?.columnId === col.columnId;
  const isActive =
    !input.isDragging &&
    input.activeCell?.rowIndex === rowIndex &&
    input.activeCell?.columnIndex === globalColIndex;
  const isSingleCellRange =
    input.selectionRange != null &&
    input.selectionRange.startRow === input.selectionRange.endRow &&
    input.selectionRange.startCol === input.selectionRange.endCol;
  const isInRange =
    input.selectionRange != null &&
    !isSingleCellRange &&
    isInSelectionRange(input.selectionRange, rowIndex, colIdx);
  const isInCutRange =
    input.cutRange != null &&
    isInSelectionRange(input.cutRange, rowIndex, colIdx);
  const isInCopyRange =
    input.copyRange != null &&
    isInSelectionRange(input.copyRange, rowIndex, colIdx);
  const isSelectionEndCell =
    !input.isDragging &&
    input.copyRange == null &&
    input.cutRange == null &&
    input.selectionRange != null &&
    rowIndex === input.selectionRange.endRow &&
    colIdx === input.selectionRange.endCol;

  const isPinned = col.pinned != null;
  const pinnedSide = col.pinned ?? undefined;

  // Compute cell value once  -  used in editing and display branches
  const cellValue = getCellValue(item, col);

  // Resolve formula display value: if this cell has a formula, show the computed result
  const cellHasFormula = input.hasFormula?.(colIdx, rowIndex) ?? false;
  const formulaDisplay = cellHasFormula
    ? input.getFormulaValue?.(colIdx, rowIndex)
    : undefined;

  let mode: CellRenderMode = 'display';
  let editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date' | undefined;

  if (isEditing && canEditInline) {
    mode = 'editing-inline';
    if (
      col.cellEditor === 'text' ||
      col.cellEditor === 'select' ||
      col.cellEditor === 'checkbox' ||
      col.cellEditor === 'richSelect' ||
      col.cellEditor === 'date'
    ) {
      editorType = col.cellEditor;
    } else if (col.type === 'date') {
      editorType = 'date';
    } else if (col.type === 'boolean') {
      editorType = 'checkbox';
    } else {
      editorType = 'text';
    }
  } else if (isEditing && canEditPopup && typeof col.cellEditor === 'function') {
    mode = 'editing-popover';
  }

  // When editing a formula cell, show the formula string (e.g. '=SUM(A1:A5)')
  // instead of the raw cell value so users can edit the formula directly.
  const editValue = isEditing && cellHasFormula
    ? (input.getFormula?.(colIdx, rowIndex) ?? cellValue)
    : cellValue;

  return {
    mode,
    editorType,
    value: editValue,
    isActive,
    isInRange,
    isInCutRange,
    isInCopyRange,
    isSelectionEndCell,
    canEditAny,
    isPinned,
    pinnedSide,
    globalColIndex,
    rowId,
    rowIndex,
    displayValue: formulaDisplay !== undefined ? formulaDisplay : cellValue,
    columnType: col.type,
  };
}

// ---------------------------------------------------------------------------
// Cell rendering helpers
// ---------------------------------------------------------------------------

/**
 * Column def with optional framework-specific display fields.
 * Core's IColumnDef doesn't include renderCell/cellStyle; framework packages add them.
 * This interface extends IColumnDef so the helpers can safely access these optional fields
 * without requiring framework-specific imports. The `as IColumnDefWithDisplay<T>` casts
 * below are safe because the extra fields are optional and only read when present.
 */
interface IColumnDefWithDisplay<T> extends IColumnDef<T> {
  renderCell?: ((item: T) => unknown) | undefined;
  cellStyle?: Record<string, string> | ((item: T) => Record<string, string>) | undefined;
}

/**
 * Resolves display content for a cell in display mode.
 * Handles the renderCell -> valueFormatter -> String() fallback chain.
 * Returns `unknown`  -  framework packages may narrow to their own node type.
 */
export function resolveCellDisplayContent<T>(
  col: IColumnDef<T>,
  item: T,
  displayValue: unknown
): unknown {
  // Formula errors display as their error type string (e.g. "#DIV/0!")
  if (displayValue instanceof FormulaError) {
    return displayValue.toString();
  }
  const c = col as IColumnDefWithDisplay<T>;
  if (c.renderCell && typeof c.renderCell === 'function') {
    return c.renderCell(item);
  }
  if (col.valueFormatter) return col.valueFormatter(displayValue, item);
  if (displayValue == null) return null;
  if (col.type === 'date') {
    const format = col.dateFormat ?? DEFAULT_DATE_FORMAT;
    const formatted = formatDateForDisplay(displayValue, format);
    if (formatted !== null) return formatted;
  }
  if (col.type === 'boolean') {
    return displayValue ? 'True' : 'False';
  }
  return String(displayValue);
}

/**
 * Resolves the cellStyle from a column def, handling both function and static values.
 * When displayValue is a FormulaError, merges red error color styling.
 */
export function resolveCellStyle<T>(
  col: IColumnDef<T>,
  item: T,
  displayValue?: unknown
): Record<string, string> | undefined {
  const c = col as IColumnDefWithDisplay<T>;
  const isError = displayValue instanceof FormulaError;
  const base = c.cellStyle ? (typeof c.cellStyle === 'function' ? c.cellStyle(item) : c.cellStyle) : undefined;
  if (isError) {
    return { ...base, color: 'var(--ogrid-formula-error-color, #d32f2f)' } as Record<string, string>;
  }
  return base;
}

/**
 * Builds props for InlineCellEditor. Shared across all UI packages.
 */
export function buildInlineEditorProps<T>(
  item: T,
  col: IColumnDef<T>,
  descriptor: CellRenderDescriptor,
  callbacks: {
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    setEditingCell: (cell: null) => void;
  }
) {
  return {
    value: descriptor.value,
    item,
    column: col,
    rowIndex: descriptor.rowIndex,
    editorType: (descriptor.editorType ?? 'text') as 'text' | 'select' | 'checkbox' | 'richSelect' | 'date',
    onCommit: (newValue: unknown) =>
      callbacks.commitCellEdit(item, col.columnId, descriptor.value, newValue, descriptor.rowIndex, descriptor.globalColIndex),
    onCancel: () => callbacks.setEditingCell(null),
  };
}

/**
 * Builds ICellEditorProps for custom popover editors. Shared across all UI packages.
 */
export function buildPopoverEditorProps<T>(
  item: T,
  col: IColumnDef<T>,
  descriptor: CellRenderDescriptor,
  pendingEditorValue: unknown,
  callbacks: {
    setPendingEditorValue: (value: unknown) => void;
    commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
    cancelPopoverEdit: () => void;
  }
): ICellEditorProps<T> {
  const oldValue = descriptor.value;
  const displayValue = pendingEditorValue !== undefined ? pendingEditorValue : oldValue;
  // Track the latest value set via onValueChange so onCommit always reads
  // the most recent value, even when called synchronously (or via setTimeout)
  // before React has re-rendered with the updated pendingEditorValue state.
  let latestValue = pendingEditorValue;
  return {
    value: displayValue,
    onValueChange: (value: unknown) => {
      latestValue = value;
      callbacks.setPendingEditorValue(value);
    },
    onCommit: () => {
      const newValue = latestValue !== undefined ? latestValue : oldValue;
      callbacks.commitCellEdit(item, col.columnId, oldValue, newValue, descriptor.rowIndex, descriptor.globalColIndex);
    },
    onCancel: callbacks.cancelPopoverEdit,
    item,
    column: col,
    cellEditorParams: col.cellEditorParams,
  };
}
