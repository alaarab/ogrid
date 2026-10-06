/**
 * Pure derivations behind useOGrid's slices. Each one holds a decision that is
 * easy to get subtly wrong inline (and is unit-tested on its own).
 */
import { createFormulaRowMap, createOffsetFormulaRowMap } from '@alaarab/ogrid-core';
import type { IColumnDef, IFormulaRowMap } from '@alaarab/ogrid-core';
import type {
  IColumnDefinition,
  IOGridProps,
  IStatusBarProps,
  IVirtualScrollConfig,
  PageSize,
  RowId,
} from '../types';
import type { ColumnChooserPlacement } from './useOGrid.types';

/** `columnChooser` prop to placement; anything not explicit lands in the toolbar. */
export function resolveColumnChooserPlacement(prop: IOGridProps<unknown>['columnChooser']): ColumnChooserPlacement {
  return prop === false ? 'none'
    : prop === 'sidebar' ? 'sidebar'
    : prop === 'external' ? 'external'
    : 'toolbar';
}

/**
 * Full-dataset virtualization: a client-side grid with `virtualScroll.enabled`
 * and `paginate: false` virtual-scrolls every row in one viewport, bypassing
 * pagination. Server-side grids always page through the data source.
 */
export function isFullyVirtualized(isServerSide: boolean, virtualScroll: IVirtualScrollConfig | undefined): boolean {
  return !isServerSide && virtualScroll?.enabled === true && virtualScroll?.paginate === false;
}

/**
 * Without `defaultSortBy` the grid starts sorted by its first sortable column
 * (a `sortable: false` first column is skipped, never used as the default).
 */
export function resolveDefaultSortField(
  defaultSortBy: string | undefined,
  columns: readonly { columnId: string; sortable?: boolean }[],
): string {
  return defaultSortBy ?? columns.find((c) => c.sortable !== false)?.columnId ?? '';
}

export interface PageClampInput {
  page: number;
  pageSize: PageSize;
  totalCount: number;
  /** The host controls `page`; correcting it is the host's job. */
  controlled: boolean;
  /** Full-dataset virtualization or a windowed source: there are no pages. */
  unpaged: boolean;
}

/**
 * A page index outlives its data whenever the row count shrinks without the
 * page following (a sheet switch onto a shorter sheet, a host-applied filter,
 * a refresh that returns fewer rows). The page slice then lands past the end.
 * `isPagePastEnd` says to snap back to `lastPage`.
 */
export function resolvePageClamp(input: PageClampInput): { lastPage: number; isPagePastEnd: boolean } {
  const { page, pageSize, totalCount, controlled, unpaged } = input;
  const lastPage = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const isPagePastEnd = !controlled && !unpaged && totalCount > 0 && page > lastPage;
  return { lastPage, isPagePastEnd };
}

/**
 * Rows that `selectedItems` resolve against: every row the grid holds, not just
 * the visible page. Client-side that is the full dataset; server-side the
 * loaded window (windowed source) or the current page.
 */
export function resolveSelectionKnownItems<T>(
  isServerSide: boolean,
  loadedRows: T[] | undefined,
  displayItems: T[],
  displayData: T[],
): T[] {
  return isServerSide ? (loadedRows ?? displayItems) : displayData;
}

export interface StatusBarCounts {
  isServerSide: boolean;
  /** Length of the client-side dataset (unused server-side). */
  dataLength: number;
  /** Rows after filtering (client) or the server's total. */
  totalCount: number;
  hasActiveFilters: boolean;
  selectedCount: number;
}

/** `statusBar: true` gets counts from the grid; an object is the host's own config. */
export function buildStatusBarConfig(
  statusBar: boolean | IStatusBarProps | undefined,
  counts: StatusBarCounts,
): IStatusBarProps | undefined {
  if (!statusBar) return undefined;
  if (typeof statusBar === 'object') return statusBar;
  return {
    totalCount: counts.isServerSide ? counts.totalCount : counts.dataLength,
    filteredCount: counts.hasActiveFilters ? counts.totalCount : undefined,
    selectedCount: counts.selectedCount,
    suppressRowCount: true,
  };
}

