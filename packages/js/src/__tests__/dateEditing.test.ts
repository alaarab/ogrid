/**
 * Tests for date editing in JS package.
 * Covers configurable date formats and editor types via InlineCellEditor and OGrid.
 */

import { OGrid } from '../OGrid';
import { InlineCellEditor } from '../components/InlineCellEditor';
import type { IColumnDef, OGridOptions } from '../types';
import { formatDateForDisplay, parseUserInputDate, getDateInputPlaceholder } from '@alaarab/ogrid-core';

interface DateRow {
  id: number;
  name: string;
  startDate: string;
  birthDate?: string;
}

const isoDate = '2024-03-15T00:00:00.000Z';
const isoDateShort = '2024-03-15';

// ---------------------------------------------------------------------------
// Core date formatter utility tests (used by InlineCellEditor)
// ---------------------------------------------------------------------------

describe('formatDateForDisplay', () => {
  it('returns null for null/undefined values', () => {
    expect(formatDateForDisplay(null, 'YYYY-MM-DD')).toBeNull();
    expect(formatDateForDisplay(undefined, 'YYYY-MM-DD')).toBeNull();
  });

  it('formats ISO string with YYYY-MM-DD format', () => {
    expect(formatDateForDisplay(isoDate, 'YYYY-MM-DD')).toBe('2024-03-15');
    expect(formatDateForDisplay(isoDateShort, 'YYYY-MM-DD')).toBe('2024-03-15');
  });

  it('formats with MM/DD/YYYY format', () => {
    expect(formatDateForDisplay(isoDate, 'MM/DD/YYYY')).toBe('03/15/2024');
    expect(formatDateForDisplay(isoDateShort, 'MM/DD/YYYY')).toBe('03/15/2024');
  });

  it('formats with DD/MM/YYYY format', () => {
    expect(formatDateForDisplay(isoDate, 'DD/MM/YYYY')).toBe('15/03/2024');
    expect(formatDateForDisplay(isoDateShort, 'DD/MM/YYYY')).toBe('15/03/2024');
  });

  it('handles single-digit month/day with padding', () => {
    expect(formatDateForDisplay('2024-01-05', 'MM/DD/YYYY')).toBe('01/05/2024');
    expect(formatDateForDisplay('2024-01-05', 'DD/MM/YYYY')).toBe('05/01/2024');
  });

  it('returns null for non-date values', () => {
    expect(formatDateForDisplay('not-a-date', 'YYYY-MM-DD')).toBeNull();
  });
});

describe('parseUserInputDate', () => {
  it('returns null for empty input', () => {
    expect(parseUserInputDate('', 'YYYY-MM-DD')).toBeNull();
    expect(parseUserInputDate('  ', 'YYYY-MM-DD')).toBeNull();
  });

  it('parses YYYY-MM-DD format', () => {
    const result = parseUserInputDate('2024-03-15', 'YYYY-MM-DD');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCFullYear()).toBe(2024);
    expect((result as Date).getUTCMonth()).toBe(2); // 0-indexed March
    expect((result as Date).getUTCDate()).toBe(15);
  });

  it('parses MM/DD/YYYY format', () => {
    const result = parseUserInputDate('03/15/2024', 'MM/DD/YYYY');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCFullYear()).toBe(2024);
    expect((result as Date).getUTCMonth()).toBe(2);
    expect((result as Date).getUTCDate()).toBe(15);
  });

  it('parses DD/MM/YYYY format', () => {
    const result = parseUserInputDate('15/03/2024', 'DD/MM/YYYY');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCFullYear()).toBe(2024);
    expect((result as Date).getUTCMonth()).toBe(2);
    expect((result as Date).getUTCDate()).toBe(15);
  });

  it('returns null for invalid dates', () => {
    expect(parseUserInputDate('not-a-date', 'MM/DD/YYYY')).toBeNull();
    expect(parseUserInputDate('13/45/2024', 'MM/DD/YYYY')).toBeNull();
  });
});

describe('getDateInputPlaceholder', () => {
  it('returns the format string as placeholder', () => {
    expect(getDateInputPlaceholder('MM/DD/YYYY')).toBe('MM/DD/YYYY');
    expect(getDateInputPlaceholder('DD/MM/YYYY')).toBe('DD/MM/YYYY');
    expect(getDateInputPlaceholder('YYYY-MM-DD')).toBe('YYYY-MM-DD');
  });
});

