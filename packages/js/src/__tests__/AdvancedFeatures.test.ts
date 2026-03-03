/**
 * Tests for: fill-down (Ctrl+D), onKeyDown intercept, aria-expanded on filter
 * buttons, aria-sort on column headers, error handling, and onFetchError callback.
 */
import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';
import type { IDataSource, IFetchParams, IPageResult } from '@alaarab/ogrid-core';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

interface TestRow {
  id: number;
  name: string;
  age: number;
  department: string;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', editable: true },
];

const filterableColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, department: 'Engineering' },
  { id: 2, name: 'Bob', age: 25, department: 'Marketing' },
  { id: 3, name: 'Charlie', age: 35, department: 'Sales' },
  { id: 4, name: 'Dave', age: 28, department: 'Engineering' },
  { id: 5, name: 'Eve', age: 32, department: 'Marketing' },
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

function getCellElement(container: HTMLElement, rowIndex: number, colIndex: number): HTMLElement | null {
  return container.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);
}

function getWrapperElement(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.ogrid-wrapper');
}

// Mock clipboard
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue(''),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

afterEach(() => {
  document.body.innerHTML = '';
  mockClipboard.writeText.mockClear();
  mockClipboard.readText.mockClear();
});

// ===========================================================================
// 1. Fill-down (Ctrl+D)
// ===========================================================================

describe('Fill-down (Ctrl+D)', () => {
  it('fills down the selected range on Ctrl+D', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    // Select cell (0, 0)  -  "Alice"
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    // Extend selection down to row 2 with Shift+ArrowDown twice
    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));

    // Trigger fill-down
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));

    // Rows 1 and 2 in the name column should be filled with "Alice"
    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: 'name', newValue: 'Alice' })
    );

    grid.destroy();
  });

  it('does nothing on Ctrl+D when editable is false', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ editable: false, onCellValueChanged });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));

    expect(onCellValueChanged).not.toHaveBeenCalled();

    grid.destroy();
  });

  it('does nothing on Ctrl+D with no active selection', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    // No cell selected  -  dispatch Ctrl+D directly on wrapper
    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));

    expect(onCellValueChanged).not.toHaveBeenCalled();

    grid.destroy();
  });

  it('fills only the single active cell when selection is 1x1', () => {
    const onCellValueChanged = jest.fn();
    const { container, grid } = createGrid({ onCellValueChanged });

    // Select a single cell  -  row 0, col 0
    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    // Ctrl+D with a 1-row selection is a no-op (no rows below to fill)
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));

    // A 1-row selection has nothing to fill down into
    expect(onCellValueChanged).not.toHaveBeenCalled();

    grid.destroy();
  });
});

// ===========================================================================
// 2. onKeyDown intercept
// ===========================================================================

describe('onKeyDown intercept', () => {
  it('passes keyboard events to onKeyDown callback', () => {
    const onKeyDown = jest.fn();
    const { container, grid } = createGrid({ onKeyDown });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    wrapper!.dispatchEvent(event);

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledWith(expect.any(KeyboardEvent));

    grid.destroy();
  });

  it('receives the correct key in the event', () => {
    const receivedKeys: string[] = [];
    const onKeyDown = (e: KeyboardEvent) => { receivedKeys.push(e.key); };
    const { container, grid } = createGrid({ onKeyDown });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(receivedKeys).toEqual(['ArrowRight', 'Tab']);

    grid.destroy();
  });

  it('suppresses grid default handling when preventDefault() is called', () => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') e.preventDefault();
    };
    const { container, grid } = createGrid({ onKeyDown });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    // cancelable: true is required for preventDefault() to take effect
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

    // Active cell should NOT have moved because preventDefault() suppressed grid handling
    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('0');

    grid.destroy();
  });

  it('allows grid default handling when preventDefault() is NOT called', () => {
    const onKeyDown = jest.fn(); // does not call preventDefault
    const { container, grid } = createGrid({ onKeyDown });

    const cell = getCellElement(container, 0, 0);
    cell!.click();

    const wrapper = getWrapperElement(container);
    wrapper!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));

    // Active cell should have moved to row 1
    const activeCell = container.querySelector('td[data-active-cell="true"]');
    expect(activeCell?.getAttribute('data-row-index')).toBe('1');

    grid.destroy();
  });
});

// ===========================================================================
// 3. aria-expanded on filter buttons
// ===========================================================================

