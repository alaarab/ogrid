/**
 * Tests for getCellRenderDescriptor: null/undefined cell value coercion,
 * mode computation, and descriptor shape.
 */
import { getCellRenderDescriptor, CellDescriptorCache } from '../dataGridViewModel';
import type { CellRenderDescriptorInput } from '../dataGridViewModel';
import type { IColumnDef } from '../../types/columnTypes';

interface TestRow {
  id: string;
  name: string | null | undefined;
  age?: number | null;
  active?: boolean;
}

const FakeVueEditor = { name: 'FakeVueEditor' };

const baseInput = (): CellRenderDescriptorInput<TestRow> => ({
  editingCell: null,
  activeCell: null,
  selectionRange: null,
  cutRange: null,
  copyRange: null,
  colOffset: 0,
  getRowId: (item) => item.id,
  editable: true,
  onCellValueChanged: jest.fn(),
  isDragging: false,
});

describe('getCellRenderDescriptor  -  null/undefined cell value coercion', () => {
  it('handles null cell value without throwing', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: null };

    expect(() => {
      getCellRenderDescriptor(item, col, 0, 0, baseInput());
    }).not.toThrow();
  });

  it('handles undefined cell value without throwing', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: undefined };

    expect(() => {
      getCellRenderDescriptor(item, col, 0, 0, baseInput());
    }).not.toThrow();
  });

  it('returns null as displayValue when cell value is null', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: null };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, baseInput());

    // displayValue should be null  -  not coerced to empty string
    expect(descriptor.displayValue).toBeNull();
  });

  it('returns undefined as displayValue when cell value is undefined', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: undefined };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, baseInput());

    expect(descriptor.displayValue).toBeUndefined();
  });

  it('handles numeric column with null value', () => {
    const col: IColumnDef<TestRow> = { columnId: 'age', name: 'Age', type: 'numeric' as const };
    const item: TestRow = { id: '1', name: 'Alice', age: null };

    expect(() => {
      const descriptor = getCellRenderDescriptor(item, col, 0, 0, baseInput());
      expect(descriptor.mode).toBe('display');
    }).not.toThrow();
  });

  it('handles boolean column with undefined value', () => {
    const col: IColumnDef<TestRow> = { columnId: 'active', name: 'Active', type: 'boolean' as const };
    const item: TestRow = { id: '1', name: 'Alice', active: undefined };

    expect(() => {
      getCellRenderDescriptor(item, col, 0, 0, baseInput());
    }).not.toThrow();
  });
});

describe('getCellRenderDescriptor  -  mode computation', () => {
  it('returns display mode when not editing', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, baseInput());
    expect(descriptor.mode).toBe('display');
  });

  it('returns editing-inline mode when cell is being edited (text editor)', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text', editable: true };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('editing-inline');
    expect(descriptor.editorType).toBe('text');
  });

  it('returns editing-inline mode for checkbox editor', () => {
    const col: IColumnDef<TestRow> = { columnId: 'active', name: 'Active', cellEditor: 'checkbox', editable: true };
    const item: TestRow = { id: '1', name: 'Alice', active: true };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'active' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('editing-inline');
    expect(descriptor.editorType).toBe('checkbox');
  });

  it('infers text editor when no cellEditor specified but editable=true', () => {
    // When editable=true and no cellEditor, the column IS editable, so editing-inline kicks in
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', editable: true };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    // canEditInline requires cellEditor to not be a function  -  undefined is fine
    // editorType falls through to 'text' as default
    expect(descriptor.mode).toBe('editing-inline');
    expect(descriptor.editorType).toBe('text');
  });

  it('returns display mode when editable is false', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text', editable: true };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.editable = false;
    input.editingCell = { rowId: '1', columnId: 'name' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('display');
  });

  it('returns display mode when editingCell does not match row', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text', editable: true };
    const item: TestRow = { id: '2', name: 'Bob' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' }; // different row

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('display');
  });

  it('returns editing-popover mode for non-string custom editor objects', () => {
    const col: IColumnDef<TestRow> = {
      columnId: 'name',
      name: 'Name',
      editable: true,
      cellEditor: FakeVueEditor,
      cellEditorPopup: true,
    };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('editing-popover');
  });

  it('cellEditorPopup: false does not make a custom-editor column non-editable', () => {
    const col: IColumnDef<TestRow> = {
      columnId: 'name',
      name: 'Name',
      editable: true,
      cellEditor: FakeVueEditor,
      cellEditorPopup: false,
    };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.canEditAny).toBe(true);
    expect(descriptor.mode).toBe('editing-popover');
  });
});