// ---------------------------------------------------------------------------
// InlineCellEditor date editor tests
// ---------------------------------------------------------------------------

function createEditorWithContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = new InlineCellEditor<DateRow>(container);
  return { container, editor };
}

function makeDateColumn(overrides: Partial<IColumnDef<DateRow>> = {}): IColumnDef<DateRow> {
  return {
    columnId: 'startDate',
    name: 'Start Date',
    type: 'date',
    editable: true,
    ...overrides,
  };
}

function makeCell(): HTMLTableCellElement {
  const cell = document.createElement('td');
  Object.defineProperty(cell, 'getBoundingClientRect', {
    value: () => ({ left: 10, top: 10, width: 100, height: 30, bottom: 40, right: 110 }),
  });
  document.body.appendChild(cell);
  return cell;
}

function startEdit(
  editor: InlineCellEditor<DateRow>,
  column: IColumnDef<DateRow>,
  value: unknown,
  onCommit: jest.Mock,
  onCancel: jest.Mock = jest.fn()
) {
  const item: DateRow = { id: 1, name: 'Alice', startDate: String(value ?? '') };
  const cell = makeCell();
  editor.startEdit(1, 'startDate', item, column, cell, onCommit, onCancel);
}

afterEach(() => {
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

describe('InlineCellEditor - default date editor (text, YYYY-MM-DD)', () => {
  it('creates a text input for date column without cellEditorParams', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('2024-03-15');
    expect(input.placeholder).toBe('YYYY-MM-DD');

    editor.destroy();
  });

  it('commits YYYY-MM-DD value on Enter', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();
    startEdit(editor, column, isoDateShort, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '2024-06-20';

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-06-20');
    editor.destroy();
  });

  it('commits on blur', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();
    startEdit(editor, column, isoDateShort, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '2024-09-01';

    const blurEvent = new Event('blur', { bubbles: true });
    input.dispatchEvent(blurEvent);

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-09-01');
    editor.destroy();
  });

  it('cancels on Escape', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    startEdit(editor, column, isoDateShort, onCommit, onCancel);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    input.dispatchEvent(escEvent);

    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('handles null initial value', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();
    startEdit(editor, column, null, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('');
    editor.destroy();
  });

  it('commits empty string for cleared input on blur', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();
    startEdit(editor, column, isoDateShort, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '');
    editor.destroy();
  });
});

describe('InlineCellEditor - MM/DD/YYYY format', () => {
  it('displays ISO date in MM/DD/YYYY format', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('03/15/2024');
    expect(input.placeholder).toBe('MM/DD/YYYY');

    editor.destroy();
  });

  it('parses MM/DD/YYYY input and commits YYYY-MM-DD on Enter', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '06/20/2024';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-06-20');
    editor.destroy();
  });

  it('commits raw value for invalid MM/DD/YYYY input', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'invalid-date';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);

    // Should pass raw invalid string through
    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', 'invalid-date');
    editor.destroy();
  });

  it('parses MM/DD/YYYY on blur and commits YYYY-MM-DD', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '01/05/2024';
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-01-05');
    editor.destroy();
  });
});

describe('InlineCellEditor - DD/MM/YYYY format', () => {
  it('displays ISO date in DD/MM/YYYY format', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'DD/MM/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('15/03/2024');
    expect(input.placeholder).toBe('DD/MM/YYYY');

    editor.destroy();
  });

  it('parses DD/MM/YYYY input and commits YYYY-MM-DD on Enter', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'DD/MM/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '20/06/2024';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-06-20');
    editor.destroy();
  });

  it('parses DD/MM/YYYY input and commits YYYY-MM-DD on blur', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'DD/MM/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '05/01/2024';
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-01-05');
    editor.destroy();
  });
});

describe('InlineCellEditor - native date editor', () => {
  it('creates native <input type="date"> for editorType=native', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { editorType: 'native' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // Native date input gets YYYY-MM-DD value
    expect(input.value).toBe('2024-03-15');

    editor.destroy();
  });

  it('native editor commits YYYY-MM-DD value on Enter', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { editorType: 'native' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    input.value = '2024-09-01';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-09-01');
    editor.destroy();
  });

  it('native editor handles null initial value', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { editorType: 'native' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, null, onCommit);

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('');

    editor.destroy();
  });

  it('native editor handles empty string initial value', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { editorType: 'native' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, '', onCommit);

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input.value).toBe('');

    editor.destroy();
  });

  it('native editor commits on blur', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { editorType: 'native' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, isoDate, onCommit);

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    input.value = '2024-12-01';
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-12-01');
    editor.destroy();
  });
});

