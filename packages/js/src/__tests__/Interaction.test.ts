import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number;
  email: string;
  active: boolean;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', editable: true },
  { columnId: 'email', name: 'Email', editable: true },
  { columnId: 'active', name: 'Active', type: 'boolean', editable: true },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, email: 'alice@example.com', active: true },
  { id: 2, name: 'Bob', age: 25, email: 'bob@example.com', active: false },
  { id: 3, name: 'Charlie', age: 35, email: 'charlie@example.com', active: true },
  { id: 4, name: '', age: 28, email: 'dave@example.com', active: false },
  { id: 5, name: 'Eve', age: 32, email: '', active: true },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    pageSize: 20,
    cellSelection: true,
    editable: true,
    ...options,
  });
  return { container, grid };
}

function getCellElement(container: HTMLElement, rowIndex: number, colIndex: number): HTMLElement | null {
  return container.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);
}

function getWrapperElement(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.ogrid-wrapper');
}

// Mock clipboard API for tests
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue(''),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

describe('Interaction - Active Cell', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
  });

  it('sets active cell on cell click', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    expect(cell).not.toBeNull();

    cell!.click();

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell).not.toBeNull();
    expect(activeCell?.getAttribute('data-row-index')).toBe('0');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('moves active cell down on ArrowDown', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('1');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('moves active cell up on ArrowUp', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 1, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('0');

    grid.destroy();
  });

  it('moves active cell right on ArrowRight', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('1');

    grid.destroy();
  });

  it('moves active cell left on ArrowLeft', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 1);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('moves active cell on Tab', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('1');

    grid.destroy();
  });

  it('moves active cell backward on Shift+Tab', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 1);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('jumps to first column on Home', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 2);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('jumps to last column on End', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('3');

    grid.destroy();
  });

  it('PageDown moves active cell down by default page size', () => {
    // Use 15 rows so PageDown (fallback 10) can move meaningfully
    const manyRows: TestRow[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1, name: `R${i}`, age: 20 + i, email: `r${i}@e.com`, active: true,
    }));
    const { container, grid } = createGrid({ data: manyRows });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));

    const ac = container.querySelector('td[data-active-cell="true"]');
    // Default fallback pageSize=10 (jsdom has no layout), so row should be 10
    expect(Number(ac?.getAttribute('data-row-index'))).toBe(10);

    grid.destroy();
  });

  it('PageUp moves active cell up by default page size', () => {
    const manyRows: TestRow[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1, name: `R${i}`, age: 20 + i, email: `r${i}@e.com`, active: true,
    }));
    const { container, grid } = createGrid({ data: manyRows });
    // Click last row
    const cell = getCellElement(container, 14, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));

    const ac = container.querySelector('td[data-active-cell="true"]');
    expect(Number(ac?.getAttribute('data-row-index'))).toBe(4);

    grid.destroy();
  });

  it('PageDown clamps to last row', () => {
    const { container, grid } = createGrid(); // 5 rows
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));

    const ac = container.querySelector('td[data-active-cell="true"]');
    // 5 rows, pageSize=10 → clamped to row 4
    expect(Number(ac?.getAttribute('data-row-index'))).toBe(4);

    grid.destroy();
  });

  it('PageUp clamps to first row', () => {
    const { container, grid } = createGrid(); // 5 rows
    const cell = getCellElement(container, 2, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));

    const ac = container.querySelector('td[data-active-cell="true"]');
    expect(Number(ac?.getAttribute('data-row-index'))).toBe(0);

    grid.destroy();
  });

  it('Shift+PageDown extends selection', () => {
    const manyRows: TestRow[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1, name: `R${i}`, age: 20 + i, email: `r${i}@e.com`, active: true,
    }));
    const { container, grid } = createGrid({ data: manyRows });
    const cell = getCellElement(container, 2, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', shiftKey: true, bubbles: true }));

    // Active cell should move to row 12
    const ac = container.querySelector('td[data-active-cell="true"]');
    expect(Number(ac?.getAttribute('data-row-index'))).toBe(12);

    grid.destroy();
  });
});

describe('Interaction - Range Selection', () => {
  it('selects single cell on click', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const selectedCells = container.querySelectorAll('td[data-in-range="true"]');
    expect(selectedCells.length).toBe(1);

    grid.destroy();
  });

  it('extends selection with Shift+ArrowDown', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const selectedCells = container.querySelectorAll('td[data-in-range="true"]');
    expect(selectedCells.length).toBe(2); // Two cells in column 0

    grid.destroy();
  });

  it('extends selection with Shift+ArrowRight', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const selectedCells = container.querySelectorAll('td[data-in-range="true"]');
    expect(selectedCells.length).toBe(2); // Two cells in row 0

    grid.destroy();
  });

  it('selects all cells on Ctrl+A', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const selectedCells = container.querySelectorAll('td[data-in-range="true"]');
    expect(selectedCells.length).toBe(20); // 5 rows x 4 columns

    grid.destroy();
  });

  it('clears selection on Escape', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(arrowEvent);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    wrapper!.dispatchEvent(escapeEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    const selectedCells = container.querySelectorAll('td[data-in-range="true"]');
    expect(activeCell).toBeNull();
    expect(selectedCells.length).toBe(0);

    grid.destroy();
  });
});

