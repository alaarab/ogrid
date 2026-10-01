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

describe('useRowSelection select-all across pages (S09)', () => {
  type R = { id: number };
  const getRowId = (r: R) => r.id;
  const page2: R[] = [{ id: 3 }, { id: 4 }];

  it('header select-all keeps selections from other pages, and deselect-all only drops this page', () => {
    const { result } = renderHook(() =>
      useRowSelection<R>({
        items: page2,
        getRowId,
        rowSelection: 'multiple',
        controlledSelectedRows: undefined,
        onSelectionChange: undefined,
      })
    );
    act(() => result.current.handleRowCheckboxChange(1, true, 0, false));
    act(() => result.current.handleSelectAll(true));
    expect(Array.from(result.current.selectedRowIds).sort()).toEqual([1, 3, 4]);
    expect(result.current.allSelected).toBe(true);
    act(() => result.current.handleSelectAll(false));
    expect(Array.from(result.current.selectedRowIds)).toEqual([1]);
  });

  it('someSelected is false when the only selections are on other pages', () => {
    const { result } = renderHook(() =>
      useRowSelection<R>({
        items: page2,
        getRowId,
        rowSelection: 'multiple',
        controlledSelectedRows: new Set([1, 2]),
        onSelectionChange: undefined,
      })
    );
    expect(result.current.someSelected).toBe(false);
    expect(result.current.allSelected).toBe(false);
  });
});
