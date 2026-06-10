import { useMemo } from 'react';
import { LiveDemo } from '../LiveDemo';

interface Row {
  id: number;
  name: string;
  department: string;
  salary: number;
  status: string;
}

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type IColumnDef = import('@alaarab/ogrid-react-radix').IColumnDef<Row>;

  const columns: IColumnDef[] = [
    { columnId: 'id', name: 'ID', type: 'numeric' },
    { columnId: 'name', name: 'Name' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
    { columnId: 'status', name: 'Status' },
  ];

  const data = useMemo<Row[]>(
    () =>
      Array.from({ length: 10_000 }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        department: DEPTS[i % DEPTS.length],
        salary: 40000 + (i % 80) * 1000,
        status: STATUSES[i % STATUSES.length],
      })),
    [],
  );

  return (
    <OGrid
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      virtualScroll={{ enabled: true, rowHeight: 36 }}
      statusBar
    />
  );
}

export default function VirtualScrollingDemo() {
  return (
    <LiveDemo height={460} title="10,000 rows  -  only visible rows are in the DOM">
      {() => <Inner />}
    </LiveDemo>
  );
}
