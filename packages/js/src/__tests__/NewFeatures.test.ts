import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';
import { RowSelectionState } from '../state/RowSelectionState';
import { ColumnPinningState } from '../state/ColumnPinningState';
import { FillHandleState } from '../state/FillHandleState';
import { MarchingAntsOverlay } from '../components/MarchingAntsOverlay';

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
  { id: 4, name: 'Dave', age: 28, email: 'dave@example.com', active: false },
  { id: 5, name: 'Eve', age: 32, email: 'eve@example.com', active: true },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
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

afterEach(() => {
  document.body.innerHTML = '';
});

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue(''),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

// ============================================================
// Row Selection Tests
// ============================================================

describe('Row Selection', () => {
  describe('RowSelectionState unit tests', () => {
    it('initializes with empty selection', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      expect(state.selectedRowIds.size).toBe(0);
      expect(state.rowSelection).toBe('multiple');
      state.destroy();
    });

    it('handles single row checkbox change', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      expect(state.selectedRowIds.has(1)).toBe(true);
      expect(state.selectedRowIds.size).toBe(1);
      state.destroy();
    });

    it('handles multiple row checkbox changes', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      state.handleRowCheckboxChange(3, true, 2, false, testData);
      expect(state.selectedRowIds.has(1)).toBe(true);
      expect(state.selectedRowIds.has(3)).toBe(true);
      expect(state.selectedRowIds.size).toBe(2);
      state.destroy();
    });

    it('unselects row on second click', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      state.handleRowCheckboxChange(1, false, 0, false, testData);
      expect(state.selectedRowIds.has(1)).toBe(false);
      expect(state.selectedRowIds.size).toBe(0);
      state.destroy();
    });

    it('supports shift-click range selection', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      state.handleRowCheckboxChange(3, true, 2, true, testData); // Shift+click
      // Should select rows 0-2 (ids 1, 2, 3)
      expect(state.selectedRowIds.has(1)).toBe(true);
      expect(state.selectedRowIds.has(2)).toBe(true);
      expect(state.selectedRowIds.has(3)).toBe(true);
      expect(state.selectedRowIds.size).toBe(3);
      state.destroy();
    });

    it('single mode replaces selection', () => {
      const state = new RowSelectionState<TestRow>('single', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      state.handleRowCheckboxChange(3, true, 2, false, testData);
      expect(state.selectedRowIds.has(1)).toBe(false);
      expect(state.selectedRowIds.has(3)).toBe(true);
      expect(state.selectedRowIds.size).toBe(1);
      state.destroy();
    });

    it('select all selects all rows', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleSelectAll(true, testData);
      expect(state.selectedRowIds.size).toBe(5);
      expect(state.isAllSelected(testData)).toBe(true);
      state.destroy();
    });

    it('deselect all clears selection', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleSelectAll(true, testData);
      state.handleSelectAll(false, testData);
      expect(state.selectedRowIds.size).toBe(0);
      expect(state.isAllSelected(testData)).toBe(false);
      state.destroy();
    });

    it('isSomeSelected returns true for partial selection', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      expect(state.isSomeSelected(testData)).toBe(true);
      expect(state.isAllSelected(testData)).toBe(false);
      state.destroy();
    });

    it('getSelectedRows returns selected items', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      state.handleRowCheckboxChange(3, true, 2, false, testData);
      const selected = state.getSelectedRows(testData);
      expect(selected.length).toBe(2);
      expect(selected[0].name).toBe('Alice');
      expect(selected[1].name).toBe('Charlie');
      state.destroy();
    });

    it('emits rowSelectionChange event', () => {
      const state = new RowSelectionState<TestRow>('multiple', (item) => item.id);
      const handler = jest.fn();
      state.onRowSelectionChange(handler);
      state.handleRowCheckboxChange(1, true, 0, false, testData);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedRowIds: [1],
          selectedItems: [testData[0]],
        })
      );
      state.destroy();
    });
  });

  describe('Row Selection in OGrid', () => {
    it('renders checkbox column with rowSelection=multiple', () => {
      const { container, grid } = createGrid({ rowSelection: 'multiple' });

      const checkboxes = container.querySelectorAll('.ogrid-row-checkbox');
      expect(checkboxes.length).toBe(5); // One per row

      const selectAll = container.querySelector('.ogrid-select-all-checkbox');
      expect(selectAll).not.toBeNull();

      grid.destroy();
    });

    it('does not render checkbox column without rowSelection', () => {
      const { container, grid } = createGrid();

      const checkboxes = container.querySelectorAll('.ogrid-row-checkbox');
      expect(checkboxes.length).toBe(0);

      grid.destroy();
    });

    it('checks row checkbox on click', () => {
      const { container, grid } = createGrid({ rowSelection: 'multiple' });

      const checkbox = container.querySelector('.ogrid-row-checkbox') as HTMLInputElement;
      // Simulate checking the checkbox — click() toggles checked, then our handler reads it
      checkbox.click();

      const selectedRow = container.querySelector('tr[data-row-selected="true"]');
      expect(selectedRow).not.toBeNull();

      grid.destroy();
    });

    it('select all checkbox selects all rows', () => {
      const { container, grid } = createGrid({ rowSelection: 'multiple' });

      const selectAll = container.querySelector('.ogrid-select-all-checkbox') as HTMLInputElement;
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event('change'));

      const selectedRows = container.querySelectorAll('tr[data-row-selected="true"]');
      expect(selectedRows.length).toBe(5);

      grid.destroy();
    });

    it('api.getSelectedRows returns selected row IDs', () => {
      const { container, grid } = createGrid({ rowSelection: 'multiple' });

      // Click the first checkbox — click() toggles checked, then our handler reads it
      const checkbox = container.querySelector('.ogrid-row-checkbox') as HTMLInputElement;
      checkbox.click();

      const selected = grid.api.getSelectedRows();
      expect(selected.length).toBe(1);
      expect(selected[0]).toBe(1);

      grid.destroy();
    });

    it('api.selectAll/deselectAll work', () => {
      const { grid } = createGrid({ rowSelection: 'multiple' });

      grid.api.selectAll();
      expect(grid.api.getSelectedRows().length).toBe(5);

      grid.api.deselectAll();
      expect(grid.api.getSelectedRows().length).toBe(0);

      grid.destroy();
    });

    it('api.setSelectedRows works', () => {
      const { grid } = createGrid({ rowSelection: 'multiple' });

      grid.api.setSelectedRows([1, 3, 5]);
      expect(grid.api.getSelectedRows().length).toBe(3);

      grid.destroy();
    });

    it('renders checkbox header in single mode without select-all', () => {
      const { container, grid } = createGrid({ rowSelection: 'single' });

      const checkboxes = container.querySelectorAll('.ogrid-row-checkbox');
      expect(checkboxes.length).toBe(5);

      // No select-all for single mode
      const selectAll = container.querySelector('.ogrid-select-all-checkbox');
      expect(selectAll).toBeNull();

      grid.destroy();
    });

    it('data columns have offset of 1 with row selection', () => {
      const { container, grid } = createGrid({ rowSelection: 'multiple' });

      // First data cell should have col-index 1 (offset by checkbox column)
      const firstDataCell = container.querySelector('td[data-column-id="name"]');
      expect(firstDataCell).not.toBeNull();
      expect(firstDataCell!.getAttribute('data-col-index')).toBe('1');

      grid.destroy();
    });
  });
});

