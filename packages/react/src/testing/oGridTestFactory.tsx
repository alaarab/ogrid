/**
 * Shared OGrid (top-level component) tests.
 * Each UI package calls createOGridTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { fixtureRows, fixtureColumns, getRowId } from './fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createOGridTests(OGrid: React.ComponentType<any>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderOGrid(overrides: Record<string, any> = {}) {
    const defaultProps = {
      data: fixtureRows,
      columns: fixtureColumns,
      getRowId,
      entityLabelPlural: 'items',
      defaultPageSize: 10,
    };
    return render(<OGrid {...defaultProps} {...overrides} />);
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
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Beta']);
  });

  it('sort change updates order', () => {
    renderOGrid();
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
    const sortButton = screen.getByRole('button', { name: /sort by name/i });
    fireEvent.click(sortButton);
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Gamma', 'Beta', 'Alpha']);
    fireEvent.click(sortButton);
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
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
    fireEvent.click(filterCheckboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Gamma']);
    fireEvent.click(screen.getByRole('button', { name: /sort by name/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Gamma', 'Alpha']);
    fireEvent.click(screen.getByRole('button', { name: /sort by name/i }));
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual(['Alpha', 'Gamma']);
    const rowsSelect = screen.getByLabelText('Rows per page');
    fireEvent.change(rowsSelect, { target: { value: '50' } });
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByLabelText('Status'));
    expect(screen.queryByTestId('cell-status')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('cell-name')).toHaveLength(2);
  });
}
