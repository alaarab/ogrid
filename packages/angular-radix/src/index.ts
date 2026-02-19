/**
 * @alaarab/ogrid-angular-radix
 *
 * Lightweight Angular data grid using Angular CDK for overlays.
 * This is the recommended "default" option for Angular developers.
 */

// Re-export all from base package for consumer convenience.
// Note: This prevents tree-shaking of unused utilities.
// Consider explicit named exports in a future major version.
export * from '@alaarab/ogrid-angular';

// Export our UI components
export { OGridComponent } from './ogrid/ogrid.component';
export { DataGridTableComponent } from './datagrid-table/datagrid-table.component';
export { ColumnHeaderFilterComponent } from './column-header-filter/column-header-filter.component';
// IColumnHeaderFilterProps is now exported from @alaarab/ogrid-angular (base class)
export { ColumnChooserComponent } from './column-chooser/column-chooser.component';
// IColumnChooserProps is now exported from @alaarab/ogrid-angular (base class)
export { PaginationControlsComponent } from './pagination-controls/pagination-controls.component';
export { ColumnHeaderMenuComponent } from './column-header-menu/column-header-menu.component';
export { InlineCellEditorComponent } from './datagrid-table/inline-cell-editor.component';
export { PopoverCellEditorComponent } from './datagrid-table/popover-cell-editor.component';