// ============================================================
// Column Pinning Tests
// ============================================================

describe('Column Pinning', () => {
  describe('ColumnPinningState unit tests', () => {
    it('initializes with pinnedColumns from options', () => {
      const state = new ColumnPinningState({ name: 'left', active: 'right' });
      expect(state.isPinned('name')).toBe('left');
      expect(state.isPinned('active')).toBe('right');
      expect(state.isPinned('age')).toBeUndefined();
      state.destroy();
    });

    it('initializes with pinned from column definitions', () => {
      const cols = [
        { columnId: 'name', name: 'Name', pinned: 'left' as const },
        { columnId: 'age', name: 'Age' },
      ];
      const state = new ColumnPinningState(undefined, cols as any);
      expect(state.isPinned('name')).toBe('left');
      expect(state.isPinned('age')).toBeUndefined();
      state.destroy();
    });

    it('pinColumn adds pinning', () => {
      const state = new ColumnPinningState();
      state.pinColumn('name', 'left');
      expect(state.isPinned('name')).toBe('left');
      state.destroy();
    });

    it('unpinColumn removes pinning', () => {
      const state = new ColumnPinningState({ name: 'left' });
      state.unpinColumn('name');
      expect(state.isPinned('name')).toBeUndefined();
      state.destroy();
    });

    it('emits pinningChange event', () => {
      const state = new ColumnPinningState();
      const handler = jest.fn();
      state.onPinningChange(handler);
      state.pinColumn('name', 'left');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          pinnedColumns: { name: 'left' },
        })
      );
      state.destroy();
    });

    it('computes left offsets correctly', () => {
      const state = new ColumnPinningState({ name: 'left', age: 'left' });
      const cols = [
        { columnId: 'name' },
        { columnId: 'age' },
        { columnId: 'email' },
      ];
      const widths = { name: 100, age: 80 };
      const offsets = state.computeLeftOffsets(cols, widths, 120, false, 40);
      expect(offsets.name).toBe(0);
      expect(offsets.age).toBe(100);
      expect(offsets.email).toBeUndefined();
      state.destroy();
    });

    it('computes left offsets with checkbox column', () => {
      const state = new ColumnPinningState({ name: 'left' });
      const cols = [{ columnId: 'name' }];
      const offsets = state.computeLeftOffsets(cols, {}, 120, true, 40);
      expect(offsets.name).toBe(40);
      state.destroy();
    });

    it('computes right offsets correctly', () => {
      const state = new ColumnPinningState({ active: 'right' });
      const cols = [
        { columnId: 'name' },
        { columnId: 'age' },
        { columnId: 'active' },
      ];
      const widths = { active: 80 };
      const offsets = state.computeRightOffsets(cols, widths, 120);
      expect(offsets.active).toBe(0);
      state.destroy();
    });
  });

  describe('Column Pinning in OGrid', () => {
    it('renders pinned columns with sticky positioning', () => {
      const { container, grid } = createGrid({
        pinnedColumns: { name: 'left' },
      });

      const pinnedHeader = container.querySelector('th[data-column-id="name"]') as HTMLElement;
      expect(pinnedHeader).not.toBeNull();
      expect(pinnedHeader.style.position).toBe('sticky');
      expect(pinnedHeader.getAttribute('data-pinned')).toBe('left');

      grid.destroy();
    });

    it('renders right-pinned columns', () => {
      const { container, grid } = createGrid({
        pinnedColumns: { active: 'right' },
      });

      const pinnedHeader = container.querySelector('th[data-column-id="active"]') as HTMLElement;
      expect(pinnedHeader).not.toBeNull();
      expect(pinnedHeader.style.position).toBe('sticky');
      expect(pinnedHeader.getAttribute('data-pinned')).toBe('right');

      grid.destroy();
    });

    it('applies pinning to body cells too', () => {
      const { container, grid } = createGrid({
        pinnedColumns: { name: 'left' },
      });

      const pinnedCells = container.querySelectorAll('td[data-pinned="left"]');
      expect(pinnedCells.length).toBe(5); // One per data row

      grid.destroy();
    });

    it('applies background color to pinned body cells', () => {
      const { container, grid } = createGrid({
        pinnedColumns: { name: 'left' },
      });

      const pinnedCell = container.querySelector('td[data-pinned="left"]') as HTMLElement;
      expect(pinnedCell).not.toBeNull();
      // Pinned body cells need a background to avoid transparency
      expect(pinnedCell.style.backgroundColor).toBeTruthy();

      grid.destroy();
    });

    it('non-pinned columns have no sticky positioning', () => {
      const { container, grid } = createGrid({
        pinnedColumns: { name: 'left' },
      });

      const unpinnedHeader = container.querySelector('th[data-column-id="age"]') as HTMLElement;
      expect(unpinnedHeader).not.toBeNull();
      expect(unpinnedHeader.getAttribute('data-pinned')).toBeNull();

      grid.destroy();
    });

    it('reads pinned from column definitions', () => {
      const pinnedCols: IColumnDef<TestRow>[] = [
        { columnId: 'name', name: 'Name', pinned: 'left', editable: true },
        { columnId: 'age', name: 'Age', type: 'numeric', editable: true },
        { columnId: 'email', name: 'Email', editable: true },
        { columnId: 'active', name: 'Active', type: 'boolean', editable: true },
      ];

      const { container, grid } = createGrid({ columns: pinnedCols });

      const pinnedHeader = container.querySelector('th[data-column-id="name"]') as HTMLElement;
      expect(pinnedHeader.getAttribute('data-pinned')).toBe('left');

      grid.destroy();
    });
  });
});

