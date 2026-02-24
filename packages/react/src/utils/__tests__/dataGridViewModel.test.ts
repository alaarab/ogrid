import { resolveCellDisplayContent, getCellRenderDescriptor } from '../dataGridViewModel';
import type { IColumnDef } from '../../types';

describe('resolveCellDisplayContent — null/undefined coercion', () => {
  it('returns null for null value (any column type)', () => {
    const col: IColumnDef = { columnId: 'name', name: 'Name' };
    expect(resolveCellDisplayContent(col, {}, null)).toBeNull();
  });

  it('returns null for undefined value (any column type)', () => {
    const col: IColumnDef = { columnId: 'name', name: 'Name' };
    expect(resolveCellDisplayContent(col, {}, undefined)).toBeNull();
  });

  it('returns empty string as-is (not null)', () => {
    const col: IColumnDef = { columnId: 'name', name: 'Name' };
    expect(resolveCellDisplayContent(col, {}, '')).toBe('');
  });

  it('returns null for null boolean column value', () => {
    const col: IColumnDef = { columnId: 'active', name: 'Active', type: 'boolean' };
    expect(resolveCellDisplayContent(col, {}, null)).toBeNull();
  });

  it('returns null for null date column value', () => {
    const col: IColumnDef = { columnId: 'created', name: 'Created', type: 'date' };
    expect(resolveCellDisplayContent(col, {}, null)).toBeNull();
  });

  it('returns null for null numeric column value', () => {
    const col: IColumnDef = { columnId: 'amount', name: 'Amount', type: 'numeric' };
    expect(resolveCellDisplayContent(col, {}, null)).toBeNull();
  });
});

describe('resolveCellDisplayContent', () => {
  it('formats date values with toLocaleDateString when type is date', () => {
    const col: IColumnDef = { columnId: 'date', name: 'Date', type: 'date' };
    const result = resolveCellDisplayContent(col, {}, '2024-06-15');
    // toLocaleDateString varies by locale, just verify it's not the raw ISO string
    expect(result).toBeDefined();
    expect(result).not.toBe('2024-06-15');
    expect(typeof result).toBe('string');
  });

  it('returns null for null date values', () => {
    const col: IColumnDef = { columnId: 'date', name: 'Date', type: 'date' };
    expect(resolveCellDisplayContent(col, {}, null)).toBeNull();
  });

  it('uses valueFormatter over auto-format for date columns', () => {
    const col: IColumnDef = {
      columnId: 'date',
      name: 'Date',
      type: 'date',
      valueFormatter: (v) => `custom:${v}`,
    };
    expect(resolveCellDisplayContent(col, {}, '2024-06-15')).toBe('custom:2024-06-15');
  });

  it('formats boolean true as "True"', () => {
    const col: IColumnDef = { columnId: 'active', name: 'Active', type: 'boolean' };
    expect(resolveCellDisplayContent(col, {}, true)).toBe('True');
  });

  it('formats boolean false as "False"', () => {
    const col: IColumnDef = { columnId: 'active', name: 'Active', type: 'boolean' };
    expect(resolveCellDisplayContent(col, {}, false)).toBe('False');
  });

  it('still uses String() for text/numeric columns', () => {
    const col: IColumnDef = { columnId: 'name', name: 'Name' };
    expect(resolveCellDisplayContent(col, {}, 'hello')).toBe('hello');
  });
});

describe('getCellRenderDescriptor editor type defaults', () => {
  const baseInput = {
    editingCell: { rowId: '1', columnId: 'col' },
    activeCell: null,
    selectionRange: null,
    cutRange: null,
    copyRange: null,
    colOffset: 0,
    itemsLength: 1,
    getRowId: (item: { id: string }) => item.id,
    editable: true,
    onCellValueChanged: () => {},
  };

  it('defaults editorType to "date" for date columns without explicit cellEditor', () => {
    const col: IColumnDef<{ id: string; date: string }> = {
      columnId: 'col',
      name: 'Date',
      type: 'date',
      editable: true,
    };
    const desc = getCellRenderDescriptor({ id: '1', date: '2024-01-01' }, col, 0, 0, baseInput);
    expect(desc.mode).toBe('editing-inline');
    expect(desc.editorType).toBe('date');
  });

  it('defaults editorType to "checkbox" for boolean columns without explicit cellEditor', () => {
    const col: IColumnDef<{ id: string; active: boolean }> = {
      columnId: 'col',
      name: 'Active',
      type: 'boolean',
      editable: true,
    };
    const desc = getCellRenderDescriptor({ id: '1', active: true }, col, 0, 0, baseInput);
    expect(desc.mode).toBe('editing-inline');
    expect(desc.editorType).toBe('checkbox');
  });

  it('respects explicit cellEditor over type default', () => {
    const col: IColumnDef<{ id: string; date: string }> = {
      columnId: 'col',
      name: 'Date',
      type: 'date',
      editable: true,
      cellEditor: 'text',
    };
    const desc = getCellRenderDescriptor({ id: '1', date: '2024-01-01' }, col, 0, 0, baseInput);
    expect(desc.editorType).toBe('text');
  });
});
