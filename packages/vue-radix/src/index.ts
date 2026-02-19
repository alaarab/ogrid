// Main components
export { OGrid } from './OGrid/OGrid';
export { DataGridTable } from './DataGridTable/DataGridTable';
export { default as ColumnChooser } from './ColumnChooser/ColumnChooser.vue';
export type { IColumnChooserProps } from './ColumnChooser/types';
export { default as ColumnHeaderFilter } from './ColumnHeaderFilter/ColumnHeaderFilter.vue';
export type { IColumnHeaderFilterProps } from './ColumnHeaderFilter/types';
export { default as PaginationControls } from './PaginationControls/PaginationControls.vue';
export type { IPaginationControlsProps } from './PaginationControls/types';

// ColumnHeaderMenu
export { default as ColumnHeaderMenu } from './ColumnHeaderMenu/ColumnHeaderMenu.vue';
export type { ColumnHeaderMenuProps } from './ColumnHeaderMenu/types';

// Re-export shared components from base
export { StatusBar, MarchingAntsOverlay } from '@alaarab/ogrid-vue';
// DataGridTable sub-components
export { default as GridContextMenu } from './DataGridTable/GridContextMenu.vue';
export { InlineCellEditor } from './DataGridTable/InlineCellEditor';

// Re-export all from base package for consumer convenience.
// Note: This prevents tree-shaking of unused utilities.
// Consider explicit named exports in a future major version.
export * from '@alaarab/ogrid-vue';
