import { useState, useRef } from 'react';
import { LiveDemo } from '../LiveDemo';

interface Item {
  id: number;
  item?: string;
  qty?: number;
  price?: number;
  total?: unknown;
  [field: string]: unknown;
}

const initialRows: Item[] = [
  { id: 1, item: 'Notebook', qty: 4, price: 3.5 },
  { id: 4, item: 'Paper (ream)', qty: 2, price: 6 },
  { id: 2, item: 'Pen', qty: 10, price: 1.2 },
  { id: 3, item: 'Stapler', qty: 1, price: 12 },
];

// Total (column D) = qty * price per row. Insert or delete rows and columns and the references follow.
const initialFormulas = [
  { col: 3, row: 0, formula: '=B1*C1' },
  { col: 3, row: 1, formula: '=B2*C2' },
  { col: 3, row: 2, formula: '=B3*C3' },
  { col: 3, row: 3, formula: '=B4*C4' },
];

let nextId = 100;

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type Api = import('@alaarab/ogrid-react-radix').IOGridApi<Item>;
  type ColumnTree = import('@alaarab/ogrid-react-radix').IOGridProps<Item>['columns'];

  const apiRef = useRef<Api>(null);
  const [data, setData] = useState<Item[]>(initialRows);
  const [columns, setColumns] = useState<ColumnTree>([
    { columnId: 'item', name: 'Item', editable: true, defaultWidth: 160 },
    { columnId: 'qty', name: 'Qty', type: 'numeric', editable: true },
    { columnId: 'price', name: 'Price', type: 'numeric', editable: true },
    { columnId: 'total', name: 'Total', editable: true },
  ]);
  const [readout, setReadout] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div className="live-demo__controls">
        <button type="button" onClick={() => apiRef.current?.insertRows(0)}>insertRows(0)</button>
        <button type="button" onClick={() => apiRef.current?.insertColumn(1)}>insertColumn(1)</button>
        <button type="button" onClick={() => apiRef.current?.setCellValue(1, 'qty', 8)}>setCellValue(1, 'qty', 8)</button>
        <button type="button" onClick={() => setReadout(String(apiRef.current?.getCellValue(1, 'total')))}>
          getCellValue(1, 'total')
        </button>
        {readout && <span className="live-demo__readout">= {readout}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <OGrid<Item>
          ref={apiRef}
          columns={columns}
          data={data}
          getRowId={(r) => r.id}
          editable
          cellReferences
          formulas
          initialFormulas={initialFormulas}
          allowStructureEdits
          rowResize
          createRow={() => ({ id: nextId++ })}
          onCellValueChanged={(e) =>
            setData((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)))
          }
          onRowsChange={(e) => setData(e.data)}
          onColumnsChange={(e) => setColumns(e.columns)}
          defaultPageSize={25}
        />
      </div>
    </div>
  );
}

export default function StructureEditingDemo() {
  return (
    <LiveDemo height={440} title="Right-click a cell or open a column menu to insert or delete rows and columns; Ctrl+Z undoes">
      {() => <Inner />}
    </LiveDemo>
  );
}