describe('aria-expanded on filter buttons', () => {
  function createFilterGrid(options?: Partial<OGridOptions<TestRow>>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: filterableColumns,
      data: testData,
      getRowId: (item: TestRow) => item.id,
      pageSize: 20,
      cellSelection: false,
      ...options,
    });
    return { container, grid };
  }

  it('filter button has aria-expanded="false" initially', () => {
    const { container, grid } = createFilterGrid();

    const filterBtn = container.querySelector('.ogrid-filter-icon[aria-haspopup]');
    expect(filterBtn).not.toBeNull();
    expect(filterBtn!.getAttribute('aria-expanded')).toBe('false');

    grid.destroy();
  });

  it('all filterable columns have filter buttons with aria-expanded="false" initially', () => {
    const { container, grid } = createFilterGrid();

    const filterBtns = container.querySelectorAll('.ogrid-filter-icon[aria-haspopup]');
    // Two filterable columns: name (text) and department (multiSelect)
    expect(filterBtns.length).toBe(2);

    filterBtns.forEach((btn) => {
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    grid.destroy();
  });

  it('filter button aria-expanded becomes "true" after clicking to open filter', () => {
    const { container, grid } = createFilterGrid();

    const nameHeader = container.querySelector('th[data-column-id="name"]');
    const filterBtn = nameHeader!.querySelector('.ogrid-filter-icon[aria-haspopup]') as HTMLElement;
    expect(filterBtn).not.toBeNull();

    filterBtn.click();

    expect(filterBtn.getAttribute('aria-expanded')).toBe('true');

    grid.destroy();
  });

  it('other filter buttons remain aria-expanded="false" when one is opened', () => {
    const { container, grid } = createFilterGrid();

    const nameHeader = container.querySelector('th[data-column-id="name"]');
    const nameFilterBtn = nameHeader!.querySelector('.ogrid-filter-icon[aria-haspopup]') as HTMLElement;
    nameFilterBtn.click();

    const deptHeader = container.querySelector('th[data-column-id="department"]');
    const deptFilterBtn = deptHeader!.querySelector('.ogrid-filter-icon[aria-haspopup]') as HTMLElement;

    expect(deptFilterBtn.getAttribute('aria-expanded')).toBe('false');

    grid.destroy();
  });

  it('aria-expanded returns to "false" after closing filter', () => {
    const { container, grid } = createFilterGrid();

    const nameHeader = container.querySelector('th[data-column-id="name"]');
    const filterBtn = nameHeader!.querySelector('.ogrid-filter-icon[aria-haspopup]') as HTMLElement;

    // Open
    filterBtn.click();
    expect(filterBtn.getAttribute('aria-expanded')).toBe('true');

    // Close by clicking the same button again
    filterBtn.click();
    expect(filterBtn.getAttribute('aria-expanded')).toBe('false');

    grid.destroy();
  });
});

// ===========================================================================
// 4. aria-sort on column headers
// ===========================================================================

describe('aria-sort on column headers', () => {
  it('unsorted columns do not have aria-sort set initially', () => {
    const { container, grid } = createGrid();

    const nameHeader = container.querySelector('th[data-column-id="name"]');
    expect(nameHeader).not.toBeNull();
    // Before any sort, sortable headers have no aria-sort (or it is not set)
    const ariaSort = nameHeader!.getAttribute('aria-sort');
    expect(ariaSort).toBeNull();

    grid.destroy();
  });

  it('sorted column gets aria-sort="ascending" on first click', () => {
    const { container, grid } = createGrid();

    const nameHeader = container.querySelector('th[data-column-id="name"]') as HTMLElement;
    nameHeader.click();

    // Re-query after click  -  header DOM is rebuilt on sort change
    const updatedHeader = container.querySelector('th[data-column-id="name"]');
    expect(updatedHeader!.getAttribute('aria-sort')).toBe('ascending');

    grid.destroy();
  });

  it('sorted column gets aria-sort="descending" on second click', () => {
    const { container, grid } = createGrid();

    // First click  -  ascending
    container.querySelector<HTMLElement>('th[data-column-id="name"]')!.click();
    // Second click on new DOM element  -  descending
    container.querySelector<HTMLElement>('th[data-column-id="name"]')!.click();

    const updatedHeader = container.querySelector('th[data-column-id="name"]');
    expect(updatedHeader!.getAttribute('aria-sort')).toBe('descending');

    grid.destroy();
  });

  it('only the sorted column has aria-sort set', () => {
    const { container, grid } = createGrid();

    container.querySelector<HTMLElement>('th[data-column-id="name"]')!.click();

    // Re-query after re-render
    const ageHeader = container.querySelector('th[data-column-id="age"]');
    expect(ageHeader!.getAttribute('aria-sort')).toBeNull();

    grid.destroy();
  });

  it('aria-sort updates when a different column is sorted', () => {
    const { container, grid } = createGrid();

    container.querySelector<HTMLElement>('th[data-column-id="name"]')!.click();
    // Re-query after first sort
    expect(container.querySelector('th[data-column-id="name"]')!.getAttribute('aria-sort')).toBe('ascending');

    container.querySelector<HTMLElement>('th[data-column-id="age"]')!.click();

    // Re-query both after second sort
    expect(container.querySelector('th[data-column-id="age"]')!.getAttribute('aria-sort')).toBe('ascending');
    expect(container.querySelector('th[data-column-id="name"]')!.getAttribute('aria-sort')).toBeNull();

    grid.destroy();
  });
});

