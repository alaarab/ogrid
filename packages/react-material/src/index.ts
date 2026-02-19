// Components
export { OGrid, type IOGridProps } from './OGrid';
export { DataGridTable } from './DataGridTable/DataGridTable';
export { ColumnChooser, type IColumnChooserProps } from './ColumnChooser/ColumnChooser';
export { ColumnHeaderFilter, type IColumnHeaderFilterProps } from './ColumnHeaderFilter/ColumnHeaderFilter';
export { PaginationControls, type IPaginationControlsProps } from './PaginationControls/PaginationControls';
export { ColumnHeaderMenu, type ColumnHeaderMenuProps } from './ColumnHeaderMenu/ColumnHeaderMenu';

// Re-export all from base package for consumer convenience.
// Note: This prevents tree-shaking of unused utilities.
// Consider explicit named exports in a future major version.
export * from '@alaarab/ogrid-react';
