import { renderHook } from '@testing-library/react';
import { useHeaderFilterConfigs } from '../useHeaderFilterConfigs';
import type { HeaderFilterConfigInput } from '../../utils';
import type { IColumnDef } from '../../types';

type Row = { name: string; status: string };

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } },
];

const onColumnSort = jest.fn();
const onFilterChange = jest.fn();

function makeInput(overrides: Partial<HeaderFilterConfigInput> = {}): HeaderFilterConfigInput {
  return {
    sortBy: undefined,
    sortDirection: 'asc',
    onColumnSort,
    filters: {},
    onFilterChange,
    filterOptions: {},
    loadingFilterOptions: {},
    ...overrides,
  };
}

// D11: every grid render used to hand each ColumnHeaderFilter fresh closures
// (and a fresh `selectedValues: []`), so its React.memo never bailed out.
describe('useHeaderFilterConfigs', () => {
  it('keeps every config identity when the grid re-renders with an equal (new) filter input', () => {
    const { result, rerender } = renderHook(({ input }) => useHeaderFilterConfigs(columns, input), {
      initialProps: { input: makeInput() },
    });
    const first = result.current;
    rerender({ input: makeInput() });
    expect(result.current.get('name')).toBe(first.get('name'));
    expect(result.current.get('status')).toBe(first.get('status'));
  });

  it('gives a new config only to the column whose filter changed', () => {
    const { result, rerender } = renderHook(({ input }) => useHeaderFilterConfigs(columns, input), {
      initialProps: { input: makeInput() },
    });
    const first = result.current;
    rerender({ input: makeInput({ filters: { name: { type: 'text', value: 'al' } } }) });
    expect(result.current.get('name')).not.toBe(first.get('name'));
    expect(result.current.get('name')?.textValue).toBe('al');
    expect(result.current.get('status')).toBe(first.get('status'));
  });

  it('gives a new config to the column whose sort changed', () => {
    const { result, rerender } = renderHook(({ input }) => useHeaderFilterConfigs(columns, input), {
      initialProps: { input: makeInput() },
    });
    const first = result.current;
    rerender({ input: makeInput({ sortBy: 'status', sortDirection: 'desc' }) });
    expect(result.current.get('status')).not.toBe(first.get('status'));
    expect(result.current.get('status')?.isSortedDescending).toBe(true);
    expect(result.current.get('name')).toBe(first.get('name'));
  });

  it('rebuilds configs when the handlers their closures call change', () => {
    const { result, rerender } = renderHook(({ input }) => useHeaderFilterConfigs(columns, input), {
      initialProps: { input: makeInput() },
    });
    const first = result.current;
    const nextSort = jest.fn();
    rerender({ input: makeInput({ onColumnSort: nextSort }) });
    expect(result.current.get('name')).not.toBe(first.get('name'));
    result.current.get('name')?.onSort?.();
    expect(nextSort).toHaveBeenCalledWith('name');
  });
});