describe('InlineCellEditor - backward compatibility', () => {
  it('existing YYYY-MM-DD dates work without cellEditorParams', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();

    startEdit(editor, column, '2023-12-31', onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('2023-12-31');

    input.value = '2024-01-01';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(enterEvent);

    expect(onCommit).toHaveBeenCalledWith(1, 'startDate', '2024-01-01');
    editor.destroy();
  });

  it('full ISO timestamp value renders correctly in YYYY-MM-DD', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn();
    const onCommit = jest.fn();

    startEdit(editor, column, '2024-06-15T10:30:00.000Z', onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('2024-06-15');

    editor.destroy();
  });

  it('date column with cellEditor="date" (explicit) works the same as type="date"', () => {
    const { container, editor } = createEditorWithContainer();
    const column: IColumnDef<DateRow> = {
      columnId: 'startDate',
      name: 'Start Date',
      cellEditor: 'date',
      editable: true,
    };
    const onCommit = jest.fn();
    startEdit(editor, column, isoDateShort, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('2024-03-15');

    editor.destroy();
  });

  it('null value with MM/DD/YYYY format shows empty input', () => {
    const { container, editor } = createEditorWithContainer();
    const column = makeDateColumn({
      cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
    });
    const onCommit = jest.fn();
    startEdit(editor, column, null, onCommit);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('');

    editor.destroy();
  });
});

// ---------------------------------------------------------------------------
// OGrid integration tests - date columns via grid
// ---------------------------------------------------------------------------

describe('OGrid - date column integration', () => {
  const dateData: DateRow[] = [
    { id: 1, name: 'Alice', startDate: '2024-03-15T00:00:00.000Z' },
    { id: 2, name: 'Bob', startDate: '2024-01-01' },
    { id: 3, name: 'Charlie', startDate: '' },
  ];

  function createDateGrid(options?: Partial<OGridOptions<DateRow>>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<DateRow>(container, {
      columns: [
        { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
        {
          columnId: 'startDate',
          name: 'Start Date',
          type: 'date',
          editable: true,
          cellEditor: 'date',
        },
      ],
      data: dateData,
      getRowId: (row) => row.id,
      pageSize: 20,
      editable: true,
      ...options,
    });
    return { container, grid };
  }

  it('renders a grid with date column', () => {
    const { container, grid } = createDateGrid();
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    grid.destroy();
  });

  it('grid with MM/DD/YYYY date column creates correct column def', () => {
    const { container, grid } = createDateGrid({
      columns: [
        {
          columnId: 'startDate',
          name: 'Start Date',
          type: 'date',
          editable: true,
          cellEditor: 'date',
          cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
        },
      ],
    });
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    grid.destroy();
  });

  it('grid with DD/MM/YYYY date column creates correct column def', () => {
    const { container, grid } = createDateGrid({
      columns: [
        {
          columnId: 'startDate',
          name: 'Start Date',
          type: 'date',
          editable: true,
          cellEditor: 'date',
          cellEditorParams: { dateFormat: 'DD/MM/YYYY' },
        },
      ],
    });
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    grid.destroy();
  });

  it('grid with native date editor creates correct column def', () => {
    const { container, grid } = createDateGrid({
      columns: [
        {
          columnId: 'startDate',
          name: 'Start Date',
          type: 'date',
          editable: true,
          cellEditor: 'date',
          cellEditorParams: { editorType: 'native' },
        },
      ],
    });
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    grid.destroy();
  });

  it('grid renders and does not error with multiple date format columns', () => {
    const { container, grid } = createDateGrid({
      columns: [
        {
          columnId: 'startDate',
          name: 'Start Date',
          type: 'date',
          editable: true,
          cellEditor: 'date',
          cellEditorParams: { dateFormat: 'MM/DD/YYYY' },
        },
        {
          columnId: 'name',
          name: 'Name',
          editable: true,
          cellEditor: 'text',
        },
      ],
    });
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    grid.destroy();
  });
});
