import { createOGrid } from '@alaarab/ogrid-vue';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import ColumnChooser from '../ColumnChooser/ColumnChooser.vue';
import PaginationControls from '../PaginationControls/PaginationControls.vue';

export const OGrid = createOGrid({
  DataGridTable,
  ColumnChooser,
  PaginationControls,
});

export default OGrid;
