import { createOGrid } from '@alaarab/ogrid-react';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';
import { PaginationControls } from '../PaginationControls/PaginationControls';

export type { IOGridProps } from '@alaarab/ogrid-react';

export const OGrid = createOGrid({
  DataGridTable: DataGridTable as never,
  ColumnChooser: ColumnChooser as never,
  PaginationControls,
});
