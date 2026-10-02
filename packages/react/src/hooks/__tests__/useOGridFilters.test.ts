import { renderHook } from '@testing-library/react';
import { useOGridFilters } from '../useOGridFilters';
import type { IFilters } from '../../types';

describe('useOGridFilters stableFilters (D18)', () => {
  it('keeps the same reference when controlled filters are rebuilt with equal contents', () => {
    const build = (): IFilters => ({
      status: { type: 'multiSelect', value: ['a', 'b'] },
      name: { type: 'text', value: 'x' },
    });
    const { result, rerender } = renderHook(
      ({ filters }) =>
        useOGridFilters({ controlledFilters: filters, setPage: () => {}, columns: [], displayData: [] }),
      { initialProps: { filters: build() } },
    );
    const first = result.current.stableFilters;
    rerender({ filters: build() });
    expect(result.current.stableFilters).toBe(first);
  });

  it('returns a new reference when a filter value actually changes', () => {
    const { result, rerender } = renderHook(
      ({ filters }) =>
        useOGridFilters({ controlledFilters: filters, setPage: () => {}, columns: [], displayData: [] }),
      { initialProps: { filters: { status: { type: 'multiSelect', value: ['a'] } } as IFilters } },
    );
    const first = result.current.stableFilters;
    rerender({ filters: { status: { type: 'multiSelect', value: ['a', 'b'] } } as IFilters });
    expect(result.current.stableFilters).not.toBe(first);
  });
});
