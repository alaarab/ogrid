import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SideBar, type SideBarProps } from '../SideBar';
import type { IFilters, FilterValue } from '../../types';

function baseProps(overrides: Partial<SideBarProps> = {}): SideBarProps {
  return {
    activePanel: 'filters',
    onPanelChange: jest.fn(),
    panels: ['columns', 'filters'],
    position: 'right',
    columns: [],
    visibleColumns: new Set<string>(),
    onVisibilityChange: jest.fn(),
    onSetVisibleColumns: jest.fn(),
    filterableColumns: [
      { columnId: 'name', name: 'Name', filterField: 'name', filterType: 'text' },
      { columnId: 'owner', name: 'Owner', filterField: 'owner', filterType: 'people' },
    ],
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: {},
    ...overrides,
  };
}

describe('SideBar filters panel', () => {
  it('omits people columns that have no control in the panel', () => {
    render(<SideBar {...baseProps()} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });

  it('debounces text filter changes and commits a trimmed value', async () => {
    const onFilterChange = jest.fn();
    render(<SideBar {...baseProps({ onFilterChange })} />);
    const input = screen.getByLabelText('Filter Name');

    fireEvent.change(input, { target: { value: '  Alpha  ' } });
    fireEvent.change(input, { target: { value: '  Alpha B  ' } });
    expect(onFilterChange).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith('name', { type: 'text', value: 'Alpha B' });
  });

  it('does not activate a filter for whitespace-only input', async () => {
    const onFilterChange = jest.fn();
    render(<SideBar {...baseProps({ onFilterChange })} />);
    const input = screen.getByLabelText('Filter Name');

    fireEvent.change(input, { target: { value: '   ' } });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(onFilterChange).not.toHaveBeenCalled();
  });

  it('keeps an externally cleared filter cleared and preserves a trailing space while typing', async () => {
    const onFilterChange = jest.fn();
    function Host(): React.ReactElement {
      const [filters, setFilters] = React.useState<IFilters>({});
      const handleChange = (key: string, value: FilterValue | undefined) => {
        onFilterChange(key, value);
        setFilters(value ? { [key]: value } : {});
      };
      return (
        <>
          <button type="button" onClick={() => setFilters({})}>Clear all</button>
          <SideBar {...baseProps({ filters, onFilterChange: handleChange })} />
        </>
      );
    }
    render(<Host />);
    const input = screen.getByLabelText('Filter Name') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Alpha ' } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(onFilterChange).toHaveBeenLastCalledWith('name', { type: 'text', value: 'Alpha' });
    expect(input.value).toBe('Alpha ');

    fireEvent.click(screen.getByText('Clear all'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(input.value).toBe('');
    expect(onFilterChange).toHaveBeenCalledTimes(1);
  });
});
