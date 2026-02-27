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

describe('OGrid', () => {
  describe('basic rendering', () => {
    it('renders a table with headers and rows', () => {
      const { container, grid } = createGrid();

      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Age');
      expect(headers[2].textContent).toBe('Active');

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

      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(2);
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Age');

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