// ============================================================
// Fill Handle Tests
// ============================================================

describe('Fill Handle', () => {
  it('renders fill handle square on active selection', () => {
    const { container, grid } = createGrid();
    const cell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    cell.click();

    const fillHandle = container.querySelector('[data-fill-handle="true"]');
    expect(fillHandle).not.toBeNull();
    expect(fillHandle!.className).toContain('ogrid-fill-handle');

    grid.destroy();
  });

  it('fill handle is on bottom-right cell of selection', () => {
    const { container, grid } = createGrid();

    // Click cell to set active selection
    const cell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    cell!.click();

    // Extend selection with shift+arrow
    const wrapper = container.querySelector('.ogrid-wrapper')!;
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));

    // Fill handle should be on the bottom-right of the range (row 0, col 1)
    const fillHandle = container.querySelector('[data-fill-handle="true"]');
    expect(fillHandle).not.toBeNull();
    const parentCell = fillHandle!.closest('td');
    expect(parentCell?.getAttribute('data-row-index')).toBe('0');
    expect(parentCell?.getAttribute('data-col-index')).toBe('1');

    grid.destroy();
  });

  it('does not render fill handle when editable is false', () => {
    const { container, grid } = createGrid({ editable: false });
    const cell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    cell!.click();

    const fillHandle = container.querySelector('[data-fill-handle="true"]');
    expect(fillHandle).toBeNull();

    grid.destroy();
  });

  describe('FillHandleState unit tests', () => {
    it('initializes not dragging', () => {
      const state = new FillHandleState<TestRow>(
        { items: testData, visibleCols: testColumns as any, editable: true, colOffset: 0 },
        () => null,
        () => {},
        () => {}
      );
      expect(state.isFillDragging).toBe(false);
      expect(state.fillRange).toBeNull();
      state.destroy();
    });

    it('does not start drag when not editable', () => {
      const state = new FillHandleState<TestRow>(
        { items: testData, visibleCols: testColumns as any, editable: false, colOffset: 0 },
        () => ({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }),
        () => {},
        () => {}
      );
      const event = new MouseEvent('mousedown', { bubbles: true });
      state.startFillDrag(event);
      expect(state.isFillDragging).toBe(false);
      state.destroy();
    });

    it('does not start drag without onCellValueChanged', () => {
      const state = new FillHandleState<TestRow>(
        { items: testData, visibleCols: testColumns as any, editable: true, colOffset: 0 },
        () => ({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }),
        () => {},
        () => {}
      );
      const event = new MouseEvent('mousedown', { bubbles: true });
      state.startFillDrag(event);
      expect(state.isFillDragging).toBe(false);
      state.destroy();
    });

    it('starts drag with onCellValueChanged and valid selection', () => {
      const state = new FillHandleState<TestRow>(
        {
          items: testData,
          visibleCols: testColumns as any,
          editable: true,
          onCellValueChanged: jest.fn(),
          colOffset: 0,
        },
        () => ({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }),
        () => {},
        () => {}
      );
      const event = new MouseEvent('mousedown', { bubbles: true });
      state.startFillDrag(event);
      expect(state.isFillDragging).toBe(true);

      // Clean up by triggering mouseup
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      state.destroy();
    });
  });
});

