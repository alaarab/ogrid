import { LiveDemo } from '../LiveDemo';
import type { IColumnDef, IMergedCell } from '@alaarab/ogrid-react-radix';

interface SalesRow {
  id: string;
  region: string;
  quarter: string;
  product: string;
  units: number;
  note: string;
}

const salesRows: SalesRow[] = [
  { id: 'n1', region: 'North', quarter: 'Q1', product: 'Widgets', units: 120, note: 'Launch quarter, two new retail partners' },
  { id: 'n2', region: 'North', quarter: 'Q1', product: 'Gadgets', units: 80, note: '' },
  { id: 'n3', region: 'North', quarter: 'Q2', product: 'Widgets', units: 140, note: '' },
  { id: 'n4', region: 'North', quarter: 'Q2', product: 'Gadgets', units: 95, note: '' },
  { id: 's1', region: 'South', quarter: 'Q1', product: 'Widgets', units: 60, note: 'Supply delay in March' },
  { id: 's2', region: 'South', quarter: 'Q1', product: 'Gadgets', units: 70, note: '' },
  { id: 's3', region: 'South', quarter: 'Q2', product: 'Widgets', units: 110, note: '' },
  { id: 's4', region: 'South', quarter: 'Q2', product: 'Gadgets', units: 105, note: '' },
];

const salesColumns: IColumnDef<SalesRow>[] = [
  { columnId: 'region', name: 'Region', defaultWidth: 110 },
  { columnId: 'quarter', name: 'Quarter', defaultWidth: 90 },
  { columnId: 'product', name: 'Product', defaultWidth: 120 },
  { columnId: 'units', name: 'Units', type: 'numeric', defaultWidth: 90 },
  { columnId: 'note', name: 'Note', defaultWidth: 260 },
];

const mergedCells: IMergedCell[] = [
  { rowId: 'n1', columnId: 'region', rowSpan: 4 },
  { rowId: 's1', columnId: 'region', rowSpan: 4 },
  { rowId: 'n1', columnId: 'quarter', rowSpan: 2 },
  { rowId: 'n3', columnId: 'quarter', rowSpan: 2 },
  { rowId: 's1', columnId: 'quarter', rowSpan: 2 },
  { rowId: 's3', columnId: 'quarter', rowSpan: 2 },
  { rowId: 'n1', columnId: 'note', rowSpan: 4 },
  { rowId: 's1', columnId: 'note', rowSpan: 4 },
];

export default function MergedCellsDemo() {
  return (
    <LiveDemo height={400} title="Region, quarter and note cells are merged  -  try the arrow keys, Shift+click and Ctrl+C">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={salesColumns}
            data={salesRows}
            getRowId={(r) => r.id}
            mergedCells={mergedCells}
            defaultPageSize={25}
          />
        );
      }}
    </LiveDemo>
  );
}
