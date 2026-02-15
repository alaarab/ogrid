import React, { useMemo } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IColumnDef } from '@alaarab/ogrid-react-radix';
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

const columns: IColumnDef<Row>[] = [
  { columnId: 'id', name: 'ID', type: 'numeric' },
  { columnId: 'name', name: 'Name' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'status', name: 'Status' },
];

export default function VirtualScrollingDemo() {
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
    <LiveDemo height={460} title="10,000 rows — only visible rows are in the DOM">
      <OGrid
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        virtualScroll={{ rowHeight: 36 }}
        statusBar
      />
    </LiveDemo>
  );
}
