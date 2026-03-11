import type { IColumnDef } from '@alaarab/ogrid-core';

export interface Project {
  id: string;
  name: string;
  status: string;
  owner: string;
  budget: number;
  startDate: string;
  department: string;
  active: boolean;
}

export interface DemoColumnOptions {
  formulaMode?: boolean;
}

const STATUSES = ['Active', 'Planning', 'On Hold', 'Completed', 'Cancelled'];
const OWNERS = ['Alice Johnson', 'Bob Smith', 'Carol Lee', 'David Kim', 'Eve Torres', 'Frank Wu', 'Grace Park', 'Henry Adams'];
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations', 'HR'];

export function makeDemoProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `proj-${i + 1}`,
    name: `Project ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ''}`,
    status: STATUSES[i % STATUSES.length],
    owner: OWNERS[i % OWNERS.length],
    budget: Math.round((5000 + Math.random() * 95000) * 100) / 100,
    startDate: new Date(2024, i % 12, 1 + (i % 28)).toISOString().slice(0, 10),
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    active: i % 3 !== 0,
  }));
}

export function makeDemoColumns<T extends Project>(options: DemoColumnOptions = {}): IColumnDef<T>[] {
  const { formulaMode = false } = options;

  return [
    {
      columnId: 'name',
      name: 'Project Name',
      sortable: true,
      editable: true,
      filterable: { type: 'text' },
    },
    {
      columnId: 'status',
      name: 'Status',
      sortable: true,
      editable: true,
      cellEditor: 'richSelect' as never,
      cellEditorParams: { values: STATUSES },
      filterable: { type: 'multiSelect', filterField: 'status' },
    },
    {
      columnId: 'owner',
      name: 'Owner',
      sortable: true,
      filterable: { type: 'text' },
    },
    {
      columnId: 'department',
      name: 'Department',
      sortable: true,
      filterable: { type: 'multiSelect', filterField: 'department' },
    },
    {
      columnId: 'budget',
      name: 'Budget',
      sortable: true,
      editable: formulaMode,
      compare: (a: T, b: T) => a.budget - b.budget,
      valueFormatter: (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '',
    },
    {
      columnId: 'startDate',
      name: 'Start Date',
      type: 'date' as const,
      sortable: true,
      editable: true,
    },
    {
      columnId: 'active',
      name: 'Active',
      type: 'boolean' as const,
      sortable: true,
      editable: true,
    },
  ] as IColumnDef<T>[];
}

export const getRowId = (p: Project) => p.id;

/** In-place cell value update for editable examples. */
export function handleCellValueChanged<T extends { id: string | number }>(
  data: T[],
  event: { item: T; columnId: string; newValue: unknown },
): void {
  const row = data.find((d) => d.id === event.item.id);
  if (row) {
    (row as unknown as Record<string, unknown>)[event.columnId] = event.newValue;
  }
}
