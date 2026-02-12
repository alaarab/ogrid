import React, { useState, useMemo } from 'react';
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

function FluentGrid() {
  const {
    OGrid,
    useUndoRedo,
  } = require('@alaarab/ogrid-react-fluent') as typeof import('@alaarab/ogrid-react-fluent');
  const {
    FluentProvider,
    webLightTheme,
    webDarkTheme,
  } = require('@fluentui/react-components') as typeof import('@fluentui/react-components');
  const { useColorMode } = require('@docusaurus/theme-common') as { useColorMode: () => { colorMode: string } };

  const { colorMode } = useColorMode();
  const theme = colorMode === 'dark' ? webDarkTheme : webLightTheme;

  const [data, setData] = useState(people);

  const columns = useMemo(() => [
    { columnId: 'name', name: 'Name', sortable: true, editable: true },
    {
      columnId: 'department',
      name: 'Department',
      sortable: true,
      editable: true,
      cellEditor: 'richSelect' as const,
      cellEditorParams: { values: DEPARTMENTS },
      filterable: { type: 'multiSelect' as const, filterField: 'department' },
    },
    { columnId: 'status', name: 'Status', sortable: true, editable: true, cellEditor: 'select' as const, cellEditorParams: { values: STATUSES } },
    {
      columnId: 'salary',
      name: 'Salary',
      type: 'numeric' as const,
      sortable: true,
      editable: true,
      valueFormatter: (v: unknown) => `$${Number(v).toLocaleString()}`,
    },
    { columnId: 'email', name: 'Email' },
  ], []);

  const { handleCellValueChanged, undo, redo, canUndo, canRedo } = useUndoRedo({
    data,
    setData,
    getRowId: (p: Person) => p.id,
  });

  return (
    <FluentProvider theme={theme} style={{ height: '100%', background: 'transparent' }}>
      <OGrid<Person>
        columns={columns}
        data={data}
        getRowId={(p) => p.id}
        editable
        cellSelection
        statusBar
        defaultPageSize={10}
        onCellValueChanged={handleCellValueChanged}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        aria-label="Fluent UI showcase grid"
      />
    </FluentProvider>
  );
}

export default function ShowcaseFluentDemo() {
  return (
    <LiveDemo height={480} title="Fluent UI — Microsoft design system">
      <BrowserOnly>{() => <FluentGrid />}</BrowserOnly>
    </LiveDemo>
  );
}
