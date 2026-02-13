/**
 * Shared column group tests for Angular UI packages.
 * Each UI package calls createColumnGroupTests(DataGridTableComponent) to run these.
 *
 * Since Angular mocks do not support DOM rendering, these tests verify
 * the column group processing through buildHeaderRows (core utility)
 * and the DataGridStateService headerRows computed.
 */
import { buildHeaderRows, flattenColumns } from '@alaarab/ogrid-core';
import type { IColumnDef, IColumnGroupDef } from '../types';
import type { FixtureRow } from './fixtures';

const leafColumns: IColumnDef<FixtureRow>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'status', name: 'Status' },
];

const groupedColumns: (IColumnGroupDef<FixtureRow> | IColumnDef<FixtureRow>)[] = [
  {
    headerName: 'Info',
    children: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'status', name: 'Status' },
    ],
  },
];

const nestedGroupedColumns: (IColumnGroupDef<FixtureRow> | IColumnDef<FixtureRow>)[] = [
  {
    headerName: 'Details',
    children: [
      {
        headerName: 'Info',
        children: [
          { columnId: 'name', name: 'Name' },
          { columnId: 'status', name: 'Status' },
        ],
      },
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createColumnGroupTests(_DataGridTableComponent: new (...args: any[]) => any): void {
  describe('column groups', () => {
    it('flat columns produce single header row', () => {
      const rows = buildHeaderRows(leafColumns, new Set(['name', 'status']));
      expect(rows.length).toBe(1);
      expect(rows[0].length).toBe(2);
    });

    it('grouped columns produce two header rows', () => {
      const rows = buildHeaderRows(groupedColumns, new Set(['name', 'status']));
      expect(rows.length).toBe(2);
    });

    it('group header cell has correct colSpan', () => {
      const rows = buildHeaderRows(groupedColumns, new Set(['name', 'status']));
      const groupRow = rows[0];
      const groupCell = groupRow.find((c) => c.isGroup);
      expect(groupCell).toBeTruthy();
      expect(groupCell!.colSpan).toBe(2);
    });

    it('group header label is correct', () => {
      const rows = buildHeaderRows(groupedColumns, new Set(['name', 'status']));
      const groupCell = rows[0].find((c) => c.isGroup);
      expect(groupCell!.label).toBe('Info');
    });

    it('nested groups produce three header rows', () => {
      const rows = buildHeaderRows(nestedGroupedColumns, new Set(['name', 'status']));
      expect(rows.length).toBe(3);
    });

    it('nested groups show both group labels', () => {
      const rows = buildHeaderRows(nestedGroupedColumns, new Set(['name', 'status']));
      const labels = rows.flatMap((r) => r.filter((c) => c.isGroup).map((c) => c.label));
      expect(labels).toContain('Details');
      expect(labels).toContain('Info');
    });

    it('flattenColumns returns leaf columns from nested groups', () => {
      const flat = flattenColumns(nestedGroupedColumns);
      expect(flat.map((c) => c.columnId)).toEqual(['name', 'status']);
    });

    it('visibleColumns filtering respects groups', () => {
      const rows = buildHeaderRows(groupedColumns, new Set(['name']));
      // When only 'name' is visible, the group still shows but colSpan should be 1
      expect(rows.length).toBe(2);
      const groupCell = rows[0].find((c) => c.isGroup);
      expect(groupCell!.colSpan).toBe(1);
    });
  });
}
