/**
 * View model helpers for DataGridTable. Core owns the logic; UI packages only render.
 */

import type { ColumnFilterType } from '../types/columnTypes';
import type { IColumnDef } from '../types/columnTypes';
import type { RowId, UserLike } from '../types/dataGridTypes';
import { getCellValue } from './cellValue';
import { isInSelectionRange } from '../types/dataGridTypes';

// --- Header filter config (replaces createHeaderWithFilter body) ---

export interface HeaderFilterConfigInput {
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string) => void;
  textFilters?: Record<string, string>;
  onTextFilterChange?: (key: string, value: string) => void;
  peopleFilters?: Record<string, UserLike | undefined>;
  onPeopleFilterChange?: (key: string, user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  filterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
  multiSelectFilters: Record<string, string[]>;
  onMultiSelectFilterChange: (key: string, values: string[]) => void;
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
}

/**
 * Returns ColumnHeaderFilter props from column def and grid filter/sort state.
 * Use in Fluent/Material/Radix DataGridTable instead of createHeaderWithFilter.
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
      textValue: input.textFilters?.[filterField] ?? '',
      onTextChange: input.onTextFilterChange
        ? (v: string) => input.onTextFilterChange!(filterField, v)
        : undefined,
    };
  }
  if (filterType === 'people') {
    return {
      ...base,
      selectedUser: input.peopleFilters?.[filterField],
      onUserChange: input.onPeopleFilterChange
        ? (u: UserLike | undefined) => input.onPeopleFilterChange!(filterField, u)
        : undefined,
      peopleSearch: input.peopleSearch,
    };
  }
  if (filterType === 'multiSelect') {
    return {
      ...base,
      options: input.filterOptions[filterField] ?? [],
      isLoadingOptions: input.loadingFilterOptions[filterField] ?? false,
      selectedValues: input.multiSelectFilters[filterField] ?? [],
      onFilterChange: (values: string[]) =>
        input.onMultiSelectFilterChange(filterField, values),
    };
  }
  return base;
}

// --- Cell render descriptor (replaces cell boolean + branch logic) ---

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
  itemsLength: number;
  getRowId: (item: T) => RowId;
  editable?: boolean;
  onCellValueChanged?: (event: import('../types/columnTypes').ICellValueChangedEvent<T>) => void;
  /** True while user is drag-selecting cells — hides fill handle during drag. */
  isDragging?: boolean;
}

export interface CellRenderDescriptor {
  mode: CellRenderMode;
  editorType?: 'text' | 'select' | 'checkbox';
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
    typeof col.cellEditor === 'function' &&
    col.cellEditorPopup !== false;
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

  const isPinned = col.pinned != null;
  const pinnedSide = col.pinned ?? undefined;

  let mode: CellRenderMode = 'display';
  let editorType: 'text' | 'select' | 'checkbox' | undefined;
  let value: unknown;

  if (isEditing && canEditInline) {
    mode = 'editing-inline';
    editorType =
      col.cellEditor === 'text' ||
      col.cellEditor === 'select' ||
      col.cellEditor === 'checkbox'
        ? col.cellEditor
        : 'text';
    value = getCellValue(item, col);
  } else if (isEditing && canEditPopup && typeof col.cellEditor === 'function') {
    mode = 'editing-popover';
    value = getCellValue(item, col);
  } else {
    value = getCellValue(item, col);
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
    isPinned,
    pinnedSide,
    globalColIndex,
    rowId,
    rowIndex,
    displayValue: value,
  };
}
