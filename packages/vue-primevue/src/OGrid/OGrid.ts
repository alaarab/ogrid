import { createOGrid } from '@alaarab/ogrid-vue';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';
import { PaginationControls } from '../PaginationControls/PaginationControls';

export const OGrid = createOGrid({
  DataGridTable,
  ColumnChooser,
  PaginationControls,
});
