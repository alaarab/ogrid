import { OGrid } from '../OGrid';
import type { IColumnDef } from '../types/columnTypes';

interface TestRow {
  id: number;
  name: string;
  age: number;
  department: string;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
  { columnId: 'department', name: 'Department' },
];

function generateData(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + (i % 50),
    department: ['Engineering', 'Marketing', 'Sales'][i % 3],
  }));
}

function createGrid(options?: Partial<any>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: generateData(50),
    getRowId: (item: TestRow) => item.id,
    pageSize: 10,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Pagination', () => {
  it('renders pagination controls', () => {
    const { container, grid } = createGrid();

    const pagination = container.querySelector('.ogrid-pagination');
    expect(pagination).not.toBeNull();

    grid.destroy();
  });

  it('shows correct page info', () => {
    const { container, grid } = createGrid();

    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('1-10 of 50');

    grid.destroy();
  });

  it('shows only pageSize rows', () => {
    const { container, grid } = createGrid();

    const rows = container.querySelectorAll('.ogrid-row');
    expect(rows.length).toBe(10);

    grid.destroy();
  });

  it('navigates to next page', () => {
    const { container, grid } = createGrid();

    const nextBtn = container.querySelectorAll('.ogrid-pagination-btn');
    // Last button is next
    const next = nextBtn[nextBtn.length - 1] as HTMLButtonElement;
    next.click();

    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('11-20 of 50');

    const firstCell = container.querySelector('.ogrid-row td');
    expect(firstCell!.textContent).toBe('Person 11');

    grid.destroy();
  });

  it('disables prev on first page', () => {
    const { container, grid } = createGrid();

    const prevBtn = container.querySelector('.ogrid-pagination-btn') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    grid.destroy();
  });

  it('changes page size', () => {
    const { container, grid } = createGrid();

    const select = container.querySelector('.ogrid-page-size-select') as HTMLSelectElement;

    // Check initial state
    let rows = container.querySelectorAll('.ogrid-row');
    expect(rows.length).toBe(10); // Should start with 10

    select.value = '25';
    select.dispatchEvent(new Event('change'));

    rows = container.querySelectorAll('.ogrid-row');
    expect(rows.length).toBe(25);

    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('1-25 of 50');

    grid.destroy();
  });
});

describe('Column Chooser', () => {
  it('renders column chooser button', () => {
    const { container, grid } = createGrid();

    const btn = container.querySelector('.ogrid-column-chooser-btn');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe('Columns');

    grid.destroy();
  });

  it('opens dropdown on click', () => {
    const { container, grid } = createGrid();

    const btn = container.querySelector('.ogrid-column-chooser-btn') as HTMLElement;
    btn.click();

    const dropdown = container.querySelector('.ogrid-column-chooser-dropdown');
    expect(dropdown).not.toBeNull();

    const items = dropdown!.querySelectorAll('.ogrid-column-chooser-item');
    expect(items.length).toBe(3);

    grid.destroy();
  });

  it('toggles column visibility', () => {
    const { container, grid } = createGrid();

    // Open chooser
    const btn = container.querySelector('.ogrid-column-chooser-btn') as HTMLElement;
    btn.click();

    // Uncheck department
    const checkboxes = container.querySelectorAll('.ogrid-column-chooser-item input') as NodeListOf<HTMLInputElement>;
    const deptCheckbox = checkboxes[2]; // department is 3rd
    expect(deptCheckbox.checked).toBe(true);
    deptCheckbox.checked = false;
    deptCheckbox.dispatchEvent(new Event('change'));

    // Should now only show 2 columns
    const headers = container.querySelectorAll('.ogrid-header-cell');
    expect(headers.length).toBe(2);

    grid.destroy();
  });
});

describe('Status Bar', () => {
  it('renders status bar with row count', () => {
    const { container, grid } = createGrid();

    const statusBar = container.querySelector('.ogrid-status-bar');
    expect(statusBar).not.toBeNull();

    grid.destroy();
  });
});

