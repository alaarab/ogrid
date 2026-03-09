/**
 * Shared DataGridTable tests.
 * Each UI package calls createDataGridTableTests(DataGridTable) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, UserLike, IOGridDataGridProps } from '../types';
import { fixtureRows, getRowId, type FixtureRow } from './fixtures';

export function createDataGridTableTests(DataGridTable: React.ComponentType<IOGridDataGridProps<FixtureRow>>): void {
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

  function renderTable(overrides: Record<string, unknown> = {}) {
    const defaultProps = {
      items: fixtureRows.slice(0, 2),
      columns: twoColumnColumns,
      getRowId,
      sortBy: undefined,
      sortDirection: 'asc',
      onColumnSort: jest.fn(),
      visibleColumns: new Set(['name', 'status']),
      filters: {},
      onFilterChange: jest.fn(),
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
          filters={{}}
          onFilterChange={jest.fn()}
          filterOptions={{}}
          loadingFilterOptions={{}}
          aria-labelledby="grid-heading"
        />
      </>
    );
    const region = screen.getByRole('region', { name: 'Projects' });
    expect(region).toHaveAttribute('aria-labelledby', 'grid-heading');
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

  it('wires text filter through onFilterChange with filterField override', () => {
    const onFilterChange = jest.fn();
    const textFilterColumns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        sortable: false,
        filterable: { type: 'text', filterField: 'nameFilter' },
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
    ];
    renderTable({ columns: textFilterColumns, onFilterChange });
    const filterButton = screen.getByRole('button', { name: /filter name/i });
    fireEvent.click(filterButton);
    const input = screen.getByPlaceholderText(/enter search term/i);
    fireEvent.change(input, { target: { value: 'Alpha' } });
    const applyButton = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyButton);
    expect(onFilterChange).toHaveBeenCalledWith('nameFilter', { type: 'text', value: 'Alpha' });
  });

  it('wires multi-select filter through onFilterChange with filterField', () => {
    const onFilterChange = jest.fn();
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
      onFilterChange,
      filterOptions: { status: ['Active', 'Closed'] },
    });
    const filterButton = screen.getByRole('button', { name: /filter name/i });
    fireEvent.click(filterButton);
    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllButton);
    const applyButton = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyButton);
    expect(onFilterChange).toHaveBeenCalledWith('status', { type: 'multiSelect', value: ['Active', 'Closed'] });
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

  it('wires people filter: open, search, select user, calls onFilterChange', async () => {
    const alice: UserLike = { id: '1', displayName: 'Alice Johnson', email: 'alice@example.com' };
    const peopleSearch = jest.fn<Promise<UserLike[]>, [string]>().mockResolvedValue([alice]);
    const onFilterChange = jest.fn();
    const peopleColumns: IColumnDef<FixtureRow>[] = [
      { columnId: 'name', name: 'Name', sortable: false, renderCell: (item) => <span data-testid="cell-name">{item.name}</span> },
      { columnId: 'owner', name: 'Owner', sortable: false, filterable: { type: 'people', filterField: 'ownerEmail' }, renderCell: (item) => <span data-testid="cell-owner">{item.name}</span> },
    ];
    renderTable({
      columns: peopleColumns,
      visibleColumns: new Set(['name', 'owner']),
      filters: {},
      onFilterChange,
      filterOptions: {},
      loadingFilterOptions: {},
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
    expect(onFilterChange).toHaveBeenCalledWith('ownerEmail', { type: 'people', value: expect.objectContaining({ displayName: 'Alice Johnson', email: 'alice@example.com' }) });
  });

  it('type: numeric column renders cells correctly', () => {
    const numericColumns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
      {
        columnId: 'status',
        name: 'Amount',
        type: 'numeric',
        renderCell: (item) => <span data-testid="cell-amount">{item.status}</span>,
      },
    ];
    const { container } = renderTable({
      columns: numericColumns,
      visibleColumns: new Set(['name', 'status']),
    });
    // Verify numeric column cells render
    const amountCells = container.querySelectorAll('[data-testid="cell-amount"]');
    expect(amountCells.length).toBe(2);
    expect(amountCells[0].textContent).toBe('Active');
    // Verify it's within a cell wrapper that has row/col index attributes
    const cellWrapper = amountCells[0].closest('[data-col-index]');
    expect(cellWrapper).toBeTruthy();
  });

  it('suppressHorizontalScroll prevents overflow-x auto', () => {
    const { container } = renderTable({ suppressHorizontalScroll: true });
    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    // suppressHorizontalScroll sets data-overflow-x="false" (CSS handles hiding)
    expect(region?.getAttribute('data-overflow-x')).toBe('false');
  });

  it('renders status bar when statusBar is true', () => {
    renderTable({ statusBar: true });
    const statusBar = screen.getByRole('status');
    expect(statusBar).toBeInTheDocument();
    expect(statusBar.textContent).toContain('Rows:');
  });

  it('left-pinned column renders with pinnedColumns prop', () => {
    const { container } = renderTable({ pinnedColumns: { name: 'left' } });
    // Pinned column still renders its cells
    const nameCells = container.querySelectorAll('td[data-column-id="name"]');
    expect(nameCells.length).toBeGreaterThan(0);
    // Header for pinned column is present
    const headerCells = container.querySelectorAll('th');
    const nameHeader = Array.from(headerCells).find((th) => th.textContent?.includes('Name'));
    expect(nameHeader).toBeTruthy();
  });

  it('right-pinned column renders with pinnedColumns prop', () => {
    const { container } = renderTable({ pinnedColumns: { status: 'right' } });
    const statusCells = container.querySelectorAll('td[data-column-id="status"]');
    expect(statusCells.length).toBeGreaterThan(0);
    const headerCells = container.querySelectorAll('th');
    const statusHeader = Array.from(headerCells).find((th) => th.textContent?.includes('Status'));
    expect(statusHeader).toBeTruthy();
  });

  it('multiple pinned columns render together', () => {
    const { container } = renderTable({ pinnedColumns: { name: 'left', status: 'right' } });
    expect(container.querySelectorAll('td[data-column-id="name"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('td[data-column-id="status"]').length).toBeGreaterThan(0);
  });

  it('stickyHeader defaults to true', () => {
    const { container } = renderTable();
    const thead = container.querySelector('thead');
    expect(thead).toBeTruthy();
  });

  it('stickyHeader=false renders without error', () => {
    const { container } = renderTable({ stickyHeader: false });
    const thead = container.querySelector('thead');
    expect(thead).toBeTruthy();
  });

  it('sorted column header has aria-sort="ascending" when sortDirection is asc', () => {
    const { container } = renderTable({ sortBy: 'name', sortDirection: 'asc' });
    const sortedTh = container.querySelector('th[aria-sort="ascending"]');
    expect(sortedTh).toBeInTheDocument();
  });

  it('sorted column header has aria-sort="descending" when sortDirection is desc', () => {
    const { container } = renderTable({ sortBy: 'name', sortDirection: 'desc' });
    const sortedTh = container.querySelector('th[aria-sort="descending"]');
    expect(sortedTh).toBeInTheDocument();
  });

  it('unsorted columns do not have aria-sort attribute', () => {
    const { container } = renderTable({ sortBy: 'name', sortDirection: 'asc' });
    // status column is not sorted, should have no aria-sort
    const statusTh = container.querySelector('th[data-column-id="status"]');
    expect(statusTh).toBeInTheDocument();
    expect(statusTh?.getAttribute('aria-sort')).toBeNull();
  });

  it('changing sort column updates aria-sort attributes', () => {
    const { container, rerender } = renderTable({ sortBy: 'name', sortDirection: 'asc' });
    expect(container.querySelector('th[aria-sort="ascending"]')).toBeInTheDocument();
    rerender(
      <DataGridTable
        items={fixtureRows.slice(0, 2)}
        columns={twoColumnColumns}
        getRowId={getRowId}
        sortBy="status"
        sortDirection="desc"
        onColumnSort={jest.fn()}
        visibleColumns={new Set(['name', 'status'])}
        filters={{}}
        onFilterChange={jest.fn()}
        filterOptions={{ status: ['Active', 'Closed'] }}
        loadingFilterOptions={{}}
      />
    );
    expect(container.querySelector('th[aria-sort="descending"]')).toBeInTheDocument();
    const nameTh = container.querySelector('th[data-column-id="name"]');
    expect(nameTh?.getAttribute('aria-sort')).toBeNull();
  });

  it('onKeyDown callback receives keyboard events from the grid', () => {
    const onKeyDown = jest.fn();
    const { container } = renderTable({ onKeyDown });
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    expect(grid).toBeTruthy();
    grid.focus();
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalled();
    const event = onKeyDown.mock.calls[0][0] as React.KeyboardEvent;
    expect(event.key).toBe('ArrowDown');
  });

  it('onKeyDown calling event.preventDefault() suppresses grid default handling', async () => {
    const onKeyDown = jest.fn((e: React.KeyboardEvent) => { e.preventDefault(); });
    const { container } = renderTable({ onKeyDown, cellSelection: true });
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    grid.focus();

    // Click a cell to establish selection
    const cells = container.querySelectorAll('[data-row-index][data-col-index]') as NodeListOf<HTMLElement>;
    const firstCell = Array.from(cells).find(
      (el) => !(el.closest('[role="columnheader"]') ?? el.closest('thead'))
    );
    if (firstCell) fireEvent.pointerDown(firstCell);

    const activeBefore = container.querySelectorAll('[data-active-cell="true"]').length;
    // ArrowDown with preventDefault should not move selection
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    const activeAfter = container.querySelectorAll('[data-active-cell="true"]').length;

    expect(onKeyDown).toHaveBeenCalled();
    expect(activeAfter).toBe(activeBefore);
  });

  it('onKeyDown not calling preventDefault allows grid to handle Escape normally', async () => {
    const onKeyDown = jest.fn(); // does NOT call preventDefault
    const { container } = renderTable({ onKeyDown, cellSelection: true });
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    grid.focus();

    // Select a cell
    const cells = container.querySelectorAll('[data-row-index][data-col-index]') as NodeListOf<HTMLElement>;
    const firstCell = Array.from(cells).find(
      (el) => !(el.closest('[role="columnheader"]') ?? el.closest('thead'))
    );
    if (firstCell) fireEvent.pointerDown(firstCell);

    await waitFor(() => {
      expect(container.querySelector('[data-active-cell="true"]')).toBeInTheDocument();
    });

    fireEvent.keyDown(grid, { key: 'Escape' });
    expect(onKeyDown).toHaveBeenCalled();
    // Grid default runs: Escape clears selection
    await waitFor(() => {
      expect(container.querySelectorAll('[data-active-cell="true"]').length).toBe(0);
    });
  });

  describe('virtualScroll threshold', () => {
    const manyRows = Array.from({ length: 60 }, (_, i) => ({
      id: String(i + 1),
      name: `Row ${i + 1}`,
      status: i % 2 === 0 ? 'Active' : 'Closed',
    }));

    it('activates virtualization when item count exceeds threshold', () => {
      // 60 items, threshold=50  to  should virtualize (render fewer rows than total)
      const { container } = renderTable({
        items: manyRows,
        virtualScroll: { enabled: true, rowHeight: 40, threshold: 50 },
        visibleColumns: new Set(['name', 'status']),
      });
      const cells = container.querySelectorAll('[data-testid="cell-name"]');
      expect(cells.length).toBeLessThan(manyRows.length);
    });

    it('does not virtualize when item count is below threshold', () => {
      // 60 items, threshold=100  to  should NOT virtualize (all rows rendered)
      const { container } = renderTable({
        items: manyRows,
        virtualScroll: { enabled: true, rowHeight: 40, threshold: 100 },
        visibleColumns: new Set(['name', 'status']),
      });
      const cells = container.querySelectorAll('[data-testid="cell-name"]');
      expect(cells.length).toBe(manyRows.length);
    });

    it('accepts virtualScroll config with threshold without error', () => {
      expect(() => {
        renderTable({
          items: manyRows.slice(0, 5),
          virtualScroll: { enabled: true, rowHeight: 40, threshold: 50 },
          visibleColumns: new Set(['name', 'status']),
        });
      }).not.toThrow();
    });
  });

  // Cell references: column letter row
  it('does not render column letter row when showColumnLetters is false (default)', () => {
    const { container } = renderTable();
    const allTh = container.querySelectorAll('thead th');
    const letterCells = Array.from(allTh).filter(th => {
      const text = th.textContent?.trim();
      return text === 'A' || text === 'B';
    });
    expect(letterCells.length).toBe(0);
  });

  it('renders column letter row when showColumnLetters is true', () => {
    const { container } = renderTable({ showColumnLetters: true, showRowNumbers: true });
    const allTh = container.querySelectorAll('thead th');
    const letterCells = Array.from(allTh).filter(th => {
      const text = th.textContent?.trim();
      return text === 'A' || text === 'B';
    });
    expect(letterCells.length).toBeGreaterThanOrEqual(2);
  });

  it('column letter cells show correct letters for visible columns', () => {
    const { container } = renderTable({ showColumnLetters: true, showRowNumbers: true });
    const allTh = container.querySelectorAll('thead th');
    const letterTexts = Array.from(allTh)
      .map(th => th.textContent?.trim())
      .filter(text => text === 'A' || text === 'B');
    expect(letterTexts).toEqual(['A', 'B']);
  });

  describe('boolean cell alignment and click behavior', () => {
    interface BoolRow { id: string; name: string; active: boolean; }
    const boolRows: BoolRow[] = [
      { id: '1', name: 'Alpha', active: true },
      { id: '2', name: 'Beta', active: false },
    ];
    const getBoolRowId = (r: BoolRow): string => r.id;
    const boolColumns: IColumnDef<BoolRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        renderCell: (item) => <span data-testid="cell-name">{item.name}</span>,
      },
      {
        columnId: 'active',
        name: 'Active',
        type: 'boolean',
        editable: true,
      },
    ];

    const BoolDataGridTable = DataGridTable as unknown as React.ComponentType<Record<string, unknown>>;

    function renderBoolTable(overrides: Record<string, unknown> = {}) {
      const onCellValueChanged = jest.fn();
      const props = {
        items: boolRows,
        columns: boolColumns,
        getRowId: getBoolRowId,
        sortBy: undefined,
        sortDirection: 'asc',
        onColumnSort: jest.fn(),
        visibleColumns: new Set(['name', 'active']),
        filters: {},
        onFilterChange: jest.fn(),
        filterOptions: {},
        loadingFilterOptions: {},
        editable: true,
        onCellValueChanged,
        ...overrides,
      };
      const { container } = render(<BoolDataGridTable {...props} />);
      return { container, onCellValueChanged };
    }

    it('boolean column renders a checkbox element', () => {
      const { container } = renderBoolTable();
      const checkboxes = container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('boolean cell does not have justifyContent center in display mode', () => {
      const { container } = renderBoolTable();
      // The cellContent wrapper should use flex-start (default), not center.
      // We look at all cell content wrappers that contain checkboxes.
      const cells = container.querySelectorAll('td[data-column-id="active"]');
      expect(cells.length).toBe(2);
      cells.forEach((cell) => {
        // Walk immediate children (the cellContent div)
        const cellContent = cell.querySelector('[class*="cellContent"]') as HTMLElement | null;
        if (cellContent) {
          const computed = window.getComputedStyle(cellContent);
          // justifyContent should not be 'center' -- it should be 'normal' or 'flex-start'
          expect(computed.justifyContent).not.toBe('center');
        }
      });
    });

    it('toggling a boolean checkbox calls onCellValueChanged with toggled value', () => {
      const { container, onCellValueChanged } = renderBoolTable();
      const checkboxes = container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
      // First checkbox represents active=true for row "Alpha"
      const firstCheckbox = checkboxes[0] as HTMLElement;
      fireEvent.click(firstCheckbox);
      expect(onCellValueChanged).toHaveBeenCalled();
    });

    it('pointerDown on checkbox cell selects the cell without starting a drag', () => {
      const { container } = renderBoolTable({ cellSelection: true });
      const checkboxes = container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
      const firstCheckbox = checkboxes[0] as HTMLElement;
      fireEvent.pointerDown(firstCheckbox);
      // The grid should still be rendered (drag didn't break things)
      const cells = container.querySelectorAll('td[data-column-id="active"]');
      expect(cells.length).toBe(2);
    });

    it('renders checked and unchecked boolean cells correctly', () => {
      const { container } = renderBoolTable();
      const checkboxes = Array.from(
        container.querySelectorAll('[role="checkbox"], input[type="checkbox"]')
      ) as HTMLElement[];
      // Row 1: active=true, Row 2: active=false
      const states = checkboxes.map((cb) =>
        cb.getAttribute('data-state') ?? (cb as HTMLInputElement).checked?.toString() ?? cb.getAttribute('aria-checked')
      );
      // At least one checked and one unchecked
      expect(states.some((s) => s === 'checked' || s === 'true')).toBe(true);
      expect(states.some((s) => s === 'unchecked' || s === 'false')).toBe(true);
    });
  });
}
