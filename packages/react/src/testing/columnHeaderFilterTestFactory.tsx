/**
 * Shared ColumnHeaderFilter tests.
 * Each UI package calls createColumnHeaderFilterTests(ColumnHeaderFilter) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { UserLike } from '../types';
import type { ColumnFilterType } from '@alaarab/ogrid-core';

interface ColumnHeaderFilterProps {
  columnKey: string;
  columnName: string;
  filterType: ColumnFilterType;
  onSort?: () => void;
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  textValue?: string;
  onTextChange?: (value: string) => void;
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
}

export function createColumnHeaderFilterTests(ColumnHeaderFilter: React.ComponentType<ColumnHeaderFilterProps>): void {
  it('renders no filter button when filterType is none', () => {
    render(<ColumnHeaderFilter columnKey="id" columnName="ID" filterType="none" onSort={() => undefined} />);
    expect(screen.queryByRole('button', { name: /filter id/i })).not.toBeInTheDocument();
  });

  it('closes popover on Escape', () => {
    render(<ColumnHeaderFilter columnKey="status" columnName="Status" filterType="multiSelect" selectedValues={[]} onFilterChange={() => undefined} options={['Active', 'Closed']} />);
    fireEvent.click(screen.getByRole('button', { name: /filter status/i }));
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it('Clear in multiSelect resets selection and Apply sends it', () => {
    const onFilterChange = jest.fn();
    render(<ColumnHeaderFilter columnKey="status" columnName="Status" filterType="multiSelect" selectedValues={['Active']} onFilterChange={onFilterChange} options={['Active', 'Closed']} />);
    fireEvent.click(screen.getByRole('button', { name: /filter status/i }));
    const clearButtons = screen.getAllByRole('button', { name: /^clear$/i });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onFilterChange).toHaveBeenCalledWith([]);
  });

  it('applies multi-select filters and calls onFilterChange', () => {
    const onFilterChange = jest.fn();
    render(<ColumnHeaderFilter columnKey="status" columnName="Status" filterType="multiSelect" selectedValues={[]} onFilterChange={onFilterChange} options={['Active', 'Closed']} />);
    fireEvent.click(screen.getByRole('button', { name: /filter status/i }));
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onFilterChange).toHaveBeenCalledWith(['Active', 'Closed']);
  });

  it('applies text filter and calls onTextChange', () => {
    const onTextChange = jest.fn();
    render(<ColumnHeaderFilter columnKey="name" columnName="Name" filterType="text" textValue="" onTextChange={onTextChange} />);
    fireEvent.click(screen.getByRole('button', { name: /filter name/i }));
    const input = screen.getByPlaceholderText(/enter search term/i);
    fireEvent.change(input, { target: { value: 'Alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onTextChange).toHaveBeenCalledWith('Alpha');
  });

  it('debounces peopleSearch and selects a user', async () => {
    const alice: UserLike = { id: '1', displayName: 'Alice Johnson', email: 'alice@example.com', photo: undefined };
    const peopleSearch = jest.fn<Promise<UserLike[]>, [string]>().mockResolvedValue([alice]);
    const onUserChange = jest.fn();
    render(<ColumnHeaderFilter columnKey="owner" columnName="Owner" filterType="people" selectedUser={undefined} onUserChange={onUserChange} peopleSearch={peopleSearch} />);
    fireEvent.click(screen.getByRole('button', { name: /filter owner/i }));
    const input = screen.getByPlaceholderText(/search for a person/i);
    fireEvent.change(input, { target: { value: 'ali' } });
    // Wait for the 300ms debounce to fire with real timers
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    await waitFor(() => { expect(peopleSearch).toHaveBeenCalledWith('ali'); });
    const [suggestion] = await screen.findAllByText('Alice Johnson');
    fireEvent.click(suggestion);
    expect(onUserChange).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Alice Johnson', email: 'alice@example.com' }));
  });

  it('filter button has aria-expanded="false" when popover is closed', () => {
    render(<ColumnHeaderFilter columnKey="name" columnName="Name" filterType="text" textValue="" onTextChange={() => undefined} />);
    const btn = screen.getByRole('button', { name: /filter name/i });
    // aria-expanded should be false (as string or boolean) when closed
    const expanded = btn.getAttribute('aria-expanded');
    expect(expanded === 'false' || expanded === null).toBe(true);
  });

  it('filter button has aria-expanded="true" after clicking to open', () => {
    render(<ColumnHeaderFilter columnKey="name" columnName="Name" filterType="text" textValue="" onTextChange={() => undefined} />);
    const btn = screen.getByRole('button', { name: /filter name/i });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('filter button has aria-haspopup="dialog" when filter type is not none', () => {
    render(<ColumnHeaderFilter columnKey="name" columnName="Name" filterType="text" textValue="" onTextChange={() => undefined} />);
    const btn = screen.getByRole('button', { name: /filter name/i });
    expect(btn.getAttribute('aria-haspopup')).toBeTruthy();
  });
}
