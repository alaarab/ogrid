// Main components
export { default as OGrid } from './OGrid/OGrid.vue';
export { default as DataGridTable } from './DataGridTable/DataGridTable.vue';
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
export { default as InlineCellEditor } from './DataGridTable/InlineCellEditor.vue';

// Re-export everything from @alaarab/ogrid-vue (which re-exports from @alaarab/ogrid-core)
export * from '@alaarab/ogrid-vue';
