/**
 * Shared PaginationControls tests.
 * Each UI package calls createPaginationControlsTests(PaginationControls) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPaginationControlsTests(PaginationControls: React.ComponentType<any>): void {
  const renderControls = (overrides: Record<string, unknown> = {}) => {
    const props = {
      currentPage: 2,
      pageSize: 10,
      totalCount: 50,
      onPageChange: jest.fn(),
      onPageSizeChange: jest.fn(),
      ...overrides,
    };
    return render(<PaginationControls {...props} />);
  };

  it('returns null when totalCount is 0', () => {
    const { container } = renderControls({ totalCount: 0 });
    expect(container.firstChild).toBeNull();
  });

  it('renders summary text and page buttons', () => {
    renderControls();
    expect(screen.getByText(/Showing 11 to 20 of 50 items/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('disables first and previous on first page', () => {
    renderControls({ currentPage: 1, totalCount: 50 });
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('disables last and next on last page', () => {
    renderControls({ currentPage: 5, pageSize: 10, totalCount: 50 });
    expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('calls onPageChange for navigation buttons', () => {
    const onPageChange = jest.fn();
    renderControls({ onPageChange });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageSizeChange when page size is changed', () => {
    const onPageSizeChange = jest.fn();
    renderControls({ onPageSizeChange });
    const select = screen.getByLabelText('Rows per page');
    fireEvent.change(select, { target: { value: '20' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });
}
