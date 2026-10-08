import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';
import type { IColumnDef, ISelectionRange } from '../../types';

/** Excel keyboard behaviors of the grid's keydown handler (hook level, live state). */
type Row = { id: string; text: string; when: string; qty: number; done: boolean; pick: string };
const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i), text: `t${i}`, when: '', qty: i, done: false, pick: 'a' }));
const cols = [
  { columnId: 'text', name: 'Text', editable: true },
  { columnId: 'when', name: 'When', editable: true, type: 'date' },
  { columnId: 'qty', name: 'Qty', editable: true, type: 'numeric' },
  { columnId: 'done', name: 'Done', editable: true, type: 'boolean' },
  { columnId: 'pick', name: 'Pick', editable: true, cellEditor: 'select', cellEditorParams: { values: ['a', 'b'] } },
] as IColumnDef<Row>[];
const LAST_COL = cols.length - 1;

function setup(opts: {
  activeCell?: { rowIndex: number; columnIndex: number };
  selectionRange?: ISelectionRange | null;
  editingCell?: { rowId: string; columnId: string } | null;
  editable?: boolean;
  columns?: IColumnDef<Row>[];
  rowSelection?: 'none' | 'multiple';
} = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<div data-ogrid-cell-editor=""><input data-testid="editor" /></div>';
  document.body.append(wrapper);
  const active = opts.activeCell ?? { rowIndex: 1, columnIndex: 0 };
  const state = {
    activeCell: active,
    selectionRange: opts.selectionRange === undefined
      ? { startRow: active.rowIndex, startCol: active.columnIndex, endRow: active.rowIndex, endCol: active.columnIndex }
      : opts.selectionRange,
    editingCell: opts.editingCell ?? null,
    selectedRowIds: new Set<string>(),
  };
  const handlers = {
    setActiveCell: jest.fn((c) => { state.activeCell = c; }),
    setSelectionRange: jest.fn((r) => { state.selectionRange = r; }),
    setEditingCell: jest.fn((c) => { state.editingCell = c; }),
    setPendingEditorValue: jest.fn(),
    handleRowCheckboxChange: jest.fn(),
    handleCopyEvent: jest.fn(),
    handleCutEvent: jest.fn(),
    handlePasteEvent: jest.fn(),
    setContextMenu: jest.fn(),
  };
  const onCellValueChanged = jest.fn();
  const fillRight = jest.fn();
  const columns = opts.columns ?? cols;
  const params = {
    data: { items: rows, visibleCols: columns, colOffset: 0, hasCheckboxCol: false, visibleColumnCount: columns.length, getRowId: (r: Row) => r.id },
    state,
    handlers,
    features: { editable: opts.editable ?? true, onCellValueChanged, rowSelection: opts.rowSelection ?? 'none', wrapperRef: { current: wrapper }, fillRight },
  };
  const { result } = renderHook(() => useKeyboardNavigation<Row>(params as never));
  const press = (key: string, mods: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; code?: string; target?: Element } = {}) => {
    const e = {
      key, code: mods.code ?? '', target: mods.target ?? wrapper, currentTarget: wrapper,
      shiftKey: !!mods.shiftKey, ctrlKey: !!mods.ctrlKey, altKey: !!mods.altKey, metaKey: false,
      keyCode: key === 'Process' ? 229 : 0,
      nativeEvent: { isComposing: false },
      getModifierState: () => false,
      defaultPrevented: false,
      preventDefault: jest.fn(),
    };
    act(() => { result.current.handleGridKeyDown(e as unknown as React.KeyboardEvent); });
    return e;
  };
  const editor = wrapper.querySelector('[data-testid="editor"]') as HTMLElement;
  return { state, handlers, onCellValueChanged, fillRight, press, editor };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('type-to-replace', () => {
  it('a printable key opens the editor seeded with that character', () => {
    const t = setup();
    const e = t.press('x');
    expect(e.preventDefault).toHaveBeenCalled();
    expect(t.handlers.setPendingEditorValue).toHaveBeenCalledWith('x');
    expect(t.handlers.setEditingCell).toHaveBeenCalledWith({ rowId: '1', columnId: 'text' });
  });

  it('Shift+letter and digits type too; Ctrl/Alt chords and Space do not', () => {
    expect(setup().handlers.setEditingCell).not.toHaveBeenCalled();
    const upper = setup();
    upper.press('X', { shiftKey: true });
    expect(upper.handlers.setPendingEditorValue).toHaveBeenCalledWith('X');
    const ctrl = setup();
    ctrl.press('x', { ctrlKey: true });
    ctrl.press('q', { altKey: true });
    ctrl.press(' ');
    expect(ctrl.handlers.setEditingCell).not.toHaveBeenCalled();
  });

  it('an IME keystroke opens an empty editor without swallowing the key', () => {
    const t = setup();
    const e = t.press('Process');
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(t.handlers.setPendingEditorValue).toHaveBeenCalledWith('');
    expect(t.handlers.setEditingCell).toHaveBeenCalled();
  });

  it('does nothing on a read-only grid or while editing', () => {
    const ro = setup({ editable: false });
    expect(ro.press('x').preventDefault).not.toHaveBeenCalled();
    expect(ro.handlers.setEditingCell).not.toHaveBeenCalled();
    const editing = setup({ editingCell: { rowId: '1', columnId: 'text' } });
    editing.press('x');
    expect(editing.handlers.setPendingEditorValue).not.toHaveBeenCalled();
  });

  it('skips boolean cells, opens a select without seeding it', () => {
    const bool = setup({ activeCell: { rowIndex: 0, columnIndex: 3 } });
    bool.press('x');
    expect(bool.handlers.setEditingCell).not.toHaveBeenCalled();
    const select = setup({ activeCell: { rowIndex: 0, columnIndex: 4 } });
    select.press('b');
    expect(select.handlers.setEditingCell).toHaveBeenCalledWith({ rowId: '0', columnId: 'pick' });
    expect(select.handlers.setPendingEditorValue).toHaveBeenCalledWith(undefined);
  });

  it('F2 and Enter open the editor with no seed', () => {
    const t = setup();
    t.press('F2');
    expect(t.handlers.setPendingEditorValue).toHaveBeenCalledWith(undefined);
    expect(t.handlers.setEditingCell).toHaveBeenCalled();
  });
});

