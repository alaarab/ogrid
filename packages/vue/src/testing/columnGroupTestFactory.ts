/**
 * Shared column group tests for Vue.
 * Each Vue UI package calls createColumnGroupTests() to run these.
 * Tests the buildHeaderRows utility from @alaarab/ogrid-core.
 */
import { buildHeaderRows } from '@alaarab/ogrid-core';
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

export function createColumnGroupTests(): void {
  describe('column groups', () => {
    it('flat columns produce a single header row', () => {
      const rows = buildHeaderRows(leafColumns);
      expect(rows.length).toBe(1);
      expect(rows[0].length).toBe(2);
      expect(rows[0][0].label).toBe('Name');
      expect(rows[0][1].label).toBe('Status');
    });

    it('one level grouping produces two header rows', () => {
      const rows = buildHeaderRows(groupedColumns);
      expect(rows.length).toBe(2);
    });

    it('group header cell has correct colSpan', () => {
      const rows = buildHeaderRows(groupedColumns);
      const groupRow = rows[0];
      const groupCell = groupRow.find((c) => c.isGroup);
      expect(groupCell).toBeTruthy();
      expect(groupCell?.colSpan).toBe(2);
    });

    it('group header label is visible in header data', () => {
      const rows = buildHeaderRows(groupedColumns);
      const groupCell = rows[0].find((c) => c.isGroup);
      expect(groupCell?.label).toBe('Info');
    });

    it('body cells (leaf columns) are correct with grouped headers', () => {
      const rows = buildHeaderRows(groupedColumns);
      // Second row has leaf columns
      const leafRow = rows[rows.length - 1];
      expect(leafRow.length).toBe(2);
      expect(leafRow[0].label).toBe('Name');
      expect(leafRow[1].label).toBe('Status');
    });

    it('nested two-level grouping produces three header rows', () => {
      const rows = buildHeaderRows(nestedGroupedColumns);
      expect(rows.length).toBe(3);
    });

    it('nested grouping shows both group labels', () => {
      const rows = buildHeaderRows(nestedGroupedColumns);
      const allLabels = rows.flatMap((row) => row.map((cell) => cell.label));
      expect(allLabels).toContain('Details');
      expect(allLabels).toContain('Info');
    });
  });
}
