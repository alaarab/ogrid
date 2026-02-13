// Re-export everything from angular adapter
export * from '@alaarab/ogrid-angular';

// PrimeNG UI components
export { OGridComponent } from './ogrid/ogrid.component';
export { DataGridTableComponent } from './datagrid-table/datagrid-table.component';
export { InlineCellEditorComponent } from './datagrid-table/inline-cell-editor.component';
export { PopoverCellEditorComponent } from './datagrid-table/popover-cell-editor.component';
export { ColumnHeaderFilterComponent } from './column-header-filter/column-header-filter.component';
// IColumnHeaderFilterProps is now exported from @alaarab/ogrid-angular (base class)
export { ColumnChooserComponent } from './column-chooser/column-chooser.component';
export type { IColumnChooserProps } from './column-chooser/column-chooser.component';
export { PaginationControlsComponent } from './pagination-controls/pagination-controls.component';
export { ColumnHeaderMenuComponent } from './column-header-menu/column-header-menu.component';
