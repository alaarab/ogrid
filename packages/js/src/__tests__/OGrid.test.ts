import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
  { columnId: 'active', name: 'Active', type: 'boolean' },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, active: true },
  { id: 2, name: 'Bob', age: 25, active: false },
  { id: 3, name: 'Charlie', age: 35, active: true },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    pageSize: 20,
    ...options,
  });
  return { container, grid };
}

function getHeaderLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('th')).map((header) => {
    const label = header.querySelector('[data-header-label] > span');
    return label?.textContent ?? header.textContent ?? '';
  });
}

function getSheetTabLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.ogrid-sheet-tabs [role="tab"]')).map((tab) => tab.textContent ?? '');
}

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `User ${index + 1}`,
    age: 20 + index,
    active: index % 2 === 0,
  }));
}

describe('OGrid', () => {
  describe('basic rendering', () => {
    it('renders a table with headers and rows', () => {
      const { container, grid } = createGrid();

      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      const headers = getHeaderLabels(container);
      expect(headers).toEqual(['Name', 'Age', 'Active']);

      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);

      grid.destroy();
    });

    it('renders cell values correctly', () => {
      const { container, grid } = createGrid();

      const cells = container.querySelectorAll('tbody tr:first-child td');
      expect(cells[0].textContent).toBe('Alice');
      expect(cells[1].textContent).toBe('30');
      const checkbox = cells[2].querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(true);
      expect(checkbox.disabled).toBe(true);

      grid.destroy();
    });

    it('renders numeric columns with right alignment', () => {
      const { container, grid } = createGrid();

      const ageCells = container.querySelectorAll('td[data-column-id="age"]');
      expect((ageCells[0] as HTMLElement).style.textAlign).toBe('right');

      grid.destroy();
    });

    it('toggles editable boolean cells on click and refreshes the DOM', () => {
      const columns: IColumnDef<TestRow>[] = [
        { columnId: 'name', name: 'Name' },
        { columnId: 'active', name: 'Active', type: 'boolean', editable: true, cellEditor: 'checkbox' },
      ];
      const data: TestRow[] = [
        { id: 1, name: 'Alice', age: 30, active: true },
      ];
      const { container, grid } = createGrid({ columns, data });

      const checkbox = container.querySelector('td[data-column-id="active"] input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(true);

      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      const updatedCheckbox = container.querySelector('td[data-column-id="active"] input[type="checkbox"]') as HTMLInputElement;
      expect(updatedCheckbox.checked).toBe(false);
      expect(data[0].active).toBe(false);

      grid.destroy();
    });

    it('renders empty state when no data', () => {
      const { container, grid } = createGrid({ data: [] });

      const emptyCell = container.querySelector('.ogrid-empty-state');
      expect(emptyCell).not.toBeNull();
      expect(emptyCell!.textContent).toBe('No data');

      grid.destroy();
    });
  });

  describe('sorting', () => {
    it('sorts by clicking a sortable header', () => {
      const { container, grid } = createGrid();

      const nameHeader = container.querySelector('th');
      nameHeader!.click();

      const firstCell = container.querySelector('tbody tr:first-child td');
      expect(firstCell!.textContent).toBe('Alice');

      grid.destroy();
    });

    it('toggles sort direction on repeated clicks', () => {
      const { container, grid } = createGrid();

      const nameHeader = container.querySelector('th');

      // First click: asc
      nameHeader!.click();
      let firstCell = container.querySelector('tbody tr:first-child td');
      expect(firstCell!.textContent).toBe('Alice');

      // Second click: desc
      nameHeader!.click();
      firstCell = container.querySelector('tbody tr:first-child td');
      expect(firstCell!.textContent).toBe('Charlie');

      grid.destroy();
    });
  });

  describe('column visibility', () => {
    it('only renders visible columns', () => {
      const { container, grid } = createGrid({
        visibleColumns: new Set(['name', 'age']),
      });

      const headers = getHeaderLabels(container);
      expect(headers).toEqual(['Name', 'Age']);

      grid.destroy();
    });

    it('respects the initial columnOrder option', () => {
      const { container, grid } = createGrid({
        columnOrder: ['active', 'name', 'age'],
      });

      const headers = getHeaderLabels(container);
      expect(headers).toEqual(['Active', 'Name', 'Age']);

      grid.destroy();
    });
  });

  describe('custom rendering', () => {
    it('supports renderCell for custom DOM rendering', () => {
      const columns: IColumnDef<TestRow>[] = [
        {
          columnId: 'name',
          name: 'Name',
          renderCell: (cell, item) => {
            const strong = document.createElement('strong');
            strong.textContent = item.name;
            cell.appendChild(strong);
          },
        },
      ];

      const container = document.createElement('div');
      const grid = new OGrid<TestRow>(container, {
        columns,
        data: testData,
        getRowId: (item: TestRow) => item.id,
        pageSize: 20,
      });

      const firstCell = container.querySelector('tbody tr:first-child td');
      const strong = firstCell!.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toBe('Alice');

      grid.destroy();
    });

    it('supports valueFormatter', () => {
      const columns: IColumnDef<TestRow>[] = [
        {
          columnId: 'age',
          name: 'Age',
          valueFormatter: (value) => `${value} years`,
        },
      ];

      const container = document.createElement('div');
      const grid = new OGrid<TestRow>(container, {
        columns,
        data: testData,
        getRowId: (item: TestRow) => item.id,
        pageSize: 20,
      });

      const firstCell = container.querySelector('tbody tr:first-child td');
      expect(firstCell!.textContent).toBe('30 years');

      grid.destroy();
    });

    it('supports cellStyle as object', () => {
      const columns: IColumnDef<TestRow>[] = [
        {
          columnId: 'name',
          name: 'Name',
          cellStyle: { color: 'red' } as unknown as Partial<CSSStyleDeclaration>,
        },
      ];

      const container = document.createElement('div');
      const grid = new OGrid<TestRow>(container, {
        columns,
        data: testData,
        getRowId: (item: TestRow) => item.id,
        pageSize: 20,
      });

      const firstCell = container.querySelector('tbody tr:first-child td') as HTMLElement;
      expect(firstCell.style.color).toBe('red');

      grid.destroy();
    });
  });

  describe('API', () => {
    it('exposes api object', () => {
      const { grid } = createGrid();

      expect(grid.api).toBeDefined();
      expect(typeof grid.api.setRowData).toBe('function');
      expect(typeof grid.api.clearFilters).toBe('function');
      expect(typeof grid.api.getColumnState).toBe('function');
      expect(typeof grid.api.getDisplayedRows).toBe('function');

      grid.destroy();
    });

    it('api.setRowData updates the grid', () => {
      const { container, grid } = createGrid();

      grid.api.setRowData([
        { id: 4, name: 'Diana', age: 28, active: true },
      ]);

      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(1);

      const firstCell = container.querySelector('tbody tr:first-child td');
      expect(firstCell!.textContent).toBe('Diana');

      grid.destroy();
    });

    it('api.getDisplayedRows returns current items', () => {
      const { grid } = createGrid();

      const rows = grid.api.getDisplayedRows();
      expect(rows.length).toBe(3);
      expect(rows[0].name).toBe('Alice');

      grid.destroy();
    });

    it('fires page and page-size callbacks and events', () => {
      const onPageChange = jest.fn();
      const onPageSizeChange = jest.fn();
      const pageEvents: Array<{ page: number }> = [];
      const pageSizeEvents: Array<{ page: number; pageSize: number }> = [];
      const { container, grid } = createGrid({
        data: makeRows(30),
        pageSize: 10,
        onPageChange,
        onPageSizeChange,
      });

      grid.on('pageChange', (event) => pageEvents.push(event));
      grid.on('pageSizeChange', (event) => pageSizeEvents.push(event));

      const nextButton = Array.from(container.querySelectorAll('.ogrid-pagination-btn'))
        .find((btn) => btn.textContent === '\u25B6') as HTMLButtonElement;
      nextButton.click();

      const pageSizeSelect = container.querySelector('.ogrid-page-size-select') as HTMLSelectElement;
      const nextPageSize = Array.from(pageSizeSelect.options)
        .map((option) => Number(option.value))
        .find((size) => size !== 10);
      expect(nextPageSize).toBeDefined();
      pageSizeSelect.value = String(nextPageSize);
      pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onPageChange).toHaveBeenNthCalledWith(1, 2);
      expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
      expect(onPageSizeChange).toHaveBeenCalledWith(nextPageSize);
      expect(pageEvents).toEqual([{ page: 2 }, { page: 1 }]);
      expect(pageSizeEvents).toEqual([{ page: 1, pageSize: nextPageSize! }]);

      grid.destroy();
    });

    it('fires row selection callback and event', () => {
      const onSelectionChange = jest.fn();
      const selectionEvents: Array<{ selectedRowIds: Array<number | string> }> = [];
      const { grid } = createGrid({
        rowSelection: 'multiple',
        onSelectionChange,
      });

      grid.on('selectionChange', (event) => {
        selectionEvents.push({ selectedRowIds: event.selectedRowIds });
      });

      grid.api.setSelectedRows([1, 3]);

      expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({
        selectedRowIds: [1, 3],
      }));
      expect(selectionEvents).toEqual([{ selectedRowIds: [1, 3] }]);

      grid.destroy();
    });

    it('renders sheet tabs and falls back to the first sheet when no active sheet is provided', () => {
      const { container, grid } = createGrid({
        sheetDefs: [
          { id: 'sheet-1', name: 'Sheet 1' },
          { id: 'sheet-2', name: 'Sheet 2' },
        ],
      });

      const tabList = container.querySelector('[role="tablist"][aria-label="Sheet tabs"]');
      expect(tabList).not.toBeNull();
      expect(getSheetTabLabels(container)).toEqual(['Sheet 1', 'Sheet 2']);
      expect(grid.api.getActiveSheet()).toBe('sheet-1');

      const selectedTabs = Array.from(container.querySelectorAll('.ogrid-sheet-tabs [role="tab"]'))
        .filter((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(selectedTabs).toHaveLength(1);
      expect(selectedTabs[0]?.textContent).toBe('Sheet 1');

      grid.destroy();
    });

    it('updates the active sheet, callback, and event stream when switching sheet tabs', () => {
      const onSheetChange = jest.fn();
      const sheetEvents: Array<{ sheetId: string }> = [];
      const { container, grid } = createGrid({
        sheetDefs: [
          { id: 'sheet-1', name: 'Sheet 1' },
          { id: 'sheet-2', name: 'Sheet 2', color: '#ff6600' },
        ],
        activeSheet: 'sheet-1',
        onSheetChange,
      });

      grid.on('sheetChange', (event) => sheetEvents.push(event));

      const secondTab = Array.from(container.querySelectorAll('.ogrid-sheet-tabs [role="tab"]'))
        .find((tab) => tab.textContent === 'Sheet 2') as HTMLButtonElement;
      secondTab.click();

      expect(onSheetChange).toHaveBeenCalledWith('sheet-2');
      expect(sheetEvents).toEqual([{ sheetId: 'sheet-2' }]);
      expect(grid.api.getActiveSheet()).toBe('sheet-2');

      const updatedSecondTab = Array.from(container.querySelectorAll('.ogrid-sheet-tabs [role="tab"]'))
        .find((tab) => tab.textContent === 'Sheet 2') as HTMLButtonElement;
      expect(updatedSecondTab.getAttribute('aria-selected')).toBe('true');
      expect(updatedSecondTab.style.borderBottomColor).toBe('rgb(255, 102, 0)');

      grid.destroy();
    });

    it('supports add-sheet callbacks and imperative sheet tab updates', () => {
      const sheetDefs = [{ id: 'sheet-1', name: 'Sheet 1' }];
      const onSheetAdd = jest.fn(() => {
        sheetDefs.push({ id: 'sheet-2', name: 'Sheet 2' });
      });
      const sheetAddEvents: Array<Record<string, never>> = [];
      const { container, grid } = createGrid({
        sheetDefs,
        activeSheet: 'sheet-1',
        onSheetAdd,
      });

      grid.on('sheetAdd', (event) => sheetAddEvents.push(event));

      const addButton = container.querySelector('.ogrid-sheet-tabs__add-btn') as HTMLButtonElement;
      expect(addButton).not.toBeNull();
      addButton.click();

      expect(onSheetAdd).toHaveBeenCalledTimes(1);
      expect(sheetAddEvents).toEqual([{}]);
      expect(getSheetTabLabels(container)).toEqual(['Sheet 1', 'Sheet 2']);

      grid.api.setSheetDefs([
        { id: 'summary', name: 'Summary' },
        { id: 'details', name: 'Details' },
      ], { activeSheet: 'details' });

      expect(grid.api.getSheetDefs()).toEqual([
        { id: 'summary', name: 'Summary' },
        { id: 'details', name: 'Details' },
      ]);
      expect(grid.api.getActiveSheet()).toBe('details');
      expect(getSheetTabLabels(container)).toEqual(['Summary', 'Details']);

      grid.destroy();
    });

    it('fires column order callback and event', () => {
      const onColumnOrderChange = jest.fn();
      const orderEvents: Array<{ order: string[] }> = [];
      const { grid } = createGrid({ onColumnOrderChange });

      grid.on('columnOrderChange', (event) => orderEvents.push(event));
      grid.api.setColumnOrder(['age', 'name', 'active']);

      expect(onColumnOrderChange).toHaveBeenCalledWith(['age', 'name', 'active']);
      expect(orderEvents).toEqual([{ order: ['age', 'name', 'active'] }]);

      grid.destroy();
    });

    it('fires column resize callback and event', () => {
      const onColumnResized = jest.fn();
      const resizeEvents: Array<{ columnId: string; width: number }> = [];
      const { grid } = createGrid({ onColumnResized });
      const resizeState = (grid as unknown as {
        resizeState: { setColumnWidth: (columnId: string, widthPx: number) => void };
      }).resizeState;

      grid.on('columnResized', (event) => resizeEvents.push(event));
      resizeState.setColumnWidth('name', 240);

      expect(onColumnResized).toHaveBeenCalledWith('name', 240);
      expect(resizeEvents).toEqual([{ columnId: 'name', width: 240 }]);

      grid.destroy();
    });

    it('opens the per-column header menu without triggering sort and reuses resize events for autosize', () => {
      const onColumnResized = jest.fn();
      const sortEvents: Array<{ sort: { field: string; direction: 'asc' | 'desc' } | undefined }> = [];
      const { container, grid } = createGrid({ onColumnResized });

      grid.on('sortChange', (event) => sortEvents.push(event));

      const trigger = container.querySelector('th[data-column-id="name"] .ogrid-column-menu-trigger') as HTMLButtonElement;
      expect(trigger).not.toBeNull();

      trigger.click();

      expect(sortEvents).toEqual([]);

      const menu = document.querySelector('[role="menu"][aria-label="Column options"]');
      expect(menu).not.toBeNull();
      expect(menu?.textContent).toContain('Pin left');
      expect(menu?.textContent).toContain('Sort ascending');
      expect(menu?.textContent).toContain('Autosize this column');
      expect(menu?.textContent).toContain('Autosize all columns');

      const autosizeButton = Array.from(menu?.querySelectorAll('button') ?? []).find((button) => button.textContent === 'Autosize this column') as HTMLButtonElement;
      expect(autosizeButton).not.toBeUndefined();

      autosizeButton.click();

      expect(onColumnResized).toHaveBeenCalledTimes(1);
      const [columnId, width] = onColumnResized.mock.calls[0] as [string, number];
      expect(columnId).toBe('name');
      expect(width).toBeGreaterThan(0);

      const header = container.querySelector('th[data-column-id="name"]') as HTMLElement;
      expect(header.style.width).toBe(`${width}px`);

      grid.destroy();
    });

    it('pins the header when the per-column menu pins a column left', () => {
      const onColumnPinned = jest.fn();
      const { container, grid } = createGrid({ onColumnPinned });

      const trigger = container.querySelector('th[data-column-id="name"] .ogrid-column-menu-trigger') as HTMLButtonElement;
      trigger.click();

      const menu = document.querySelector('[role="menu"][aria-label="Column options"]') as HTMLElement;
      const pinLeftButton = Array.from(menu.querySelectorAll('button')).find((button) => button.textContent === 'Pin left') as HTMLButtonElement;
      pinLeftButton.click();

      const header = container.querySelector('th[data-column-id="name"]') as HTMLElement;
      expect(header.getAttribute('data-pinned')).toBe('left');
      expect(header.style.left).toBe('0px');
      expect(onColumnPinned).toHaveBeenCalledWith('name', 'left');

      grid.destroy();
    });

    it('fires column pin callback and event for pin and unpin', () => {
      const onColumnPinned = jest.fn();
      const pinEvents: Array<{ columnId: string; pin: 'left' | 'right' | null }> = [];
      const { grid } = createGrid({ onColumnPinned });
      const pinningState = (grid as unknown as {
        pinningState: {
          pinColumn: (columnId: string, side: 'left' | 'right') => void;
          unpinColumn: (columnId: string) => void;
        };
      }).pinningState;

      grid.on('columnPinned', (event) => pinEvents.push(event));
      pinningState.pinColumn('name', 'left');
      pinningState.unpinColumn('name');

      expect(onColumnPinned).toHaveBeenNthCalledWith(1, 'name', 'left');
      expect(onColumnPinned).toHaveBeenNthCalledWith(2, 'name', null);
      expect(pinEvents).toEqual([
        { columnId: 'name', pin: 'left' },
        { columnId: 'name', pin: null },
      ]);

      grid.destroy();
    });

    it('fires sort events through the public event API', () => {
      const sortEvents: Array<{ sort: { field: string; direction: 'asc' | 'desc' } | undefined }> = [];
      const { container, grid } = createGrid();

      grid.on('sortChange', (event) => sortEvents.push(event));
      const nameHeader = container.querySelector('th') as HTMLElement;
      nameHeader.click();
      nameHeader.click();

      expect(sortEvents).toEqual([
        { sort: { field: 'name', direction: 'asc' } },
        { sort: { field: 'name', direction: 'desc' } },
      ]);

      grid.destroy();
    });

    it('fires cell value changed through the public event API', () => {
      const cellValueChangedEvents: Array<{ columnId: string; newValue: unknown }> = [];
      const columns: IColumnDef<TestRow>[] = [
        { columnId: 'name', name: 'Name' },
        { columnId: 'active', name: 'Active', type: 'boolean', editable: true, cellEditor: 'checkbox' },
      ];
      const data: TestRow[] = [
        { id: 1, name: 'Alice', age: 30, active: true },
      ];
      const { container, grid } = createGrid({ columns, data });

      grid.on('cellValueChanged', (event) => {
        cellValueChangedEvents.push({ columnId: event.columnId, newValue: event.newValue });
      });

      const checkbox = container.querySelector('td[data-column-id="active"] input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      expect(cellValueChangedEvents).toEqual([{ columnId: 'active', newValue: false }]);

      grid.destroy();
    });

    it('returns the full column-state contract from the public API', () => {
      const { grid } = createGrid();
      const pinningState = (grid as unknown as {
        pinningState: { pinColumn: (columnId: string, side: 'left' | 'right') => void };
      }).pinningState;

      grid.api.applyColumnState({
        visibleColumns: ['active', 'name'],
        columnOrder: ['active', 'name', 'age'],
        columnWidths: { active: 220 },
      });
      pinningState.pinColumn('active', 'left');

      const state = grid.api.getColumnState();
      expect(state.visibleColumns).toEqual(['active', 'name']);
      expect(state.columnOrder).toEqual(['active', 'name', 'age']);
      expect(state.columnWidths).toEqual({ active: 220 });
      expect(state.pinnedColumns).toEqual({ active: 'left' });

      grid.destroy();
    });

    it('applies persisted column state to the rendered grid, not just the state object', () => {
      const { container, grid } = createGrid();

      grid.api.applyColumnState({
        visibleColumns: ['active', 'name'],
        columnOrder: ['active', 'name', 'age'],
        columnWidths: { active: 220 },
        sort: { field: 'age', direction: 'desc' },
        filters: {
          name: { type: 'text', value: 'a' },
        },
        pinnedColumns: { active: 'left' },
      });

      const headers = getHeaderLabels(container);
      expect(headers).toEqual(['Active', 'Name']);

      const activeHeader = container.querySelector('th[data-column-id="active"]') as HTMLElement;
      expect(activeHeader.style.width).toBe('220px');

      const displayedRows = grid.api.getDisplayedRows();
      expect(displayedRows.map((row) => row.name)).toEqual(['Charlie', 'Alice']);

      const state = grid.api.getColumnState();
      expect(state.columnOrder).toEqual(['active', 'name', 'age']);
      expect(state.columnWidths).toEqual({ active: 220 });
      expect(state.pinnedColumns).toEqual({ active: 'left' });

      grid.destroy();
    });

    it('clears persisted sort and filters when applyColumnState receives undefined values', () => {
      const { grid } = createGrid({
        sort: { field: 'age', direction: 'desc' },
        filters: {
          name: { type: 'text', value: 'a' },
        },
      });

      grid.api.applyColumnState({
        sort: undefined,
        filters: undefined,
      });

      const state = grid.api.getColumnState();
      expect(state.sort).toBeUndefined();
      expect(state.filters).toBeUndefined();

      grid.destroy();
    });
  });

  describe('accessibility props', () => {
    it('accepts the shared aria-label prop name', () => {
      const { container, grid } = createGrid({ 'aria-label': 'Projects grid' });

      const wrapper = container.querySelector('.ogrid-wrapper');
      expect(wrapper?.getAttribute('aria-label')).toBe('Projects grid');

      grid.destroy();
    });

    it('accepts aria-labelledby without forcing a fallback aria-label', () => {
      const label = document.createElement('h2');
      label.id = 'grid-label';
      document.body.appendChild(label);

      const { container, grid } = createGrid({ 'aria-labelledby': 'grid-label' });

      const wrapper = container.querySelector('.ogrid-wrapper');
      expect(wrapper?.getAttribute('aria-labelledby')).toBe('grid-label');
      expect(wrapper?.getAttribute('aria-label')).toBeNull();

      grid.destroy();
      label.remove();
    });
  });

  describe('destroy', () => {
    it('clears the container on destroy', () => {
      const { container, grid } = createGrid();

      expect(container.innerHTML).not.toBe('');
      grid.destroy();
      expect(container.innerHTML).toBe('');
    });
  });
});
