import React, { useRef, useEffect } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { LiveDemo } from '../LiveDemo';

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

const NAMES = [
  'Alice Johnson', 'Bob Smith', 'Carol Lee', 'David Kim', 'Eve Torres',
  'Frank Wu', 'Grace Park', 'Henry Adams', 'Irene Costa', 'Jack Rivera',
  'Karen Liu', 'Leo Martinez', 'Mona Chen', 'Nate Brown', 'Olivia Scott',
  'Paul Davis', 'Quinn Foster', 'Rachel Green', 'Sam Wilson', 'Tina Hall',
  'Uma Patel', 'Vince Moore', 'Wendy Diaz', 'Xander Young', 'Yara King',
];

interface Person {
  id: number;
  name: string;
  age: number;
  email: string;
  department: string;
  salary: number;
  status: string;
  startDate: string;
}

const people: Person[] = NAMES.map((name, i) => ({
  id: i + 1,
  name,
  age: 25 + (i % 30),
  email: `${name.split(' ')[0].toLowerCase()}@example.com`,
  department: DEPARTMENTS[i % DEPARTMENTS.length],
  salary: 50000 + i * 3500,
  status: STATUSES[i % STATUSES.length],
  startDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
}));

function VanillaJSGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<unknown>(null);

  useEffect(() => {
    let destroyed = false;

    import('@alaarab/ogrid-js').then(({ OGrid }) => {
      if (destroyed || !containerRef.current) return;

      const grid = new OGrid<Person>(containerRef.current, {
        columns: [
          { columnId: 'name', name: 'Name', sortable: true, editable: true },
          {
            columnId: 'department',
            name: 'Department',
            sortable: true,
            editable: true,
            cellEditor: 'select',
            cellEditorParams: { values: DEPARTMENTS },
          },
          { columnId: 'status', name: 'Status', sortable: true },
          {
            columnId: 'salary',
            name: 'Salary',
            type: 'numeric',
            sortable: true,
            editable: true,
            valueFormatter: (v) => `$${Number(v).toLocaleString()}`,
          },
          { columnId: 'email', name: 'Email' },
        ],
        data: people,
        getRowId: (p) => p.id,
        pageSize: 10,
        editable: true,
        cellSelection: true,
        'aria-label': 'Vanilla JS demo grid',
      });

      gridRef.current = grid;
    });

    return () => {
      destroyed = true;
      if (gridRef.current && typeof (gridRef.current as { destroy: () => void }).destroy === 'function') {
        (gridRef.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100%' }} />;
}

export default function VanillaJSDemo() {
  return (
    <LiveDemo height={420} title="Vanilla JS - zero dependencies">
      <BrowserOnly>{() => <VanillaJSGrid />}</BrowserOnly>
    </LiveDemo>
  );
}