/** Which spreadsheet chrome the grid shows for `showRowNumbers` / `cellReferences` / `formulas`. */
export function resolveSpreadsheetChrome(flags: {
  showRowNumbers?: boolean;
  cellReferences?: boolean;
  formulas?: boolean;
}) {
  const { showRowNumbers, cellReferences, formulas } = flags;
  const spreadsheetMode = !!(cellReferences || formulas);
  return {
    spreadsheetMode,
    showRowNumbers: showRowNumbers || cellReferences || formulas,
    showColumnLetters: spreadsheetMode,
    // The formula bar has its own name box.
    showNameBox: !!cellReferences && !formulas,
    reportActiveCell: spreadsheetMode,
  };
}

/** Absolute row of a server-side page's first row; 0 client-side (formula rows index the full data). */
export function resolveSheetPageOffset(isServerSide: boolean, page: number, pageSize: PageSize): number {
  return isServerSide && pageSize !== 'all' ? (page - 1) * pageSize : 0;
}

/**
 * The rows formulas address, indexed by sheet row. Client-side that is the full
 * dataset (formulas stay with their record through sort, filter and paging).
 * Server-side it is the current page, preceded by holes standing in for the
 * server rows before it; a windowed source exposes its loaded rows.
 */
export function resolveSheetItems<T>(
  windowed: { loadedRows?: T[] } | null | undefined,
  isServerSide: boolean,
  displayData: T[],
  displayItems: T[],
  pageOffset: number,
): T[] {
  if (windowed) return windowed.loadedRows ?? displayItems;
  if (!isServerSide) return displayData;
  return pageOffset > 0 ? new Array<T>(pageOffset).concat(displayItems) : displayItems;
}

/** Row id to its index in the full client-side dataset (its sheet row). */
export function buildSheetRowIndex<T>(data: readonly T[], getRowId: (item: T) => RowId): Map<RowId, number> {
  const m = new Map<RowId, number>();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item !== undefined) m.set(getRowId(item), i);
  }
  return m;
}

/**
 * Maps displayed rows to sheet rows: by id client-side (`sheetRowById`), by a
 * page offset server-side, from row 0 for a windowed source. `undefined` when
 * the grid is not in spreadsheet mode.
 */
export function selectFormulaRowMap<T>(input: {
  spreadsheetMode: boolean;
  windowedRowCount: number | null;
  sheetRowById: Map<RowId, number> | null;
  pageOffset: number;
  displayItems: T[];
  getRowId: (item: T) => RowId;
}): IFormulaRowMap | undefined {
  const { spreadsheetMode, windowedRowCount, sheetRowById, pageOffset, displayItems, getRowId } = input;
  if (!spreadsheetMode) return undefined;
  if (windowedRowCount !== null) return createOffsetFormulaRowMap(0, windowedRowCount);
  if (!sheetRowById) return createOffsetFormulaRowMap(pageOffset, displayItems.length);
  return createFormulaRowMap(sheetRowById, displayItems, getRowId);
}

/** Column chooser entries: just the fields the chooser reads. */
export function toColumnChooserColumns<T>(columns: readonly IColumnDef<T>[]): IColumnDefinition[] {
  return columns.map((c) => ({ columnId: c.columnId, name: c.name, required: c.required === true }));
}

/** Side bar filter panel entries: only columns with a filter type. */
export function toFilterableColumns<T>(columns: readonly IColumnDef<T>[]) {
  return columns
    .filter((c) => c.filterable?.type)
    .map((c) => ({
      columnId: c.columnId,
      name: c.name,
      filterField: c.filterable?.filterField ?? c.columnId,
      filterType: c.filterable?.type as 'text' | 'multiSelect' | 'people' | 'date',
    }));
}