// ===========================================================================
// 5. Error handling  -  bad data does not crash
// ===========================================================================

describe('Error handling  -  bad data resilience', () => {
  it('renders without crashing when a cell value is null', () => {
    const columns: IColumnDef<{ id: number; name: string | null }>[] = [
      { columnId: 'name', name: 'Name' },
    ];
    const data = [
      { id: 1, name: null as unknown as string },
      { id: 2, name: 'Bob' },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);

    expect(() => {
      const grid = new OGrid(container, {
        columns,
        data,
        getRowId: (item) => item.id,
        pageSize: 20,
      });
      grid.destroy();
    }).not.toThrow();
  });

  it('renders without crashing when a cell value is undefined', () => {
    const columns: IColumnDef<{ id: number; name: string | undefined }>[] = [
      { columnId: 'name', name: 'Name' },
    ];
    const data = [
      { id: 1, name: undefined as unknown as string },
      { id: 2, name: 'Bob' },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);

    expect(() => {
      const grid = new OGrid(container, {
        columns,
        data,
        getRowId: (item) => item.id,
        pageSize: 20,
      });
      grid.destroy();
    }).not.toThrow();
  });

  it('renders without crashing when numeric column has non-numeric value', () => {
    const columns: IColumnDef<{ id: number; age: number | string }>[] = [
      { columnId: 'age', name: 'Age', type: 'numeric' },
    ];
    const data = [
      { id: 1, age: 'not-a-number' as unknown as number },
      { id: 2, age: 42 },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);

    expect(() => {
      const grid = new OGrid(container, {
        columns,
        data,
        getRowId: (item) => item.id,
        pageSize: 20,
      });
      grid.destroy();
    }).not.toThrow();
  });

  it('renders without crashing when data is an empty array', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    expect(() => {
      const grid = new OGrid<TestRow>(container, {
        columns: testColumns,
        data: [],
        getRowId: (item) => item.id,
        pageSize: 20,
      });
      grid.destroy();
    }).not.toThrow();
  });

  it('handles rows with missing fields gracefully', () => {
    const columns: IColumnDef<{ id: number; name: string; extra?: string }>[] = [
      { columnId: 'name', name: 'Name' },
      { columnId: 'extra', name: 'Extra' },
    ];
    const data = [
      { id: 1, name: 'Alice' }, // missing 'extra'
      { id: 2, name: 'Bob', extra: 'present' },
    ] as Array<{ id: number; name: string; extra?: string }>;

    const container = document.createElement('div');
    document.body.appendChild(container);

    expect(() => {
      const grid = new OGrid(container, {
        columns,
        data,
        getRowId: (item) => item.id,
        pageSize: 20,
      });
      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
      grid.destroy();
    }).not.toThrow();
  });
});

// ===========================================================================
// 6. onFetchError callback  -  mock dataSource that throws
// ===========================================================================

describe('onFetchError / onError callback with failing dataSource', () => {
  function createErrorDataSource(): IDataSource<TestRow> {
    return {
      fetchPage: jest.fn().mockRejectedValue(new Error('Network error')),
    };
  }

  function createSlowDataSource(delay = 50): IDataSource<TestRow> & { fetchMock: jest.Mock } {
    const fetchMock = jest.fn((_params: IFetchParams) =>
      new Promise<IPageResult<TestRow>>((resolve) => {
        setTimeout(() => resolve({ items: testData, totalCount: testData.length }), delay);
      })
    );
    return { fetchPage: fetchMock, fetchMock };
  }

  it('calls onError when dataSource.fetchPage rejects', async () => {
    const onError = jest.fn();
    const ds = createErrorDataSource();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
      onError,
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    grid.destroy();
  });

  it('does not show loading overlay after fetch error', async () => {
    const ds = createErrorDataSource();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    const overlay = container.querySelector('.ogrid-loading-overlay');
    expect(overlay).toBeNull();

    grid.destroy();
  });

  it('renders empty grid after fetch error (no crash)', async () => {
    const ds = createErrorDataSource();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    // Grid should still render (table element exists)
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    grid.destroy();
  });

  it('shows loading overlay while fetch is in-progress', () => {
    const ds: IDataSource<TestRow> = {
      fetchPage: jest.fn().mockReturnValue(new Promise(() => {})), // never resolves
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    const overlay = container.querySelector('.ogrid-loading-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toBe('Loading...');

    grid.destroy();
  });

  it('onError receives the thrown error object', async () => {
    const thrownError = new Error('Custom fetch failure');
    const onError = jest.fn();
    const ds: IDataSource<TestRow> = {
      fetchPage: jest.fn().mockRejectedValue(thrownError),
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
      onError,
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledWith(thrownError);

    grid.destroy();
  });

  it('does not call onError on successful fetch', async () => {
    const onError = jest.fn();
    const ds = createSlowDataSource(10);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const grid = new OGrid<TestRow>(container, {
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
      onError,
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(onError).not.toHaveBeenCalled();

    grid.destroy();
  });
});
