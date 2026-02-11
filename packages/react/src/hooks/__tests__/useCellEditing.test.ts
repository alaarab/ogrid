import { renderHook, act } from '@testing-library/react';
import { useCellEditing } from '../useCellEditing';

describe('useCellEditing', () => {
  it('returns editingCell null and setEditingCell', () => {
    const { result } = renderHook(() => useCellEditing());
    expect(result.current.editingCell).toBeNull();
    expect(typeof result.current.setEditingCell).toBe('function');
    expect(result.current.pendingEditorValue).toBeUndefined();
    expect(typeof result.current.setPendingEditorValue).toBe('function');
  });

  it('setEditingCell updates editingCell', () => {
    const { result } = renderHook(() => useCellEditing());
    act(() => {
      result.current.setEditingCell({ rowId: 'r1', columnId: 'c1' });
    });
    expect(result.current.editingCell).toEqual({ rowId: 'r1', columnId: 'c1' });
  });

  it('setPendingEditorValue updates pendingEditorValue', () => {
    const { result } = renderHook(() => useCellEditing());
    act(() => {
      result.current.setPendingEditorValue('new value');
    });
    expect(result.current.pendingEditorValue).toBe('new value');
  });

  it('setEditingCell(null) clears editingCell', () => {
    const { result } = renderHook(() => useCellEditing());
    act(() => {
      result.current.setEditingCell({ rowId: 'r1', columnId: 'c1' });
    });
    act(() => {
      result.current.setEditingCell(null);
    });
    expect(result.current.editingCell).toBeNull();
  });
});
