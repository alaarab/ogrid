import { renderHook, act } from '@testing-library/react';
import { useInlineEdit } from '../useInlineEdit';
import type { IColumnDef } from '@alaarab/ogrid-core';

type Row = { id: string; name: string; score: number; locked: boolean };

const data: Row[] = [
  { id: '1', name: 'Alice', score: 90, locked: false },
  { id: '2', name: 'Bob', score: 75, locked: true },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', type: 'text', editable: true },
  { columnId: 'score', name: 'Score', type: 'numeric', editable: true },
  { columnId: 'readonly', name: 'Readonly', type: 'text', editable: false },
  // Per-row editable predicate: locked rows can't be edited.
  { columnId: 'gated', name: 'Gated', type: 'text', editable: (r) => !r.locked },
];

const getRowId = (r: Row) => r.id;

describe('useInlineEdit', () => {
  it('starts editing a cell and exposes pendingValue', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    expect(result.current.editingCell).toBeNull();

    act(() => result.current.startEdit(data[0], 'name'));
    expect(result.current.editingCell).toEqual({ rowId: '1', columnId: 'name' });
    expect(result.current.pendingValue).toBe('Alice');
  });

  it('isEditing returns true only for the active cell', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    expect(result.current.isEditing(data[0], 'name')).toBe(true);
    expect(result.current.isEditing(data[0], 'score')).toBe(false);
    expect(result.current.isEditing(data[1], 'name')).toBe(false);
  });

  it('canEdit honors column editable boolean', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    expect(result.current.canEdit(data[0], 'name')).toBe(true);
    expect(result.current.canEdit(data[0], 'readonly')).toBe(false);
  });

  it('canEdit honors per-row editable predicate', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    expect(result.current.canEdit(data[0], 'gated')).toBe(true); // locked: false
    expect(result.current.canEdit(data[1], 'gated')).toBe(false); // locked: true
  });

  it('startEdit no-ops on non-editable cells', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'readonly'));
    expect(result.current.editingCell).toBeNull();
  });

  it('isCellEditable override takes precedence', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({
        columns,
        getRowId,
        onCellEdit,
        isCellEditable: () => false, // lock everything
      }),
    );

    expect(result.current.canEdit(data[0], 'name')).toBe(false);
    act(() => result.current.startEdit(data[0], 'name'));
    expect(result.current.editingCell).toBeNull();
  });

  it('setPendingValue updates the buffer', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    act(() => result.current.setPendingValue('Aliceheart'));
    expect(result.current.pendingValue).toBe('Aliceheart');
  });

  it('commitEdit fires onCellEdit with old + new values', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    act(() => result.current.setPendingValue('Alice2'));
    act(() => result.current.commitEdit());

    expect(onCellEdit).toHaveBeenCalledWith({
      item: data[0],
      columnId: 'name',
      oldValue: 'Alice',
      newValue: 'Alice2',
    });
    expect(result.current.editingCell).toBeNull();
  });

  it('commitEdit skips onCellEdit when value unchanged', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    act(() => result.current.commitEdit());

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(result.current.editingCell).toBeNull();
  });

  it('cancelEdit closes without firing onCellEdit', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    act(() => result.current.setPendingValue('NEW VALUE'));
    act(() => result.current.cancelEdit());

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(result.current.editingCell).toBeNull();
    expect(result.current.pendingValue).toBeUndefined();
  });

  it('getEditorProps onKeyDown handles Enter (commit) and Escape (cancel)', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    act(() => result.current.setPendingValue('CommitMe'));
    const props = result.current.getEditorProps(data[0], 'name');

    act(() => props.onKeyDown({ key: 'Enter' }));
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: 'CommitMe' }),
    );

    act(() => result.current.startEdit(data[0], 'score'));
    act(() => result.current.setPendingValue(999));
    const props2 = result.current.getEditorProps(data[0], 'score');
    act(() => props2.onKeyDown({ key: 'Escape' }));
    expect(onCellEdit).toHaveBeenCalledTimes(1); // Escape didn't fire
    expect(result.current.editingCell).toBeNull();
  });

  it('getEditorProps onBlur commits', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ columns, getRowId, onCellEdit }),
    );

    act(() => result.current.startEdit(data[0], 'name'));
    act(() => result.current.setPendingValue('OnBlurValue'));
    const props = result.current.getEditorProps(data[0], 'name');

    act(() => props.onBlur());
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: 'OnBlurValue' }),
    );
  });
});
