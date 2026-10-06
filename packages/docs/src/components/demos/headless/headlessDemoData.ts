import type { IColumnDef } from '@alaarab/ogrid-react';
import { people, type Person } from '../demoData';

export type { Person };

export const getRowId = (p: Person) => p.id;

/** A copy of the first 60 sample people; demos keep their own mutable state. */
export const rows: Person[] = people.slice(0, 60).map((p) => ({ ...p }));

export const money = (v: unknown) => `$${Number(v).toLocaleString()}`;

/**
 * Shared column set. Email is deliberately read-only so the editing demos can
 * show how `editable` is honored. Salary has a custom `valueParser`, so the
 * paste/fill/edit paths all reject negative or non-numeric input.
 */
export const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true, filterable: { type: 'text' } },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', sortable: true, editable: true },
  {
    columnId: 'salary',
    name: 'Salary',
    type: 'numeric',
    sortable: true,
    editable: true,
    valueFormatter: money,
    valueParser: ({ newValue }) => {
      const n = Number(newValue);
      return Number.isNaN(n) || n < 0 ? undefined : n;
    },
  },
  { columnId: 'email', name: 'Email' },
];

export const isNumeric = (col: IColumnDef<Person>) => col.type === 'numeric';

/** Display text for a cell, honoring the column's `valueFormatter`. */
export function formatCell(col: IColumnDef<Person>, value: unknown, item: Person): string {
  if (value == null || value === '') return '';
  return col.valueFormatter ? col.valueFormatter(value, item) : String(value);
}

/** Minimal event shape every spreadsheet hook produces for a single cell. */
export interface CellChange {
  item: Person;
  columnId: string;
  newValue: unknown;
}

/** Immutable reducer: apply one hook event to the row array. */
export function applyChange(prev: Person[], event: CellChange): Person[] {
  const id = getRowId(event.item);
  return prev.map((row) => (getRowId(row) === id ? { ...row, [event.columnId]: event.newValue } : row));
}

/** 10,000 rows for the virtualization demo. */
export const bigRows: Person[] = Array.from({ length: 10_000 }, (_, i) => {
  const base = people[i % people.length];
  return { ...base, id: i + 1, name: `${base.name} #${i + 1}` };
});
