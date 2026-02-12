/**
 * View model helpers for Angular DataGridTable. Core owns the logic; UI packages only render.
 * Ported from React's dataGridViewModel.ts to eliminate duplication in Angular Material and PrimeNG packages.
 */

import type { ColumnFilterType, IDateFilterValue } from '../types/columnTypes';
import type { IColumnDef } from '../types/columnTypes';
import type { RowId, UserLike, IFilters, FilterValue } from '../types/dataGridTypes';
import { getCellValue, isInSelectionRange } from '@alaarab/ogrid-core';

// --- Header filter config (replaces duplicated getHeaderFilterConfig in UI packages) ---

export interface HeaderFilterConfigInput {
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string) => void;
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
}

/** Props to pass to ColumnHeaderFilter. */
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
 * Use in Angular Material and PrimeNG DataGridTableComponent instead of inline logic.
 */
export function getHeaderFilterConfig<T>(
  col: IColumnDef<T>,
  input: HeaderFilterConfigInput
): HeaderFilterConfig {
  const filterable =
    col.filterable && typeof col.filterable === 'object' ? col.filterable : null;
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

// --- Cell render descriptor (replaces duplicated getCellRenderDescriptor in UI packages) ---

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
  getRowId: (item: T) => RowId;
  editable?: boolean;
  onCellValueChanged?: unknown;
  /** True while user is drag-selecting cells — hides fill handle during drag. */
  isDragging?: boolean;
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
  globalColIndex: number;
  rowId: RowId;
  rowIndex: number;
  /** Raw value for display (when mode === 'display'). */
  displayValue?: unknown;
}

/**
 * Returns a descriptor for rendering a cell. UI uses this to decide editing-inline vs editing-popover vs display
 * and to apply isActive, isInRange, etc. without duplicating the boolean logic.
 */
export function getCellRenderDescriptor<T>(
  item: T,
  col: IColumnDef<T>,
  rowIndex: number,
  colIdx: number,
  input: CellRenderDescriptorInput<T>
): CellRenderDescriptor {
  const rowId = input.getRowId(item);
  const globalColIndex = colIdx + input.colOffset;

  const colEditable =
    col.editable === true ||
    (typeof col.editable === 'function' && col.editable(item));
  const canEditInline =
    input.editable !== false &&
    !!colEditable &&
    !!input.onCellValueChanged &&
    typeof col.cellEditor !== 'function';
  const canEditPopup =
    input.editable !== false &&
    !!colEditable &&
    !!input.onCellValueChanged &&
    typeof col.cellEditor === 'function';
  const canEditAny = canEditInline || canEditPopup;

  const isEditing =
    input.editingCell?.rowId === rowId &&
    input.editingCell?.columnId === col.columnId;
  const isActive =
    input.activeCell?.rowIndex === rowIndex &&
    input.activeCell?.columnIndex === globalColIndex;
  const isInRange =
    input.selectionRange != null &&
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

  let mode: CellRenderMode = 'display';
  let editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date' | undefined;
  const value: unknown = getCellValue(item, col);

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
  } else if (isEditing && canEditPopup) {
    mode = 'editing-popover';
  }

  return {
    mode,
    editorType,
    value,
    isActive,
    isInRange,
    isInCutRange,
    isInCopyRange,
    isSelectionEndCell,
    canEditAny,
    globalColIndex,
    rowId,
    rowIndex,
    displayValue: value,
  };
}

// --- Cell rendering helpers (reduce DataGridTable view-layer duplication) ---

/**
 * Resolves display content for a cell in display mode.
 * Handles the renderCell → valueFormatter → String() fallback chain.
 */
export function resolveCellDisplayContent<T>(
  col: IColumnDef<T>,
  item: T,
  displayValue: unknown
): string {
  if (col.renderCell && typeof col.renderCell === 'function') {
    const result = (col.renderCell as (item: T) => unknown)(item);
    return result != null ? String(result) : '';
  }
  if (col.valueFormatter) return String(col.valueFormatter(displayValue, item) ?? '');
  if (displayValue == null) return '';
  if (col.type === 'date') {
    const d = new Date(String(displayValue));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
  }
  if (col.type === 'boolean') {
    return displayValue ? 'True' : 'False';
  }
  return String(displayValue);
}

/**
 * Resolves the cellStyle from a column def, handling both function and static values.
 */
export function resolveCellStyle<T>(
  col: IColumnDef<T>,
  item: T
): Record<string, string> | undefined {
  if (!col.cellStyle) return undefined;
  return typeof col.cellStyle === 'function' ? col.cellStyle(item) : col.cellStyle;
}