describe('Enter / Tab inside a selection', () => {
  const range = { startRow: 1, startCol: 0, endRow: 2, endCol: 1 };

  it('Enter walks down the selection and wraps to the next column, keeping the range', () => {
    const t = setup({ activeCell: { rowIndex: 1, columnIndex: 0 }, selectionRange: range });
    t.press('Enter');
    expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 0 });
    t.press('Enter');
    expect(t.state.activeCell).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(t.state.selectionRange).toEqual(range);
    expect(t.handlers.setEditingCell).not.toHaveBeenCalled();
  });

  it('Shift+Enter walks backward and wraps to the last cell', () => {
    const t = setup({ activeCell: { rowIndex: 1, columnIndex: 0 }, selectionRange: range });
    t.press('Enter', { shiftKey: true });
    expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 1 });
  });

  it('Tab walks across the selection row by row; Shift+Tab backward', () => {
    const t = setup({ activeCell: { rowIndex: 1, columnIndex: 1 }, selectionRange: range });
    const e = t.press('Tab');
    expect(e.preventDefault).toHaveBeenCalled();
    expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 0 });
    t.press('Tab', { shiftKey: true });
    expect(t.state.activeCell).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(t.state.selectionRange).toEqual(range);
  });

  it('Tab from an open editor commits (editor side) and walks the selection', () => {
    const t = setup({ activeCell: { rowIndex: 2, columnIndex: 1 }, selectionRange: range, editingCell: { rowId: '2', columnId: 'when' } });
    t.press('Tab', { target: t.editor });
    expect(t.handlers.setEditingCell).toHaveBeenCalledWith(null);
    expect(t.state.activeCell).toEqual({ rowIndex: 1, columnIndex: 0 });
    expect(t.state.selectionRange).toEqual(range);
  });

  it('Shift+Enter on a single cell moves up instead of editing', () => {
    const t = setup({ activeCell: { rowIndex: 3, columnIndex: 0 } });
    t.press('Enter', { shiftKey: true });
    expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 0 });
    expect(t.handlers.setEditingCell).not.toHaveBeenCalled();
    // Plain Enter on a single cell still edits.
    t.press('Enter');
    expect(t.handlers.setEditingCell).toHaveBeenCalled();
  });
});

