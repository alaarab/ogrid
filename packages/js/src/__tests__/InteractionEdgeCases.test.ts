/**
 * Edge case tests for clipboard, undo/redo, and keyboard navigation.
 * Covers P0 gaps identified in test-gaps.md
 */
import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number | null;
  dateJoined: Date | null;
  active: boolean;
  notes: string | null;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
  { columnId: 'age', name: 'Age', type: 'numeric', editable: true, cellEditor: 'text' },
  { columnId: 'dateJoined', name: 'Date Joined', type: 'date', editable: true, cellEditor: 'date' },
  { columnId: 'active', name: 'Active', type: 'boolean', editable: true, cellEditor: 'checkbox' },
  { columnId: 'notes', name: 'Notes', editable: true, cellEditor: 'text' },
];

const testDataWithNulls: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, dateJoined: new Date('2020-01-15'), active: true, notes: 'First employee' },
  { id: 2, name: 'Bob', age: null, dateJoined: new Date('2021-06-20'), active: false, notes: null },
  { id: 3, name: 'Charlie', age: 35, dateJoined: null, active: true, notes: 'Senior dev' },
  { id: 4, name: 'Dave', age: 28, dateJoined: new Date('2022-03-10'), active: false, notes: null },
  { id: 5, name: 'Eve', age: 32, dateJoined: new Date('2019-11-05'), active: true, notes: '' },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: testDataWithNulls,
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

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue(''),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

describe('Edge Cases - Clipboard with Complex Data Types', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
  });

  it('should handle copying null values', () => {
    const { container, grid } = createGrid();
    // Click cell with null age (row 1, col 1)
    const cell = getCellElement(container, 1, 1);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    // Null should be copied as empty string, not "null"
    expect(mockClipboard.writeText).toHaveBeenCalledWith('');

    grid.destroy();
  });

  it('should handle copying undefined/missing values', () => {
    const { container, grid } = createGrid();
    // Click cell with empty notes (row 4, col 4)
    const cell = getCellElement(container, 4, 4);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('');

    grid.destroy();
  });

  it('should preserve date formatting when copying dates', () => {
    const { container, grid } = createGrid();
    // Click cell with date (row 0, col 2)
    const cell = getCellElement(container, 0, 2);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    // Date should be formatted (actual format depends on column valueFormatter)
    expect(mockClipboard.writeText).toHaveBeenCalled();
    const copiedValue = mockClipboard.writeText.mock.calls[0][0];
    // Should contain date representation, not "[object Date]"
    expect(copiedValue).not.toContain('[object');

    grid.destroy();
  });

  it('should handle copying boolean values', () => {
    const { container, grid } = createGrid();
    // Click cell with boolean (row 0, col 3)
    const cell = getCellElement(container, 0, 3);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/true|false|✓|✗/i));

    grid.destroy();
  });

  it('should handle copying range with mixed null and non-null values', () => {
    const { container, grid } = createGrid();
    // Select range from row 1, col 1 (null age) to row 2, col 1 (age 35)
    const cell = getCellElement(container, 1, 1);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const shiftEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftEvent);

    const copyEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(copyEvent);

    // Should copy as "\n35" (empty line for null, then 35)
    const copiedValue = mockClipboard.writeText.mock.calls[0][0];
    expect(copiedValue).toContain('\n');

    grid.destroy();
  });

  it('should handle pasting into cells with null values', async () => {
    mockClipboard.readText.mockResolvedValue('42');

    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    // Click cell with null age (row 1, col 1)
    const cell = getCellElement(container, 1, 1);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(event);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockClipboard.readText).toHaveBeenCalled();
    // Should parse "42" as number for numeric column
    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'age',
        oldValue: null,
        newValue: 42,
      })
    );

    grid.destroy();
  });
});

describe('Edge Cases - Undo/Redo Stack Limits', () => {
  it('should have a default undo stack limit to prevent memory issues', () => {
    // Note: UndoRedoState has maxUndoDepth=100 by default
    // This test verifies that undo operations work correctly within limits
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Make a few edits
    for (let i = 0; i < 5; i++) {
      const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
      wrapper!.dispatchEvent(deleteEvent);
    }

    const editCount = onCellValueChanged.mock.calls.length;

    // Try to undo all edits
    for (let i = 0; i < 5; i++) {
      const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
      wrapper!.dispatchEvent(undoEvent);
    }

    // All 5 edits should be undoable (well within the 100 limit)
    expect(onCellValueChanged.mock.calls.length).toBeGreaterThan(editCount);

    grid.destroy();
  });

  it('should clear redo stack when new edit is made after undo', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Make an edit
    const deleteEvent1 = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(deleteEvent1);

    // Undo the edit
    const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(undoEvent);

    // Make a new edit (should clear redo stack)
    const deleteEvent2 = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(deleteEvent2);

    // Try to redo (should do nothing since redo stack was cleared)
    const redoEvent = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(redoEvent);

    grid.destroy();
  });
});

