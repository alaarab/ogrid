import * as React from 'react';
import type { IColumnDef } from '../types';

export interface FixtureRow {
  id: string;
  name: string;
  status: string;
}

export const fixtureRows: FixtureRow[] = [
  { id: '1', name: 'Alpha', status: 'Active' },
  { id: '2', name: 'Beta', status: 'Closed' },
  { id: '3', name: 'Gamma', status: 'Active' },
];

export const getRowId = (r: FixtureRow): string => r.id;

export const fixtureColumns: IColumnDef<FixtureRow>[] = [
  {
    columnId: 'name',
    name: 'Name',
    sortable: true,
    filterable: { type: 'text' },
    renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
  },
  {
    columnId: 'status',
    name: 'Status',
    sortable: true,
    filterable: { type: 'multiSelect', filterField: 'status' },
    renderCell: (item) => <span data-testid="cell-status">{item.status}</span>,
  },
];

export const fixtureFilterOptions: Record<string, string[]> = {
  status: ['Active', 'Closed'],
};
