import { renderHook, act } from '@testing-library/react';
import { useRowSelection } from '../useRowSelection';

describe('useRowSelection', () => {
  const items = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
  ];
  const getRowId = (item: { id: string }) => item.id;

  it('returns selectedRowIds and handlers', () => {
    const { result } = renderHook(() =>
      useRowSelection({
        items,
        getRowId,
        rowSelection: 'multiple',
        controlledSelectedRows: undefined,
        onSelectionChange: undefined,
      })
    );

    expect(result.current.selectedRowIds).toBeInstanceOf(Set);
    expect(result.current.selectedRowIds.size).toBe(0);
    expect(result.current.allSelected).toBe(false);
    expect(result.current.someSelected).toBe(false);
    expect(typeof result.current.handleRowCheckboxChange).toBe('function');
    expect(typeof result.current.handleSelectAll).toBe('function');
    expect(typeof result.current.updateSelection).toBe('function');
  });

  it('handleSelectAll(true) selects all rows', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useRowSelection({
        items,
        getRowId,
        rowSelection: 'multiple',
        controlledSelectedRows: undefined,
        onSelectionChange,
      })
    );

    act(() => {
      result.current.handleSelectAll(true);
    });

    expect(result.current.selectedRowIds.size).toBe(3);
    expect(result.current.allSelected).toBe(true);
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedRowIds: ['1', '2', '3'],
        selectedItems: items,
      })
    );
  });

  it('respects controlledSelectedRows', () => {
    const controlled = new Set(['1', '2']);
    const { result } = renderHook(() =>
      useRowSelection({
        items,
        getRowId,
        rowSelection: 'multiple',
        controlledSelectedRows: controlled,
        onSelectionChange: undefined,
      })
    );

    expect(result.current.selectedRowIds).toBe(controlled);
    expect(result.current.selectedRowIds.size).toBe(2);
    expect(result.current.someSelected).toBe(true);
    expect(result.current.allSelected).toBe(false);
  });
});

describe('useRowSelection shift-click anchor', () => {
  const getRowId = (item: { id: string }) => item.id;
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  const d = { id: 'd' };

  it('follows the anchor row by id after the rows are re-sorted', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useRowSelection({ items, getRowId, rowSelection: 'multiple', controlledSelectedRows: undefined, onSelectionChange: undefined }),
      { initialProps: { items: [a, b, c, d] } }
    );
    // Click row "b" (index 1), then sort so "b" moves to index 3.
    act(() => { result.current.handleRowCheckboxChange('b', true, 1, false); });
    rerender({ items: [d, c, a, b] });
    // Shift-click "c" (now index 1): range is c..b (indices 1..3), not d..c from the stale index 1.
    act(() => { result.current.handleRowCheckboxChange('c', true, 1, true); });
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual(['a', 'b', 'c']);
  });

  it('falls back to a plain toggle when the anchor row is no longer present', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useRowSelection({ items, getRowId, rowSelection: 'multiple', controlledSelectedRows: undefined, onSelectionChange: undefined }),
      { initialProps: { items: [a, b, c, d] } }
    );
    act(() => { result.current.handleRowCheckboxChange('a', true, 0, false); });
    rerender({ items: [b, c, d] }); // "a" filtered out
    act(() => { result.current.handleRowCheckboxChange('d', true, 2, true); });
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual(['a', 'd']);
  });
});
