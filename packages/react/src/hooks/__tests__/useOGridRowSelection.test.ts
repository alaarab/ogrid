import { renderHook, act } from '@testing-library/react';
import { useOGridRowSelection } from '../useOGridRowSelection';
import type { RowId } from '../../types';

type Row = { id: number; name: string };
const getRowId = (r: Row) => r.id;
const page1: Row[] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
const page2: Row[] = [{ id: 3, name: 'c' }];

describe('useOGridRowSelection', () => {
  it('keeps items selected on a server page that is no longer loaded', () => {
    const onSelectionChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ known }) => useOGridRowSelection<Row>({ onSelectionChange, getRowId, knownItems: known }),
      { initialProps: { known: page1 } },
    );
    act(() => { result.current.commitSelection([1]); });
    rerender({ known: page2 });
    act(() => { result.current.commitSelection([1, 3]); });
    const event = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0];
    expect(event.selectedRowIds).toEqual([1, 3]);
    // Loaded rows first (data order), then rows remembered from earlier pages.
    expect(event.selectedItems).toEqual([page2[0], page1[0]]);
    expect(Array.from(result.current.effectiveSelectedRows)).toEqual([1, 3]);
  });

  it('normalizes a controlled selection passed as an array', () => {
    const { result } = renderHook(() =>
      useOGridRowSelection<Row>({ controlledSelectedRows: [2] as unknown as Set<RowId>, getRowId, knownItems: page1 }),
    );
    expect(result.current.effectiveSelectedRows).toBeInstanceOf(Set);
    expect(result.current.effectiveSelectedRows.has(2)).toBe(true);
  });

  it('does not write internal state when controlled, but still reports the change', () => {
    const onSelectionChange = jest.fn();
    const controlled = new Set<RowId>();
    const { result } = renderHook(() =>
      useOGridRowSelection<Row>({ controlledSelectedRows: controlled, onSelectionChange, getRowId, knownItems: page1 }),
    );
    act(() => { result.current.commitSelection([2]); });
    expect(result.current.effectiveSelectedRows).toBe(controlled);
    expect(onSelectionChange).toHaveBeenCalledWith({ selectedRowIds: [2], selectedItems: [page1[1]] });
  });
});
