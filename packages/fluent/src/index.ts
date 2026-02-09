// Components
export { OGrid, type IOGridProps, FluentDataTable, type IFluentDataTableProps } from './FluentDataTable';
export { DataGridTable, type IDataGridTableProps } from './DataGridTable/DataGridTable';
export { ColumnChooser, type IColumnChooserProps } from './ColumnChooser/ColumnChooser';
export { ColumnHeaderFilter, type IColumnHeaderFilterProps } from './ColumnHeaderFilter/ColumnHeaderFilter';
export { PaginationControls, type IPaginationControlsProps } from './PaginationControls/PaginationControls';

// Re-export everything from core for convenience
export {
  // Types
  type ColumnFilterType,
  type IColumnFilterDef,
  type IColumnMeta,
  type IColumnDef,
  type IColumnGroupDef,
  type IColumnDefinition,
  type ICellValueChangedEvent,
  type ICellEditorProps,
  type UserLike,
  type IFilters,
  type IFetchParams,
  type IPageResult,
  type IDataSource,
  type IGridColumnState,
  type IOGridApi,
  type RowSelectionMode,
  type IRowSelectionChangeEvent,
  type StatusBarPanel,
  type IStatusBarProps,
  type IActiveCell,
  type ISelectionRange,
  // Utilities
  toUserLike,
  isInSelectionRange,
  normalizeSelectionRange,
  toDataGridFilterProps,
  useFilterOptions,
  type UseFilterOptionsResult,
  getCellValue,
  flattenColumns,
  escapeCsvValue,
  buildCsvHeader,
  buildCsvRows,
  exportToCsv,
  triggerCsvDownload,
  type CsvColumn,
} from '@alaarab/ogrid-core';
