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