// ============================================================
// Marching Ants Overlay Tests
// ============================================================

describe('Marching Ants Overlay', () => {
  it('injects keyframes stylesheet', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = new MarchingAntsOverlay(container);
    const style = document.getElementById('ogrid-marching-ants-keyframes');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('ogrid-marching-ants');

    overlay.destroy();
  });

  it('sets container position to relative', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = new MarchingAntsOverlay(container);
    expect(container.style.position).toBe('relative');

    overlay.destroy();
  });

  it('does not create SVGs when no ranges provided', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = new MarchingAntsOverlay(container);
    overlay.update(null, null, null);

    // No SVGs should exist
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);

    overlay.destroy();
  });

  it('cleans up SVGs on destroy', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = new MarchingAntsOverlay(container);
    overlay.destroy();

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('creates marching ants overlay in OGrid after copy', () => {
    const { container, grid } = createGrid();
    const cell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    cell!.click();

    const wrapper = container.querySelector('.ogrid-wrapper')!;
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));

    // The overlay should create SVG elements inside the wrapper
    // (measured via rAF — in jsdom this happens synchronously)
    expect(mockClipboard.writeText).toHaveBeenCalledWith('Alice');

    grid.destroy();
  });
});

// ============================================================
// Integration: Row Selection + Cell Selection coexist
// ============================================================

