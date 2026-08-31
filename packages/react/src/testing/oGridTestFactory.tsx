/**
 * Shared OGrid (top-level component) tests.
 * Each UI package calls createOGridTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { fixtureRows, fixtureColumns, getRowId } from './fixtures';
import type { IOGridProps } from '../types';
import type { FixtureRow } from './fixtures';

export function createOGridTests(OGrid: React.ComponentType<IOGridProps<FixtureRow>>): void {
  function renderOGrid(overrides: Partial<IOGridProps<FixtureRow>> = {}) {
    const defaultProps = {
      data: fixtureRows,
      columns: fixtureColumns,
      getRowId,
      entityLabelPlural: 'items',
      defaultPageSize: 10,
    };
    // Merge before the JSX spread: IOGridProps is a client/server
    // discriminated union and spreading two partials defeats the narrowing.
    const props = { ...defaultProps, ...overrides } as IOGridProps<FixtureRow>;
    return render(<OGrid {...props} />);
  }

  it('renders rows from items', () => {
    renderOGrid();
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(screen.getAllByTestId('cell-status').map((el) => el.textContent)).toEqual(['Active', 'Closed', 'Active']);
  });

  it('uses defaultSortBy and defaultSortDirection', () => {
    renderOGrid({ defaultSortBy: 'name', defaultSortDirection: 'desc' });
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('filtering reduces visible rows', () => {
    renderOGrid({ defaultPageSize: 10 });
    const filterButton = screen.getByRole('button', { name: /filter status/i });
    fireEvent.click(filterButton);
    // Select only "Closed": use Select all, then deselect "Active" via checkbox
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    // Deselect "Active" by clicking its checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    // First non-"select all" checkbox is "Active"
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Beta']);
  });

  it('pagination shows correct slice', () => {
    renderOGrid({ defaultPageSize: 2 });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
    expect(screen.getByText(/Showing 1 to 2 of 3 items/i)).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextButton);
    expect(screen.getAllByTestId('cell-name')).toHaveLength(1);
    expect(screen.getByText(/Showing 3 to 3 of 3 items/i)).toBeInTheDocument();
  });

  it("selecting All in the page-size dropdown shows every row", () => {
    renderOGrid({ defaultPageSize: 2, pageSizeOptions: [2, 'all'] });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: 'all' } });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(3);
    expect(screen.getByText(/Showing 1 to 3 of 3 items/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
  });

  it("defaultPageSize 'all' renders every row from the first paint", () => {
    renderOGrid({ defaultPageSize: 'all', pageSizeOptions: [10, 'all'] });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(3);
    expect(screen.getByText(/Showing 1 to 3 of 3 items/i)).toBeInTheDocument();
  });

  it("pageSize 'all' tracks a shrinking filtered dataset", () => {
    renderOGrid({ defaultPageSize: 'all', pageSizeOptions: [10, 'all'] });
    fireEvent.click(screen.getByRole('button', { name: /filter status/i }));
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!); // deselect "Active", leaving only "Closed"
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Beta']);
    expect(screen.getByText(/Showing 1 to 1 of 1 items/i)).toBeInTheDocument();
  });

  it('column visibility toggles columns', () => {
    renderOGrid();
    expect(screen.getAllByTestId('cell-status')).toHaveLength(3);
    const columnVisibilityButton = screen.getByRole('button', { name: /column visibility/i });
    fireEvent.click(columnVisibilityButton);
    const statusCheckbox = screen.getByLabelText('Status');
    fireEvent.click(statusCheckbox);
    expect(screen.queryAllByTestId('cell-status')).toHaveLength(0);
    expect(screen.getAllByTestId('cell-name')).toHaveLength(3);
  });

  it('hides column chooser when columnChooser={false}', () => {
    renderOGrid({ columnChooser: false });
    expect(screen.queryByRole('button', { name: /column visibility/i })).not.toBeInTheDocument();
  });

  it('hides column chooser from toolbar when columnChooser="sidebar"', () => {
    renderOGrid({ columnChooser: 'sidebar' });
    expect(screen.queryByRole('button', { name: /column visibility/i })).not.toBeInTheDocument();
  });

  it('shows column chooser by default (columnChooser unset)', () => {
    renderOGrid();
    expect(screen.getByRole('button', { name: /column visibility/i })).toBeInTheDocument();
  });

  it('integration: filter reduces rows, sort changes order, page size changes row count, column hide hides column', () => {
    renderOGrid({ defaultPageSize: 2 });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
    expect(screen.getAllByTestId('cell-status')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /filter status/i }));
    // Select only "Active": use Select all, then deselect "Closed" via checkbox
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    const filterCheckboxes = screen.getAllByRole('checkbox');
    // Second checkbox is "Closed"
    fireEvent.click(filterCheckboxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Gamma']);
    const rowsSelect = screen.getByLabelText('Rows per page');
    fireEvent.change(rowsSelect, { target: { value: '50' } });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByLabelText('Status'));
    expect(screen.queryByTestId('cell-status')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
  });

  it('fullScreen=true renders a fullscreen toggle button', () => {
    renderOGrid({ fullScreen: true });
    expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
  });

  it('fullScreen=false (default) does not render fullscreen button', () => {
    renderOGrid();
    expect(screen.queryByRole('button', { name: /fullscreen/i })).not.toBeInTheDocument();
  });

  it('clicking fullscreen button toggles to fullscreen mode', () => {
    const { container } = renderOGrid({ fullScreen: true });
    const btn = screen.getByRole('button', { name: /fullscreen/i });
    fireEvent.click(btn);
    // After entering fullscreen, button label changes to "Exit fullscreen"
    expect(screen.getByRole('button', { name: /exit fullscreen/i })).toBeInTheDocument();
    // Container style should change to fixed positioning
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.position).toBe('fixed');
  });

  it('clicking fullscreen button again exits fullscreen', () => {
    const { container } = renderOGrid({ fullScreen: true });
    const btn = screen.getByRole('button', { name: /fullscreen/i });
    // Enter fullscreen
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /exit fullscreen/i })).toBeInTheDocument();
    // Exit fullscreen
    fireEvent.click(screen.getByRole('button', { name: /exit fullscreen/i }));
    expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.position).not.toBe('fixed');
  });

  it('Escape key exits fullscreen mode', () => {
    renderOGrid({ fullScreen: true });
    const btn = screen.getByRole('button', { name: /fullscreen/i });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /exit fullscreen/i })).toBeInTheDocument();
    // Press Escape to exit fullscreen
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
  });

  it('cellReferences=true renders column letters, row numbers, and name box', () => {
    const { container } = renderOGrid({ cellReferences: true });
    // Column letters should be present
    const allTh = container.querySelectorAll('thead th');
    const letterCells = Array.from(allTh).filter(th => {
      const text = th.textContent?.trim();
      return text === 'A' || text === 'B';
    });
    expect(letterCells.length).toBeGreaterThanOrEqual(2);
    // Name box should render with aria-label
    const nameBox = container.querySelector('[aria-label="Active cell reference"]');
    expect(nameBox).toBeInTheDocument();
    // Name box should show em dash when no cell is active
    expect(nameBox?.textContent).toBe('\u2014');
  });

  it('cellReferences=false (default) does not render column letters or name box', () => {
    const { container } = renderOGrid();
    const nameBox = container.querySelector('[aria-label="Active cell reference"]');
    expect(nameBox).not.toBeInTheDocument();
  });

  it('showRowNumbers=true without cellReferences does not render column letters or name box', () => {
    const { container } = renderOGrid({ showRowNumbers: true });
    const nameBox = container.querySelector('[aria-label="Active cell reference"]');
    expect(nameBox).not.toBeInTheDocument();
    // Row numbers header "#" should be present in thead
    const allTh = container.querySelectorAll('thead th');
    const hashHeader = Array.from(allTh).find(th => th.textContent?.trim() === '#');
    expect(hashHeader).toBeTruthy();
  });
}
