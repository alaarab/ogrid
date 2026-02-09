/**
 * Shared DataGridTable tests.
 * Each UI package calls createDataGridTableTests(DataGridTable) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, UserLike } from '../types';
import { fixtureRows, getRowId, type FixtureRow } from './fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDataGridTableTests(DataGridTable: React.ComponentType<any>): void {
  const twoColumnColumns: IColumnDef<FixtureRow>[] = [
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderTable(overrides: Record<string, any> = {}) {
    const defaultProps = {
      items: fixtureRows.slice(0, 2),
      columns: twoColumnColumns,
      getRowId,
      sortBy: undefined,
      sortDirection: 'asc',
      onColumnSort: jest.fn(),
      visibleColumns: new Set(['name', 'status']),
      multiSelectFilters: {},
      onMultiSelectFilterChange: jest.fn(),
      textFilters: {},
      onTextFilterChange: jest.fn(),
      peopleFilters: {},
      onPeopleFilterChange: jest.fn(),
      filterOptions: { status: ['Active', 'Closed'] },
      loadingFilterOptions: {},
    };
    return render(<DataGridTable {...defaultProps} {...overrides} />);
  }

  it('renders rows and cells for visible columns', () => {
    renderTable();
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Beta']);
    expect(screen.getAllByTestId('cell-status').map((el) => el.textContent)).toEqual(['Active', 'Closed']);
  });

  it('hides columns not in visibleColumns', () => {
    renderTable({ visibleColumns: new Set(['name']) });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
    expect(screen.queryByTestId('cell-status')).not.toBeInTheDocument();
  });

  it('sets aria-label when provided', () => {
    const { container } = renderTable({ 'aria-label': 'Projects grid' });
    const region = container.querySelector('[role="region"][aria-label="Projects grid"]');
    expect(region).toBeInTheDocument();
  });

  it('sets aria-labelledby when provided', () => {
    render(
      <>
        <h2 id="grid-heading">Projects</h2>
        <DataGridTable
          items={fixtureRows.slice(0, 2)}
          columns={twoColumnColumns}
          getRowId={getRowId}
          sortBy={undefined}
          sortDirection="asc"
          onColumnSort={jest.fn()}
          visibleColumns={new Set(['name', 'status'])}
          multiSelectFilters={{}}
          onMultiSelectFilterChange={jest.fn()}
          filterOptions={{}}
          loadingFilterOptions={{}}
          aria-labelledby="grid-heading"
        />
      </>
    );
    const region = screen.getByRole('region', { name: 'Projects' });
    expect(region).toHaveAttribute('aria-labelledby', 'grid-heading');
  });

  it('calls onColumnSort when header clicked for sortable column', () => {
    const onColumnSort = jest.fn();
    renderTable({ onColumnSort });
    const headerButton = screen.getByRole('button', { name: /sort by name/i });
    fireEvent.click(headerButton);
    expect(onColumnSort).toHaveBeenCalledWith('name');
  });

  it('shows empty state when no items and emptyState provided', () => {
    const onClearAll = jest.fn();
    renderTable({
      items: [],
      emptyState: { hasActiveFilters: true, onClearAll },
    });
    expect(screen.getByText(/No results found/i)).toBeInTheDocument();
    const clearButton = screen.getByRole('button', { name: /clear all filters/i });
    fireEvent.click(clearButton);
    expect(onClearAll).toHaveBeenCalled();
  });

  it('wires text filter through onTextFilterChange with filterField override', () => {
    const onTextFilterChange = jest.fn();
    const textFilterColumns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        sortable: false,
        filterable: { type: 'text', filterField: 'nameFilter' },
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
    ];
    renderTable({ columns: textFilterColumns, onTextFilterChange });
    const filterButton = screen.getByRole('button', { name: /filter name/i });
    fireEvent.click(filterButton);
    const input = screen.getByPlaceholderText(/enter search term/i);
    fireEvent.change(input, { target: { value: 'Alpha' } });
    const applyButton = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyButton);
    expect(onTextFilterChange).toHaveBeenCalledWith('nameFilter', 'Alpha');
  });

  it('wires multi-select filter through onMultiSelectFilterChange with filterField', () => {
    const onMultiSelectFilterChange = jest.fn();
    const statusColumns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        sortable: false,
        filterable: { type: 'multiSelect', filterField: 'status' },
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
    ];
    renderTable({
      columns: statusColumns,
      visibleColumns: new Set(['name']),
      onMultiSelectFilterChange,
      filterOptions: { status: ['Active', 'Closed'] },
    });
    const filterButton = screen.getByRole('button', { name: /filter name/i });
    fireEvent.click(filterButton);
    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllButton);
    const applyButton = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyButton);
    expect(onMultiSelectFilterChange).toHaveBeenCalledWith('status', ['Active', 'Closed']);
  });

  it('renders with editable columns and onCellValueChanged (editable smoke)', () => {
    const onCellValueChanged = jest.fn();
    const editableColumns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        editable: true,
        cellEditor: 'text',
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
      {
        columnId: 'status',
        name: 'Status',
        renderCell: (item) => <span data-testid="cell-status">{item.status}</span>,
      },
    ];
    renderTable({
      columns: editableColumns,
      visibleColumns: new Set(['name', 'status']),
      editable: true,
      onCellValueChanged,
    });
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Beta']);
    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('does not make cells editable when onCellValueChanged is not provided', () => {
    const editableColumns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        editable: true,
        cellEditor: 'text',
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
    ];
    renderTable({
      columns: editableColumns,
      visibleColumns: new Set(['name']),
      editable: true,
    });
    const nameCells = screen.getAllByTestId('cell-name');
    expect(nameCells[0]).toHaveTextContent('Alpha');
  });

  it('wires people filter: open, search, select user, calls onPeopleFilterChange', async () => {
    const alice: UserLike = { id: '1', displayName: 'Alice Johnson', email: 'alice@example.com' };
    const peopleSearch = jest.fn<Promise<UserLike[]>, [string]>().mockResolvedValue([alice]);
    const onPeopleFilterChange = jest.fn();
    const peopleColumns: IColumnDef<FixtureRow>[] = [
      { columnId: 'name', name: 'Name', sortable: false, renderCell: (item) => <span data-testid="cell-name">{item.name}</span> },
      { columnId: 'owner', name: 'Owner', sortable: false, filterable: { type: 'people', filterField: 'ownerEmail' }, renderCell: (item) => <span data-testid="cell-owner">{item.name}</span> },
    ];
    renderTable({
      columns: peopleColumns,
      visibleColumns: new Set(['name', 'owner']),
      multiSelectFilters: {},
      onMultiSelectFilterChange: jest.fn(),
      filterOptions: {},
      loadingFilterOptions: {},
      peopleFilters: {},
      onPeopleFilterChange,
      peopleSearch,
    });
    const filterButton = screen.getByRole('button', { name: /filter owner/i });
    fireEvent.click(filterButton);
    const input = screen.getByPlaceholderText(/search for a person/i);
    fireEvent.change(input, { target: { value: 'ali' } });
    // Wait for the 300ms debounce to fire with real timers
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    await waitFor(() => { expect(peopleSearch).toHaveBeenCalledWith('ali'); });
    const suggestion = await screen.findByText('Alice Johnson');
    fireEvent.click(suggestion);
    expect(onPeopleFilterChange).toHaveBeenCalledWith('ownerEmail', expect.objectContaining({ displayName: 'Alice Johnson', email: 'alice@example.com' }));
  });
}
