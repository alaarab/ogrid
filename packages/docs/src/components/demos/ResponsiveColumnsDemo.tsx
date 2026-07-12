import React from 'react';
import { LiveDemo } from '../LiveDemo';

interface ContactRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  city: string;
}

const contacts: ContactRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: ['Alice Johnson', 'Bob Smith', 'Carol Lee', 'David Kim', 'Eve Torres', 'Frank Wu'][i % 6],
  email: `person${i + 1}@example.com`,
  phone: `555-01${String(i).padStart(2, '0')}`,
  department: ['Engineering', 'Marketing', 'Sales'][i % 3],
  city: ['Berlin', 'Austin', 'Tokyo', 'Lisbon'][i % 4],
}));

export default function ResponsiveColumnsDemo() {
  return (
    <LiveDemo height={480} title="Drag the slider — lower-priority columns hide as the container narrows">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        const columns = [
          { columnId: 'name', name: 'Name', responsivePriority: 0 },
          { columnId: 'email', name: 'Email', responsivePriority: 1 },
          { columnId: 'department', name: 'Department', responsivePriority: 2 },
          { columnId: 'city', name: 'City', responsivePriority: 3 },
          { columnId: 'phone', name: 'Phone', responsivePriority: 4 },
        ];
        function ResizablePlayground() {
          const [width, setWidth] = React.useState(100);
          return (
            <div style={{ padding: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
                Container width:
                <input
                  type="range"
                  min={35}
                  max={100}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  style={{ flex: 1, maxWidth: 260 }}
                />
                {width}%
              </label>
              <div style={{ width: `${width}%`, transition: 'width 0.15s', border: '1px dashed var(--ogrid-border, #ccc)' }}>
                <OGrid columns={columns} data={contacts} getRowId={(c: ContactRow) => c.id} responsiveColumns defaultPageSize={10} />
              </div>
            </div>
          );
        }
        return <ResizablePlayground />;
      }}
    </LiveDemo>
  );
}
