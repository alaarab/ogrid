import type { IColumnDef } from '@alaarab/ogrid-core';

export interface Project {
  id: string;
  name: string;
  status: string;
  owner: string;
  budget: number;
  startDate: string;
  department: string;
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
  }));
}

export function makeDemoColumns<T extends Project>(): IColumnDef<T>[] {
  return [
    {
      columnId: 'name',
      name: 'Project Name',
      sortable: true,
      filterable: { type: 'text' },
    },
    {
      columnId: 'status',
      name: 'Status',
      sortable: true,
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
      compare: (a: T, b: T) => a.budget - b.budget,
    },
    {
      columnId: 'startDate',
      name: 'Start Date',
      sortable: true,
    },
  ] as IColumnDef<T>[];
}

export const getRowId = (p: Project) => p.id;
