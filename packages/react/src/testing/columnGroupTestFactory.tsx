/**
 * Shared column group tests.
 * Each UI package calls createColumnGroupTests(DataGridTable) to run these.
 * Tests that IColumnGroupDef produces multi-row <thead> rendering.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import type { IColumnDef, IColumnGroupDef, IOGridDataGridProps } from '../types';
import { getRowId, type FixtureRow } from './fixtures';

const rows: FixtureRow[] = [
  { id: '1', name: 'Alpha', status: 'Active' },
  { id: '2', name: 'Beta', status: 'Closed' },
];

const leafColumns: IColumnDef<FixtureRow>[] = [
  { columnId: 'name', name: 'Name', renderCell: (item) => <span>{item.name}</span> },
  { columnId: 'status', name: 'Status', renderCell: (item) => <span>{item.status}</span> },
];

const groupedColumns: (IColumnGroupDef<FixtureRow> | IColumnDef<FixtureRow>)[] = [
  {
    headerName: 'Info',
    children: [
      { columnId: 'name', name: 'Name', renderCell: (item) => <span>{item.name}</span> },
      { columnId: 'status', name: 'Status', renderCell: (item) => <span>{item.status}</span> },
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
          { columnId: 'name', name: 'Name', renderCell: (item) => <span>{item.name}</span> },
          { columnId: 'status', name: 'Status', renderCell: (item) => <span>{item.status}</span> },
        ],
      },
    ],
  },
];

export function createColumnGroupTests(DataGridTable: React.ComponentType<IOGridDataGridProps<FixtureRow>>): void {
  function renderTable(columns: (IColumnGroupDef<FixtureRow> | IColumnDef<FixtureRow>)[], overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) {
    return render(
      <DataGridTable
        items={rows}
        columns={columns}
        getRowId={getRowId}
        sortBy={undefined}
        sortDirection="asc"
        onColumnSort={jest.fn()}
        visibleColumns={new Set(['name', 'status'])}
        filters={{}}
        onFilterChange={jest.fn()}
        filterOptions={{}}
        loadingFilterOptions={{}}
        {...overrides}
      />
    );
  }

  describe('column groups', () => {
    it('renders single header row when columns are flat (no groups)', () => {
      const { container } = renderTable(leafColumns);
      const thead = container.querySelector('thead');
      expect(thead).toBeTruthy();
      const headerRows = thead!.querySelectorAll('tr');
      expect(headerRows.length).toBe(1);
    });

    it('renders two header rows when columns have one level of grouping', () => {
      const { container } = renderTable(groupedColumns);
      const thead = container.querySelector('thead');
      expect(thead).toBeTruthy();
      const headerRows = thead!.querySelectorAll('tr');
      expect(headerRows.length).toBe(2);
    });

    it('group header cell has correct colSpan', () => {
      const { container } = renderTable(groupedColumns);
      const thead = container.querySelector('thead');
      const firstRow = thead!.querySelectorAll('tr')[0];
      const groupCell = firstRow.querySelector('th[colspan]');
      expect(groupCell).toBeTruthy();
      expect(groupCell!.getAttribute('colspan')).toBe('2');
    });

    it('group header label text is visible', () => {
      renderTable(groupedColumns);
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('leaf columns still render body cells correctly with grouped headers', () => {
      renderTable(groupedColumns);
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('renders three header rows for nested two-level grouping', () => {
      const { container } = renderTable(nestedGroupedColumns);
      const thead = container.querySelector('thead');
      expect(thead).toBeTruthy();
      const headerRows = thead!.querySelectorAll('tr');
      expect(headerRows.length).toBe(3);
    });

    it('nested group shows both group labels', () => {
      renderTable(nestedGroupedColumns);
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });
  });
}
