/**
 * Accessibility tests using jest-axe and manual ARIA attribute verification.
 *
 * These tests verify that the OGrid and DataGridTable components meet
 * WCAG 2.1 accessibility standards including proper ARIA roles, labels,
 * and keyboard navigation attributes.
 */
import * as React from 'react';
import { render, screen, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { OGrid } from '../OGrid/OGrid';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import type { IColumnDef, IOGridDataGridProps } from '@alaarab/ogrid-react';
import { fixtureRows, fixtureColumns, getRowId } from '@alaarab/ogrid-react/testing';
import type { FixtureRow } from '@alaarab/ogrid-react/testing';

expect.extend(toHaveNoViolations);

// --- Shared props helpers ---

function getOGridProps(overrides: Record<string, unknown> = {}) {
  return {
    data: fixtureRows,
    columns: fixtureColumns,
    getRowId,
    entityLabelPlural: 'items',
    defaultPageSize: 10,
    ...overrides,
  };
}

const tableColumns: IColumnDef<FixtureRow>[] = [
  {
    columnId: 'name',
    name: 'Name',
    sortable: true,
    filterable: { type: 'text' },
    renderCell: (item) => <span>{item.name}</span>,
  },
  {
    columnId: 'status',
    name: 'Status',
    sortable: true,
    filterable: { type: 'multiSelect', filterField: 'status' },
    renderCell: (item) => <span>{item.status}</span>,
  },
];

function getDataGridTableProps(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}): IOGridDataGridProps<FixtureRow> {
  return {
    items: fixtureRows,
    columns: tableColumns,
    getRowId,
    sortBy: undefined,
    sortDirection: 'asc' as const,
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['name', 'status']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: { status: ['Active', 'Closed'] },
    loadingFilterOptions: {},
    ...overrides,
  };
}

// --- jest-axe violation tests ---

describe('OGrid accessibility (axe)', () => {
  it('has no axe violations with default props', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<OGrid {...getOGridProps()} />));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with row selection enabled', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<OGrid {...getOGridProps({ rowSelection: 'multiple' })} />));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with sorting applied', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <OGrid {...getOGridProps({ defaultSortBy: 'name', defaultSortDirection: 'asc' })} />
      ));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('DataGridTable accessibility (axe)', () => {
  it('has no axe violations with default props', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<DataGridTable {...getDataGridTableProps()} />));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with ascending sort applied', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <DataGridTable {...getDataGridTableProps({ sortBy: 'name', sortDirection: 'asc' })} />
      ));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// --- Manual ARIA attribute tests ---

describe('DataGridTable ARIA structure', () => {
  it('renders a <table> element', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('renders <th> header cells with scope="col"', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    const ths = container.querySelectorAll('th[scope="col"]');
    // At minimum the two column headers should have scope="col"
    expect(ths.length).toBeGreaterThanOrEqual(2);
    const scopes = Array.from(ths).map((th) => th.getAttribute('scope'));
    expect(scopes.every((s) => s === 'col' || s === 'colgroup')).toBe(true);
  });

  it('renders column header cells with column names', () => {
    render(<DataGridTable {...getDataGridTableProps()} />);
    // Column header filters render the column name as the button label
    expect(screen.getByRole('button', { name: /filter name/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter status/i })).toBeInTheDocument();
  });

  it('renders aria-sort="ascending" on sorted column header', () => {
    const { container } = render(
      <DataGridTable {...getDataGridTableProps({ sortBy: 'name', sortDirection: 'asc' })} />
    );
    const sortedTh = container.querySelector('th[aria-sort="ascending"]');
    expect(sortedTh).toBeInTheDocument();
  });

  it('renders aria-sort="descending" on desc-sorted column header', () => {
    const { container } = render(
      <DataGridTable {...getDataGridTableProps({ sortBy: 'status', sortDirection: 'desc' })} />
    );
    const sortedTh = container.querySelector('th[aria-sort="descending"]');
    expect(sortedTh).toBeInTheDocument();
  });

  it('does not set aria-sort on unsorted column headers', () => {
    const { container } = render(
      <DataGridTable {...getDataGridTableProps({ sortBy: 'name', sortDirection: 'asc' })} />
    );
    // The status column is not sorted, so should not have aria-sort
    const statusTh = container.querySelector('th[data-column-id="status"]');
    expect(statusTh).not.toBeNull();
    expect(statusTh?.getAttribute('aria-sort')).toBeNull();
  });

  it('renders <td> data cells', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    const tds = container.querySelectorAll('td');
    // 3 rows x 2 columns = 6 cells
    expect(tds.length).toBeGreaterThanOrEqual(6);
  });

  it('assigns data-column-id to header cells', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    expect(container.querySelector('th[data-column-id="name"]')).toBeInTheDocument();
    expect(container.querySelector('th[data-column-id="status"]')).toBeInTheDocument();
  });

  it('assigns data-column-id to body cells', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    const nameTds = container.querySelectorAll('td[data-column-id="name"]');
    expect(nameTds.length).toBeGreaterThanOrEqual(3);
  });

  it('region wrapper has role="region" with accessible label', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    const region = container.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
    // Either aria-label or aria-labelledby should be set
    const hasLabel =
      region?.hasAttribute('aria-label') || region?.hasAttribute('aria-labelledby');
    expect(hasLabel).toBe(true);
  });

  it('uses provided aria-label on region wrapper', () => {
    const { container } = render(
      <DataGridTable {...getDataGridTableProps({ 'aria-label': 'My custom data grid' })} />
    );
    const region = container.querySelector('[role="region"]');
    expect(region?.getAttribute('aria-label')).toBe('My custom data grid');
  });
});

describe('Row selection ARIA', () => {
  it('checkbox column header has aria-label "Select all rows"', () => {
    render(
      <DataGridTable {...getDataGridTableProps({ rowSelection: 'multiple' })} />
    );
    expect(screen.getByRole('checkbox', { name: /select all rows/i })).toBeInTheDocument();
  });

  it('row checkboxes have aria-label "Select row N"', () => {
    render(
      <DataGridTable {...getDataGridTableProps({ rowSelection: 'multiple' })} />
    );
    // Should have at least one row checkbox with proper label
    expect(screen.getByRole('checkbox', { name: /select row 1/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /select row 2/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /select row 3/i })).toBeInTheDocument();
  });
});

describe('Column resize handles ARIA', () => {
  it('resize handles have descriptive aria-label', () => {
    const { container } = render(<DataGridTable {...getDataGridTableProps()} />);
    const resizeHandles = container.querySelectorAll('[aria-label^="Resize"]');
    expect(resizeHandles.length).toBeGreaterThanOrEqual(2);
    const labels = Array.from(resizeHandles).map((el) => el.getAttribute('aria-label'));
    expect(labels).toContain('Resize Name');
    expect(labels).toContain('Resize Status');
  });
});

describe('OGrid top-level ARIA', () => {
  it('renders data grid region with accessible label', () => {
    const { container } = render(<OGrid {...getOGridProps()} />);
    const region = container.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
    const hasLabel =
      region?.hasAttribute('aria-label') || region?.hasAttribute('aria-labelledby');
    expect(hasLabel).toBe(true);
  });

  it('pagination controls are rendered as a navigation landmark or have accessible labels', () => {
    render(<OGrid {...getOGridProps({ defaultPageSize: 2 })} />);
    // Next/Prev page buttons should be accessible
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
  });

  it('column chooser button has accessible label', () => {
    render(<OGrid {...getOGridProps()} />);
    expect(screen.getByRole('button', { name: /column visibility/i })).toBeInTheDocument();
  });
});