describe('getCellRenderDescriptor  -  isActive / isInRange', () => {
  it('isActive is true when activeCell matches row/col', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.activeCell = { rowIndex: 0, columnIndex: 0 };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.isActive).toBe(true);
  });

  it('isActive is false when activeCell does not match', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.activeCell = { rowIndex: 1, columnIndex: 0 };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.isActive).toBe(false);
  });

  it('isActive is false when isDragging is true even if activeCell matches', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.activeCell = { rowIndex: 0, columnIndex: 0 };
    input.isDragging = true;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.isActive).toBe(false);
  });

  it('isInRange is true when cell is inside selectionRange', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '2', name: 'Bob' };

    const input = baseInput();
    input.selectionRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 0 };

    const descriptor = getCellRenderDescriptor(item, col, 1, 0, input);
    expect(descriptor.isInRange).toBe(true);
  });

  it('isInRange is false when cell is outside selectionRange', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '4', name: 'Dave' };

    const input = baseInput();
    input.selectionRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 0 };

    const descriptor = getCellRenderDescriptor(item, col, 3, 0, input);
    expect(descriptor.isInRange).toBe(false);
  });

  it('isInCutRange is true for cells inside cutRange', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.cutRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 0 };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.isInCutRange).toBe(true);
  });

  it('isInCopyRange is true for cells inside copyRange', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.copyRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 0 };

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.isInCopyRange).toBe(true);
  });
});

describe('getCellRenderDescriptor  -  with cache', () => {
  it('uses cache to avoid recomputation on second call with same version', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    const cache = new CellDescriptorCache();
    const version = CellDescriptorCache.computeVersion(input);
    cache.updateVersion(version);

    const first = getCellRenderDescriptor(item, col, 0, 0, input, cache);
    const second = getCellRenderDescriptor(item, col, 0, 0, input, cache);

    // Same object returned from cache
    expect(first).toBe(second);
  });

  it('recomputes on version change', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input1 = baseInput();
    const cache = new CellDescriptorCache();

    const v1 = CellDescriptorCache.computeVersion(input1);
    cache.updateVersion(v1);
    const first = getCellRenderDescriptor(item, col, 0, 0, input1, cache);

    const input2 = baseInput();
    input2.activeCell = { rowIndex: 0, columnIndex: 0 };
    const v2 = CellDescriptorCache.computeVersion(input2);
    cache.updateVersion(v2);
    const second = getCellRenderDescriptor(item, col, 0, 0, input2, cache);

    expect(first).not.toBe(second);
    expect(second.isActive).toBe(true);
  });

  it('does not serve the previous row when another row lands at the same index', () => {
    // Windowed source after a sort: index 0 now holds a different row object.
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const input = baseInput();
    const cache = new CellDescriptorCache();
    cache.updateVersion(CellDescriptorCache.computeVersion(input));

    getCellRenderDescriptor({ id: '1', name: 'Alice' }, col, 0, 0, input, cache);
    const after = getCellRenderDescriptor({ id: '9', name: 'Zed' }, col, 0, 0, input, cache);

    expect(after.rowId).toBe('9');
    expect(after.displayValue).toBe('Zed');
  });

  it('recomputes when a row is mutated in place', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };
    const input = baseInput();
    const cache = new CellDescriptorCache();
    cache.updateVersion(CellDescriptorCache.computeVersion(input));

    getCellRenderDescriptor(item, col, 0, 0, input, cache);
    item.name = 'Alicia';
    expect(getCellRenderDescriptor(item, col, 0, 0, input, cache).displayValue).toBe('Alicia');
  });

  it('works without a cache (no error)', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    expect(() => {
      getCellRenderDescriptor(item, col, 0, 0, baseInput());
    }).not.toThrow();
  });
});