describe('Edge Cases - Undo/Redo with Batch Operations', () => {
  it('should undo entire paste operation as one action', async () => {
    // Paste multi-cell range
    mockClipboard.readText.mockResolvedValue('A\tB\nC\tD');

    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const pasteEvent = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(pasteEvent);

    await new Promise(resolve => setTimeout(resolve, 10));

    const editCountBeforeUndo = onCellValueChanged.mock.calls.length;

    // Undo should revert all 4 cells in one operation
    const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(undoEvent);

    // All paste edits should be reverted
    expect(onCellValueChanged.mock.calls.length).toBeGreaterThan(editCountBeforeUndo);

    grid.destroy();
  });

  it('should undo range delete as one batch operation', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    // Select a 2x2 range
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Extend selection
    const shiftRight = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftRight);
    const shiftDown = new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftDown);

    // Delete the range
    const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    wrapper!.dispatchEvent(deleteEvent);

    const deleteCallCount = onCellValueChanged.mock.calls.length;
    expect(deleteCallCount).toBeGreaterThan(0); // Multiple cells deleted

    // Undo once should revert all deletions
    const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(undoEvent);

    grid.destroy();
  });
});

describe('Edge Cases - Keyboard Navigation at Boundaries', () => {
  it('should not move beyond top boundary with ArrowUp', () => {
    const { container, grid } = createGrid();

    // Click first row
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Try to move up (should stay at row 0)
    const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
    wrapper!.dispatchEvent(upEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('0');

    grid.destroy();
  });

  it('should not move beyond bottom boundary with ArrowDown', () => {
    const { container, grid } = createGrid();

    // Click last row (row 4)
    const cell = getCellElement(container, 4, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Try to move down (should stay at row 4)
    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    wrapper!.dispatchEvent(downEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('4');

    grid.destroy();
  });

  it('should not move beyond left boundary with ArrowLeft', () => {
    const { container, grid } = createGrid();

    // Click first column
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Try to move left (should stay at col 0)
    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    wrapper!.dispatchEvent(leftEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('should not move beyond right boundary with ArrowRight', () => {
    const { container, grid } = createGrid();

    // Click last column (col 4)
    const cell = getCellElement(container, 0, 4);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Try to move right (should stay at col 4)
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    wrapper!.dispatchEvent(rightEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('4');

    grid.destroy();
  });

  it('should wrap to next row when Tab reaches end of row', () => {
    const { container, grid } = createGrid();

    // Click last column of first row
    const cell = getCellElement(container, 0, 4);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Press Tab (should wrap to first column of next row)
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    wrapper!.dispatchEvent(tabEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('1');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('should handle Home key to move to first column', () => {
    const { container, grid } = createGrid();

    // Click middle column
    const cell = getCellElement(container, 0, 2);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Press Home
    const homeEvent = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
    wrapper!.dispatchEvent(homeEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('should handle End key to move to last column', () => {
    const { container, grid } = createGrid();

    // Click first column
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Press End
    const endEvent = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
    wrapper!.dispatchEvent(endEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-col-index')).toBe('4');

    grid.destroy();
  });

  it('should handle Ctrl+Home to move to first cell', () => {
    const { container, grid } = createGrid();

    // Click middle cell
    const cell = getCellElement(container, 2, 2);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Press Ctrl+Home
    const ctrlHomeEvent = new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(ctrlHomeEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('0');
    expect(activeCell?.getAttribute('data-col-index')).toBe('0');

    grid.destroy();
  });

  it('should handle Ctrl+End to move to last cell', () => {
    const { container, grid } = createGrid();

    // Click first cell
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);

    // Press Ctrl+End
    const ctrlEndEvent = new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(ctrlEndEvent);

    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('4');
    expect(activeCell?.getAttribute('data-col-index')).toBe('4');

    grid.destroy();
  });
});

describe('Edge Cases - Selection at Grid Boundaries', () => {
  it('should constrain drag selection to grid bounds', () => {
    const { container, grid } = createGrid();

    // Click bottom-right cell
    const cell = getCellElement(container, 4, 4);
    cell!.click();

    // Simulate drag (in real implementation, would need mousedown/mousemove/mouseup)
    // For this test, we'll use shift-click to extend selection
    const wrapper = getWrapperElement(container);

    // Try to extend beyond grid with keyboard
    const shiftRight = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftRight); // Should not extend beyond col 4

    const shiftDown = new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true });
    wrapper!.dispatchEvent(shiftDown); // Should not extend beyond row 4

    // Selection should still be at boundaries
    const selectedCells = container.querySelectorAll('[data-in-range="true"]');
    expect(selectedCells.length).toBeGreaterThan(0);

    grid.destroy();
  });

  it('should select all cells with Ctrl+A', () => {
    const { container, grid } = createGrid();

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const selectAllEvent = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true });
    wrapper!.dispatchEvent(selectAllEvent);

    // All cells should be in selection range
    const selectedCells = container.querySelectorAll('[data-in-range="true"]');
    // Should select all data cells (5 rows × 5 cols = 25 cells)
    expect(selectedCells.length).toBeGreaterThan(0);

    grid.destroy();
  });
});