describe('CSV Export', () => {
  it('api.exportToCsv triggers a download', () => {
    const { grid } = createGrid({ data: generateData(3), pageSize: 10 });

    // Mock URL.createObjectURL and link click
    const createObjectURL = jest.fn(() => 'blob:test');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = jest.fn();
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = origCreate('a');
        a.setAttribute = jest.fn();
        a.click = clickSpy;
        a.style = {} as any;
        return a;
      }
      return origCreate(tag);
    });

    grid.api.exportToCsv('test.csv');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    jest.restoreAllMocks();
    grid.destroy();
  });

  it('csv includes visible column headers', () => {
    const { grid } = createGrid({ data: generateData(2), pageSize: 10 });

    // Capture the blob content
    let blobContent = '';
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
    const OrigBlob = global.Blob;
    global.Blob = class MockBlob {
      constructor(parts: BlobPart[]) { blobContent = parts.join(''); }
      get size() { return blobContent.length; }
      get type() { return 'text/csv'; }
    } as any;

    const clickSpy = jest.fn();
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = origCreate('a');
        a.click = clickSpy;
        return a;
      }
      return origCreate(tag);
    });

    grid.api.exportToCsv();

    expect(blobContent).toContain('Name,Age,Department');
    expect(blobContent).toContain('Person 1');

    global.Blob = OrigBlob;
    jest.restoreAllMocks();
    grid.destroy();
  });

  it('csv respects column visibility', () => {
    const { grid } = createGrid({ data: generateData(2), pageSize: 10, visibleColumns: new Set(['name', 'age']) });

    let blobContent = '';
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
    const OrigBlob = global.Blob;
    global.Blob = class MockBlob {
      constructor(parts: BlobPart[]) { blobContent = parts.join(''); }
      get size() { return blobContent.length; }
      get type() { return 'text/csv'; }
    } as any;

    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = origCreate('a');
        a.click = jest.fn();
        return a;
      }
      return origCreate(tag);
    });

    grid.api.exportToCsv();

    expect(blobContent).toContain('Name,Age');
    expect(blobContent).not.toContain('Department');

    global.Blob = OrigBlob;
    jest.restoreAllMocks();
    grid.destroy();
  });

  it('csv uses valueFormatter when present', () => {
    const columns: IColumnDef<TestRow>[] = [
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric', valueFormatter: (val) => `${val} years` },
    ];
    const { grid } = createGrid({ columns, data: generateData(2), pageSize: 10 });

    let blobContent = '';
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
    const OrigBlob = global.Blob;
    global.Blob = class MockBlob {
      constructor(parts: BlobPart[]) { blobContent = parts.join(''); }
      get size() { return blobContent.length; }
      get type() { return 'text/csv'; }
    } as any;

    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = origCreate('a');
        a.click = jest.fn();
        return a;
      }
      return origCreate(tag);
    });

    grid.api.exportToCsv();

    expect(blobContent).toContain('20 years');

    global.Blob = OrigBlob;
    jest.restoreAllMocks();
    grid.destroy();
  });
});

describe('API interactions', () => {
  it('api.setRowData updates the display', () => {
    const { container, grid } = createGrid();

    grid.api.setRowData(generateData(5));

    const rows = container.querySelectorAll('.ogrid-row');
    expect(rows.length).toBe(5);

    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('1-5 of 5');

    grid.destroy();
  });

  it('api.clearFilters resets to page 1', () => {
    const { container, grid } = createGrid();

    // Go to page 2 first
    const nextBtn = container.querySelectorAll('.ogrid-pagination-btn');
    (nextBtn[nextBtn.length - 1] as HTMLButtonElement).click();

    // Clear filters resets page
    grid.api.clearFilters();

    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('1-10 of 50');

    grid.destroy();
  });

  it('api.getColumnState returns current state', () => {
    const { grid } = createGrid();

    const state = grid.api.getColumnState();
    expect(state.visibleColumns).toContain('name');
    expect(state.visibleColumns).toContain('age');
    expect(state.visibleColumns).toContain('department');
    expect(state.sort).toBeUndefined();

    grid.destroy();
  });
});