describe('getCellRenderDescriptor  -  formula editing', () => {
  it('returns formula string as value when editing a formula cell', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text', editable: true };
    const item: TestRow = { id: '1', name: 'computed-15' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };
    input.hasFormula = () => true;
    input.getFormula = () => '=SUM(A1:A5)';
    input.getFormulaValue = () => 15;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('editing-inline');
    // value should be the formula string, not the raw cell value
    expect(descriptor.value).toBe('=SUM(A1:A5)');
    // displayValue should be the formula computed value
    expect(descriptor.displayValue).toBe(15);
  });

  it('returns raw cell value when editing a non-formula cell', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text', editable: true };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };
    input.hasFormula = () => false;
    input.getFormula = () => undefined;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('editing-inline');
    expect(descriptor.value).toBe('Alice');
  });

  it('falls back to raw cell value when getFormula returns undefined for formula cell', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name', cellEditor: 'text', editable: true };
    const item: TestRow = { id: '1', name: 'fallback-value' };

    const input = baseInput();
    input.editingCell = { rowId: '1', columnId: 'name' };
    input.hasFormula = () => true;
    input.getFormula = () => undefined; // formula engine can't find the formula
    input.getFormulaValue = () => 15;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    // Should fall back to raw cell value when getFormula returns undefined
    expect(descriptor.value).toBe('fallback-value');
  });

  it('uses raw cell value in display mode even if cell has formula', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'raw-data' };

    const input = baseInput();
    input.hasFormula = () => true;
    input.getFormula = () => '=A1+B1';
    input.getFormulaValue = () => 42;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.mode).toBe('display');
    // In display mode, value should be the raw cell value (not the formula string)
    expect(descriptor.value).toBe('raw-data');
    // displayValue should be the formula's computed value
    expect(descriptor.displayValue).toBe(42);
  });

  it('uses formula computed value as displayValue when cell has formula', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'original' };

    const input = baseInput();
    input.hasFormula = (col, row) => col === 0 && row === 0;
    input.getFormulaValue = (col, row) => col === 0 && row === 0 ? 'computed' : undefined;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.displayValue).toBe('computed');
  });

  it('uses raw cell value as displayValue when cell has no formula', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'plain text' };

    const input = baseInput();
    input.hasFormula = () => false;
    input.getFormulaValue = () => undefined;

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.displayValue).toBe('plain text');
  });
});

describe('getCellRenderDescriptor  -  rowId and rowIndex', () => {
  it('sets rowId from getRowId function', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: 'row-42', name: 'Test' };

    const descriptor = getCellRenderDescriptor(item, col, 5, 0, baseInput());
    expect(descriptor.rowId).toBe('row-42');
  });

  it('sets rowIndex correctly', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const descriptor = getCellRenderDescriptor(item, col, 7, 0, baseInput());
    expect(descriptor.rowIndex).toBe(7);
  });

  it('sets globalColIndex using colIdx + colOffset', () => {
    const col: IColumnDef<TestRow> = { columnId: 'name', name: 'Name' };
    const item: TestRow = { id: '1', name: 'Alice' };

    const input = baseInput();
    input.colOffset = 1; // e.g. checkbox column shifts all visible cols by 1

    const descriptor = getCellRenderDescriptor(item, col, 0, 0, input);
    expect(descriptor.globalColIndex).toBe(1);
  });
});

describe('getCellRenderDescriptor  -  formula coordinates', () => {
  // Formula engine keyed by "flatCol,sheetRow".
  const formulas = new Map<string, { formula: string; value: unknown }>([['2,5', { formula: '=A6*2', value: 42 }]]);
  const formulaInput = (): CellRenderDescriptorInput<TestRow> => ({
    ...baseInput(),
    hasFormula: (col, row) => formulas.has(`${col},${row}`),
    getFormulaValue: (col, row) => formulas.get(`${col},${row}`)?.value,
    getFormula: (col, row) => formulas.get(`${col},${row}`)?.formula,
    // Column "age" is flat column 2; display row 0 shows sheet row 5.
    formulaCol: (columnId) => ['id', 'name', 'age'].indexOf(columnId),
    formulaRow: (rowIndex) => (rowIndex === 0 ? 5 : -1),
  });
  const ageCol: IColumnDef<TestRow> = { columnId: 'age', name: 'Age' };

  it('looks formulas up by flat column and sheet row, not screen position', () => {
    // Shown as the first visible column on the first displayed row.
    const d = getCellRenderDescriptor({ id: 'x', name: 'n', age: 1 }, ageCol, 0, 0, formulaInput());
    expect(d.displayValue).toBe(42);
  });

  it('shows the raw value when the row has no sheet row', () => {
    const d = getCellRenderDescriptor({ id: 'x', name: 'n', age: 1 }, ageCol, 1, 0, formulaInput());
    expect(d.displayValue).toBe(1);
  });

  it('puts the formula text in the editor for a mapped formula cell', () => {
    const input = { ...formulaInput(), editingCell: { rowId: 'x', columnId: 'age' } };
    const d = getCellRenderDescriptor({ id: 'x', name: 'n', age: 1 }, ageCol, 0, 0, input);
    expect(d.value).toBe('=A6*2');
  });
});
