import { useCellEditing } from '../composables/useCellEditing';

describe('useCellEditing', () => {
  it('initializes editingCell as null', () => {
    const { editingCell } = useCellEditing();
    expect(editingCell.value).toBeNull();
  });

  it('initializes pendingEditorValue as undefined', () => {
    const { pendingEditorValue } = useCellEditing();
    expect(pendingEditorValue.value).toBeUndefined();
  });

  it('setEditingCell updates the editing cell', () => {
    const { editingCell, setEditingCell } = useCellEditing();
    setEditingCell({ rowId: '1', columnId: 'name' });
    expect(editingCell.value).toEqual({ rowId: '1', columnId: 'name' });
  });

  it('setEditingCell to null clears the editing cell', () => {
    const { editingCell, setEditingCell } = useCellEditing();
    setEditingCell({ rowId: '1', columnId: 'name' });
    setEditingCell(null);
    expect(editingCell.value).toBeNull();
  });

  it('setPendingEditorValue updates the pending value', () => {
    const { pendingEditorValue, setPendingEditorValue } = useCellEditing();
    setPendingEditorValue('hello');
    expect(pendingEditorValue.value).toBe('hello');
  });

  it('setPendingEditorValue works with various types', () => {
    const { pendingEditorValue, setPendingEditorValue } = useCellEditing();
    setPendingEditorValue(42);
    expect(pendingEditorValue.value).toBe(42);

    setPendingEditorValue(true);
    expect(pendingEditorValue.value).toBe(true);

    setPendingEditorValue(null);
    expect(pendingEditorValue.value).toBeNull();
  });

  it('calls scrollToRow when setEditingCell is called with scroll params', () => {
    const scrollToRow = jest.fn();
    const getRowIndex = jest.fn().mockReturnValue(5);

    const { setEditingCell } = useCellEditing({ scrollToRow, getRowIndex });
    setEditingCell({ rowId: 'r5', columnId: 'col1' });

    expect(getRowIndex).toHaveBeenCalledWith('r5');
    expect(scrollToRow).toHaveBeenCalledWith(5, 'center');
  });

  it('does not call scrollToRow when getRowIndex returns -1', () => {
    const scrollToRow = jest.fn();
    const getRowIndex = jest.fn().mockReturnValue(-1);

    const { setEditingCell } = useCellEditing({ scrollToRow, getRowIndex });
    setEditingCell({ rowId: 'missing', columnId: 'col1' });

    expect(getRowIndex).toHaveBeenCalledWith('missing');
    expect(scrollToRow).not.toHaveBeenCalled();
  });

  it('does not call scrollToRow when setting null', () => {
    const scrollToRow = jest.fn();
    const getRowIndex = jest.fn();

    const { setEditingCell } = useCellEditing({ scrollToRow, getRowIndex });
    setEditingCell(null);

    expect(scrollToRow).not.toHaveBeenCalled();
    expect(getRowIndex).not.toHaveBeenCalled();
  });
});