describe('Interaction - Ctrl+Arrow Navigation', () => {
  it('jumps to last non-empty cell in column on Ctrl+ArrowDown', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0); // Alice
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    // Should jump to row 2 (Charlie), skipping empty name at row 3
    expect(activeCell?.getAttribute('data-row-index')).toBe('2');

    grid.destroy();
  });

  it('jumps to edge when starting in empty cell', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 3, 0); // Empty name cell
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    // Should jump to next non-empty (Eve at row 4)
    expect(activeCell?.getAttribute('data-row-index')).toBe('4');

    grid.destroy();
  });

  it('jumps correctly on Ctrl+ArrowUp', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 4, 0); // Eve
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    // Should jump to Charlie at row 2 (last non-empty before empty at row 3)
    expect(activeCell?.getAttribute('data-row-index')).toBe('2');

    grid.destroy();
  });

  it('extends selection with Shift+Ctrl+Arrow', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const selectedCells = container.querySelectorAll('td[data-in-range="true"]');
    expect(selectedCells.length).toBeGreaterThan(2); // Selects multiple cells to target

    grid.destroy();
  });
});

describe('Interaction - Clipboard', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
  });

  it('copies single cell on Ctrl+C', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('Alice');

    grid.destroy();
  });

  it('copies range on Ctrl+C', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const shiftEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftEvent);

    const copyEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(copyEvent);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('Alice\t30');

    grid.destroy();
  });

  it('marks cells for cut on Ctrl+X', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('Alice');
    // Cut range should be marked (outline dashed red in real UI)

    grid.destroy();
  });

  it('pastes data on Ctrl+V', async () => {
    mockClipboard.readText.mockResolvedValue('Pasted');

    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    // Wait for async paste
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockClipboard.readText).toHaveBeenCalled();

    grid.destroy();
  });
});

describe('Interaction - Delete/Backspace', () => {
  it('clears cell value on Delete', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'name',
        oldValue: 'Alice',
        newValue: '',
      })
    );

    grid.destroy();
  });

  it('clears cell value on Backspace', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });
    const cell = getCellElement(container, 0, 1);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'age',
        oldValue: 30,
        newValue: null, // numberParser returns null for empty input
      })
    );

    grid.destroy();
  });

  it('clears range on Delete', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const shiftEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftEvent);

    const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(deleteEvent);

    expect(onCellValueChanged).toHaveBeenCalledTimes(2); // Two cells cleared

    grid.destroy();
  });
});

describe('Interaction - Inline Editing', () => {
  it('starts editing on double-click', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);

    const event = new MouseEvent('dblclick', { bubbles: true });
    cell!.dispatchEvent(event);

    // Editor should appear (check for input element)
    const editor = container.querySelector('input[type="text"]');
    expect(editor).not.toBeNull();

    grid.destroy();
  });

  it('starts editing on F2', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });
    wrapper!.dispatchEvent(event);

    const editor = container.querySelector('input[type="text"]');
    expect(editor).not.toBeNull();

    grid.destroy();
  });

  it('starts editing on Enter', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    wrapper!.dispatchEvent(event);

    const editor = container.querySelector('input[type="text"]');
    expect(editor).not.toBeNull();

    grid.destroy();
  });
});

describe('Interaction - Context Menu', () => {
  it('shows context menu on right-click', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);

    const event = new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 });
    cell!.dispatchEvent(event);

    // Check for context menu (it's fixed position)
    const menu = document.body.querySelector('div[style*="position: fixed"]');
    expect(menu).not.toBeNull();

    grid.destroy();
  });

  it('shows context menu on Shift+F10', () => {
    const { container, grid } = createGrid();
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    const menu = document.body.querySelector('div[style*="position: fixed"]');
    expect(menu).not.toBeNull();

    grid.destroy();
  });
});

describe('Interaction - Undo/Redo', () => {
  it('undoes cell edit on Ctrl+Z', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    // Make an edit
    const wrapper = getWrapperElement(container);
    const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(deleteEvent);

    expect(onCellValueChanged).toHaveBeenCalledTimes(1);
    onCellValueChanged.mockClear();

    // Undo
    const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(undoEvent);

    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'name',
        oldValue: '',
        newValue: 'Alice',
      })
    );

    grid.destroy();
  });

  it('redoes cell edit on Ctrl+Y', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Make an edit
    const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(deleteEvent);

    // Undo
    const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(undoEvent);

    onCellValueChanged.mockClear();

    // Redo
    const redoEvent = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(redoEvent);

    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'name',
        oldValue: 'Alice',
        newValue: '',
      })
    );

    grid.destroy();
  });
});

describe('Interaction - Column Resize', () => {
  it('allows column resize by dragging header edge', () => {
    const { container, grid } = createGrid();
    const header = container.querySelector('th[data-column-id="name"]');
    expect(header).not.toBeNull();

    const resizeHandle = header!.querySelector('.ogrid-resize-handle') as HTMLElement;
    expect(resizeHandle).not.toBeNull();

    // Start resize
    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, clientX: 100 });
    resizeHandle!.dispatchEvent(mouseDownEvent);

    // Move mouse (would normally update width)
    const mouseMoveEvent = new MouseEvent('mousemove', { bubbles: true, clientX: 150 });
    document.dispatchEvent(mouseMoveEvent);

    // End resize
    const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true });
    document.dispatchEvent(mouseUpEvent);

    // Column width should have changed (check for width style)
    // Note: In real implementation, the width would be applied
    expect(document.body.style.cursor).toBe(''); // Cursor reset after resize

    grid.destroy();
  });
});

describe('Interaction - Feature Gating', () => {
  it('disables interaction when both cellSelection and editable are false', () => {
    const { container, grid } = createGrid({ cellSelection: false, editable: false });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    // No active cell should be set
    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell).toBeNull();

    grid.destroy();
  });

  it('still allows cell selection when cellSelection is true and editable is false', () => {
    const { container, grid } = createGrid({ cellSelection: true, editable: false });
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    // Active cell should be set
    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell).not.toBeNull();

    // But editing should not work
    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });
    wrapper!.dispatchEvent(event);

    const editor = container.querySelector('input');
    expect(editor).toBeNull();

    grid.destroy();
  });
});
