/**
 * @alaarab/ogrid-angular-radix
 *
 * Lightweight Angular data grid using Angular CDK for overlays.
 * This is the recommended "default" option for Angular developers.
 */

// Re-export everything from the base Angular package
export * from '@alaarab/ogrid-angular';

// Export our UI components
export { OGridComponent } from './ogrid/ogrid.component';
export { DataGridTableComponent } from './datagrid-table/datagrid-table.component';
export { ColumnHeaderFilterComponent } from './column-header-filter/column-header-filter.component';
export { ColumnChooserComponent } from './column-chooser/column-chooser.component';
export { PaginationControlsComponent } from './pagination-controls/pagination-controls.component';
