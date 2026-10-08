import { useState } from 'react';
import { LiveDemo } from '../LiveDemo';

interface Item {
  id: number;
  item: string;
  qty: number;
  price: number;
}

const rows: Item[] = [
  { id: 1, item: 'Notebook', qty: 4, price: 3.5 },
  { id: 4, item: 'Paper (ream)', qty: 2, price: 6 },
  { id: 2, item: 'Pen', qty: 10, price: 1.2 },
  { id: 3, item: 'Stapler', qty: 1, price: 12 },
];

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type ICellNote = import('@alaarab/ogrid-react-radix').ICellNote;

  const [notes, setNotes] = useState<ICellNote[]>([
    { rowId: 1, columnId: 'item', text: 'Order the dotted kind next time.', author: 'Ala' },
    { rowId: 3, columnId: 'price', text: 'Price went up in March.', author: 'Sam' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div className="live-demo__controls">{notes.length} note{notes.length === 1 ? '' : 's'}</div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <OGrid
          columns={[
            { columnId: 'item', name: 'Item', defaultWidth: 160, sortable: true },
            { columnId: 'qty', name: 'Qty', type: 'numeric', sortable: true },
            { columnId: 'price', name: 'Price', type: 'numeric', sortable: true },
          ]}
          data={rows}
          getRowId={(r: Item) => r.id}
          cellNotes={notes}
          onCellNotesChange={setNotes}
          cellNoteAuthor="You"
          defaultPageSize={25}
        />
      </div>
    </div>
  );
}

export default function CellNotesDemo() {
  return (
    <LiveDemo height={360} title="Hover a red corner to read a note; right-click a cell (or press Shift+F2) to add, edit or delete one">
      {() => <Inner />}
    </LiveDemo>
  );
}
