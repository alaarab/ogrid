import type { IColumnDef } from '@alaarab/ogrid-core';

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
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' } },
];

export const fixtureFilterOptions: Record<string, string[]> = {
  status: ['Active', 'Closed'],
};
