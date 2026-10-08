import { useState } from 'react';
import { LiveDemo } from '../LiveDemo';

interface Task {
  id: number;
  name: string;
  owner: string;
  priority: string;
}

const initialTasks: Task[] = [
  { id: 1, name: 'Draft spec', owner: 'Ada', priority: 'High' },
  { id: 2, name: 'Build prototype', owner: 'Linus', priority: 'High' },
  { id: 3, name: 'User interviews', owner: 'Grace', priority: 'Medium' },
  { id: 4, name: 'Pricing review', owner: 'Alan', priority: 'Low' },
  { id: 5, name: 'Ship beta', owner: 'Ada', priority: 'Medium' },
];

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type ColumnTree = import('@alaarab/ogrid-react-radix').IOGridProps<Task>['columns'];

  const [data, setData] = useState<Task[]>(initialTasks);
  const [readout, setReadout] = useState('');

  const columns: ColumnTree = [
    {
      columnId: 'name',
      name: 'Task',
      editable: true,
      // A native HTML5 drag source inside a cell: the grid leaves its pointer
      // press alone because of data-ogrid-allow-drag.
      renderCell: (item: Task) => (
        <span draggable data-ogrid-allow-drag="" style={{ cursor: 'grab' }}>
          {item.name}
        </span>
      ),
    },
    { columnId: 'owner', name: 'Owner', editable: true },
    { columnId: 'priority', name: 'Priority', editable: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div className="live-demo__controls">
        <span>
          Drag the row handle to reorder · drag a selected range's handle to move (Ctrl to copy) · drop text onto a cell
        </span>
        {readout && <span className="live-demo__readout">Dropped: {readout}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <OGrid
          columns={columns}
          data={data}
          getRowId={(r: Task) => r.id}
          editable
          rowDragging
          defaultSortBy=""
          rangeMove
          cellDrop
          onCellDrop={(e) => setReadout(`${e.text || `${e.files.length} file(s)`} → ${e.columnId}`)}
          onRowOrderChange={(e) => setData(e.data as Task[])}
          onCellValueChanged={(e) =>
            setData((prev) => prev.map((r) => (r.id === (e.item as Task).id ? { ...r, [e.columnId]: e.newValue } : r)))
          }
          defaultPageSize={25}
        />
      </div>
    </div>
  );
}

export default function DragAndDropDemo() {
  return (
    <LiveDemo height={460} title="Drag rows, move a cell range, or drop content onto a cell">
      {() => <Inner />}
    </LiveDemo>
  );
}