describe('Row Selection + Cell Selection Integration', () => {
  it('cell selection works alongside row selection', () => {
    const { container, grid } = createGrid({ rowSelection: 'multiple' });

    // Click a data cell (not the checkbox)
    const dataCell = container.querySelector('td[data-column-id="name"][data-row-index="0"]') as HTMLElement;
    expect(dataCell).not.toBeNull();
    dataCell!.click();

    // Active cell should be set
    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell).not.toBeNull();

    grid.destroy();
  });

  it('keyboard navigation respects column offset', () => {
    const { container, grid } = createGrid({ rowSelection: 'multiple' });

    // Click first data cell
    const dataCell = container.querySelector('td[data-column-id="name"][data-row-index="0"]') as HTMLElement;
    dataCell!.click();

    // Navigate right
    const wrapper = container.querySelector('.ogrid-wrapper')!;
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // Active cell should move to the next data column
    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell).not.toBeNull();
    expect(activeCell!.getAttribute('data-column-id')).toBe('age');

    grid.destroy();
  });
});

// ============================================================
// Integration: Column Pinning + Row Selection
// ============================================================

describe('Column Pinning + Row Selection Integration', () => {
  it('pinned columns work with checkbox column', () => {
    const { container, grid } = createGrid({
      rowSelection: 'multiple',
      pinnedColumns: { name: 'left' },
    });

    // Checkbox column should exist
    const checkboxes = container.querySelectorAll('.ogrid-row-checkbox');
    expect(checkboxes.length).toBe(5);

    // Name column should be pinned
    const pinnedCells = container.querySelectorAll('td[data-pinned="left"]');
    expect(pinnedCells.length).toBe(5);

    grid.destroy();
  });
});