describe('Shift+Home / Shift+End', () => {
  it('extend from the active cell to the row start / end; the active cell stays', () => {
    const t = setup({ activeCell: { rowIndex: 2, columnIndex: 2 } });
    t.press('Home', { shiftKey: true });
    expect(t.state.selectionRange).toEqual({ startRow: 2, startCol: 0, endRow: 2, endCol: 2 });
    t.press('End', { shiftKey: true });
    expect(t.state.selectionRange).toEqual({ startRow: 2, startCol: 2, endRow: 2, endCol: LAST_COL });
    expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 2 });
  });

  it('with Ctrl extend to the grid start / end', () => {
    const t = setup({ activeCell: { rowIndex: 2, columnIndex: 2 } });
    t.press('Home', { shiftKey: true, ctrlKey: true });
    expect(t.state.selectionRange).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
    t.press('End', { shiftKey: true, ctrlKey: true });
    expect(t.state.selectionRange).toEqual({ startRow: 2, startCol: 2, endRow: rows.length - 1, endCol: LAST_COL });
  });
});

describe('Ctrl+R, Ctrl+; and Ctrl+Shift+;', () => {
  it('Ctrl+R fills right; a read-only grid leaves it to the browser', () => {
    const t = setup();
    expect(t.press('r', { ctrlKey: true }).preventDefault).toHaveBeenCalled();
    expect(t.fillRight).toHaveBeenCalledTimes(1);
    const ro = setup({ editable: false });
    expect(ro.press('r', { ctrlKey: true }).preventDefault).not.toHaveBeenCalled();
    expect(ro.fillRight).not.toHaveBeenCalled();
  });

  it("Ctrl+; enters today's date (YYYY-MM-DD) into a text cell and a date cell", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const text = setup();
    text.press(';', { ctrlKey: true });
    expect(text.onCellValueChanged).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'text', newValue: today, rowIndex: 1 }));
    const date = setup({ activeCell: { rowIndex: 0, columnIndex: 1 } });
    date.press(';', { ctrlKey: true });
    expect(date.onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'when' });
    expect(String(date.onCellValueChanged.mock.calls[0]?.[0].newValue)).toContain(today);
  });

  it('Ctrl+Shift+; (Ctrl+:) enters the time as HH:mm', () => {
    const t = setup();
    t.press(':', { ctrlKey: true, shiftKey: true, code: 'Semicolon' });
    expect(t.onCellValueChanged.mock.calls[0]?.[0].newValue).toMatch(/^\d{2}:\d{2}$/);
  });

  it("a value the column's parser rejects is not written", () => {
    const t = setup({ activeCell: { rowIndex: 0, columnIndex: 2 } });
    t.press(';', { ctrlKey: true });
    expect(t.onCellValueChanged).not.toHaveBeenCalled();
  });
});

describe('Ctrl+Space / Shift+Space', () => {
  it("Ctrl+Space selects the selection's whole columns, keeping the active cell", () => {
    const t = setup({ activeCell: { rowIndex: 2, columnIndex: 1 }, selectionRange: { startRow: 2, startCol: 1, endRow: 3, endCol: 2 } });
    t.press(' ', { ctrlKey: true });
    expect(t.state.selectionRange).toEqual({ startRow: 0, endRow: rows.length - 1, startCol: 1, endCol: 2 });
    expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 1 });
  });

  it('Ctrl+Shift+Space selects everything', () => {
    const t = setup();
    t.press(' ', { ctrlKey: true, shiftKey: true });
    expect(t.state.selectionRange).toEqual({ startRow: 0, endRow: rows.length - 1, startCol: 0, endCol: LAST_COL });
  });

  it('Shift+Space keeps toggling the row when row selection is on', () => {
    const t = setup({ rowSelection: 'multiple' });
    t.press(' ', { shiftKey: true });
    expect(t.handlers.handleRowCheckboxChange).toHaveBeenCalled();
    expect(t.handlers.setSelectionRange).not.toHaveBeenCalled();
  });
});
