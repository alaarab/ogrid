// Components
export { OGrid, type IOGridProps } from './OGrid/OGrid';
export { DataGridTable } from './DataGridTable/DataGridTable';
export { ColumnChooser, type IColumnChooserProps } from './ColumnChooser/ColumnChooser';
export { ColumnHeaderFilter, type IColumnHeaderFilterProps } from './ColumnHeaderFilter/ColumnHeaderFilter';
export { ColumnHeaderMenu, type ColumnHeaderMenuProps } from './ColumnHeaderMenu/ColumnHeaderMenu';
export { PaginationControls, type IPaginationControlsProps } from './PaginationControls/PaginationControls';

// Re-export all from base package for consumer convenience.
// Note: This prevents tree-shaking of unused utilities.
// Consider explicit named exports in a future major version.
export * from '@alaarab/ogrid-react';
