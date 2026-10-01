import { renderHook, act } from '@testing-library/react';
import { useDataGridEditing } from '../useDataGridEditing';
import type { IColumnDef } from '../../types';

type Row = { id: string; n: number; t: string; num?: unknown; txt?: unknown };

describe('useDataGridEditing  -  unchanged commit (S12)', () => {
  function setup() {
    const onCellValueChanged = jest.fn();
    const setEditingCell = jest.fn();
    const visibleCols = [
      { columnId: 'n', name: 'N' },
      { columnId: 't', name: 'T' },
      { columnId: 'num', name: 'Num', type: 'numeric' },
      { columnId: 'txt', name: 'Txt', type: 'text' },
    ] as IColumnDef<Row>[];
    const { result } = renderHook(() =>
      useDataGridEditing<Row>({
        editingCell: null,
        setEditingCell,
        pendingEditorValue: undefined,
        setPendingEditorValue: jest.fn(),
        visibleCols,
        itemsLength: 2,
        onCellValueChanged,
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        colOffset: 0,
      }),
    );
    return { commit: result.current.editing.commitCellEdit, onCellValueChanged, setEditingCell };
  }
  const item: Row = { id: '1', n: 5, t: 'x' };

  it('does not emit when the value is unchanged (including 5 -> "5")', () => {
    const { commit, onCellValueChanged, setEditingCell } = setup();
    act(() => commit(item, 't', 'x', 'x', 0, 1));
    act(() => commit(item, 'n', 5, '5', 0, 0));
    expect(onCellValueChanged).not.toHaveBeenCalled();
    expect(setEditingCell).toHaveBeenCalledWith(null);
  });

  it('typed columns: unchanged after parsing is skipped, but a type coercion still commits', () => {
    const { commit, onCellValueChanged } = setup();
    act(() => commit({ ...item, num: 5 }, 'num', 5, '5', 0, 2)); // parses to 5: unchanged
    act(() => commit({ ...item, num: undefined }, 'num', undefined, '', 0, 2)); // empty stays empty (null)
    expect(onCellValueChanged).not.toHaveBeenCalled();
    act(() => commit({ ...item, num: '5' }, 'num', '5', '5', 0, 2)); // '5' -> 5
    act(() => commit({ ...item, txt: 5 }, 'txt', 5, '5', 0, 3)); // 5 -> '5' in a text column
    expect(onCellValueChanged.mock.calls.map((c) => c[0].newValue)).toEqual([5, '5']);
  });

  it('still emits when the value changed', () => {
    const { commit, onCellValueChanged } = setup();
    act(() => commit(item, 't', 'x', 'y', 0, 1));
    expect(onCellValueChanged).toHaveBeenCalledTimes(1);
  });
});
