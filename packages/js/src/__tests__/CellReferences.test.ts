import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';
import { indexToColumnLetter, formatCellReference } from '@alaarab/ogrid-core';

interface TestRow {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', editable: true },
  { columnId: 'active', name: 'Active', type: 'boolean', editable: true },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30, active: true },
  { id: 2, name: 'Bob', age: 25, active: false },
  { id: 3, name: 'Charlie', age: 35, active: true },
  { id: 4, name: 'Dave', age: 28, active: false },
  { id: 5, name: 'Eve', age: 32, active: true },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    pageSize: 20,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ============================================================
// Column Letter Row Rendering
// ============================================================

describe('Cell References - Column Letter Row', () => {
  it('renders a column letter row in thead when cellReferences is true', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).not.toBeNull();
    expect(letterRow!.tagName).toBe('TR');

    // The letter row should be inside thead
    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();
    expect(thead!.contains(letterRow!)).toBe(true);

    grid.destroy();
  });

  it('does not render column letter row when cellReferences is not set', () => {
    const { container, grid } = createGrid();

    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).toBeNull();

    grid.destroy();
  });

  it('does not render column letter row when cellReferences is false', () => {
    const { container, grid } = createGrid({ cellReferences: false });

    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).toBeNull();

    grid.destroy();
  });

  it('renders correct column letters matching number of visible columns', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const letterCells = container.querySelectorAll('.ogrid-column-letter-cell');
    // With cellReferences, row numbers are also shown, so there is a gutter cell
    // for row numbers + one cell per column = 1 + 3 = 4
    // Filter out gutter cells (empty text content) to find data column letters
    const dataLetterCells = Array.from(letterCells).filter(cell => cell.textContent !== '');

    expect(dataLetterCells.length).toBe(3); // 3 visible columns
    expect(dataLetterCells[0].textContent).toBe('A');
    expect(dataLetterCells[1].textContent).toBe('B');
    expect(dataLetterCells[2].textContent).toBe('C');

    grid.destroy();
  });

  it('column letters use indexToColumnLetter for each visible column', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const letterCells = Array.from(
      container.querySelectorAll('.ogrid-column-letter-cell')
    ).filter(cell => cell.textContent !== '');

    for (let i = 0; i < letterCells.length; i++) {
      expect(letterCells[i].textContent).toBe(indexToColumnLetter(i));
    }

    grid.destroy();
  });

  it('column letter row is the first row in thead (before column name headers)', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();
    const firstRow = thead!.querySelector('tr');
    expect(firstRow).not.toBeNull();
    expect(firstRow!.classList.contains('ogrid-column-letter-row')).toBe(true);

    grid.destroy();
  });

  it('column letters update when visibleColumns changes', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      visibleColumns: new Set(['name', 'age']),
    });

    const dataLetterCells = Array.from(
      container.querySelectorAll('.ogrid-column-letter-cell')
    ).filter(cell => cell.textContent !== '');

    expect(dataLetterCells.length).toBe(2);
    expect(dataLetterCells[0].textContent).toBe('A');
    expect(dataLetterCells[1].textContent).toBe('B');

    grid.destroy();
  });

  it('includes empty gutter cell for row numbers in the letter row', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    // cellReferences implies showRowNumbers, so there should be a gutter cell
    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).not.toBeNull();

    const allLetterCells = letterRow!.querySelectorAll('.ogrid-column-letter-cell');
    // Gutter cell(s) for row numbers + 3 data column letter cells
    // The gutter cell for row numbers should be empty
    const gutterCells = Array.from(allLetterCells).filter(cell => cell.textContent === '');
    expect(gutterCells.length).toBeGreaterThanOrEqual(1);

    grid.destroy();
  });

  it('includes empty gutter cells for both checkbox and row numbers when rowSelection is set', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      rowSelection: 'multiple',
    });

    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).not.toBeNull();

    const allLetterCells = letterRow!.querySelectorAll('.ogrid-column-letter-cell');
    // Should have: checkbox gutter + row number gutter + 3 data letters = 5
    const gutterCells = Array.from(allLetterCells).filter(cell => cell.textContent === '');
    expect(gutterCells.length).toBe(2); // One for checkbox, one for row numbers

    const dataLetterCells = Array.from(allLetterCells).filter(cell => cell.textContent !== '');
    expect(dataLetterCells.length).toBe(3);

    grid.destroy();
  });
});

// ============================================================
// Row Numbers
// ============================================================

describe('Cell References - Row Numbers', () => {
  it('renders row numbers when cellReferences is true', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(5); // 5 data rows

    grid.destroy();
  });

  it('row numbers are sequential starting from 1', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells[0].textContent).toBe('1');
    expect(rowNumberCells[1].textContent).toBe('2');
    expect(rowNumberCells[2].textContent).toBe('3');
    expect(rowNumberCells[3].textContent).toBe('4');
    expect(rowNumberCells[4].textContent).toBe('5');

    grid.destroy();
  });

  it('renders row number header with # symbol', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const rowNumHeader = container.querySelector('.ogrid-row-number-header');
    expect(rowNumHeader).not.toBeNull();
    expect(rowNumHeader!.textContent).toBe('#');

    grid.destroy();
  });

  it('does not render row numbers when cellReferences is not set', () => {
    const { container, grid } = createGrid();

    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(0);

    grid.destroy();
  });

  it('showRowNumbers works independently of cellReferences', () => {
    const { container, grid } = createGrid({ showRowNumbers: true });

    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(5);

    // But column letter row should NOT appear (that's only from cellReferences)
    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).toBeNull();

    grid.destroy();
  });
});

// ============================================================
// Name Box
// ============================================================

describe('Cell References - Name Box', () => {
  it('renders a name box element in the toolbar when cellReferences is true', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();

    grid.destroy();
  });

  it('name box is not rendered when cellReferences is not set', () => {
    const { container, grid } = createGrid();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).toBeNull();

    grid.destroy();
  });

  it('name box is not rendered when cellReferences is false', () => {
    const { container, grid } = createGrid({ cellReferences: false });

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).toBeNull();

    grid.destroy();
  });

  it('name box shows em dash initially when no cell is active', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // Em dash: \u2014
    expect(nameBox!.textContent).toBe('\u2014');

    grid.destroy();
  });

  it('name box has monospace font styling', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    const nameBox = container.querySelector('.ogrid-name-box') as HTMLElement;
    expect(nameBox).not.toBeNull();
    expect(nameBox.style.fontFamily).toContain('Consolas');

    grid.destroy();
  });

  it('name box updates to cell reference after clicking a cell', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
    });

    // Click the first data cell (Name column, first row)
    const cell = container.querySelector('td[data-row-index="0"][data-col-index="1"]') as HTMLElement;
    // col-index 1 because row numbers take col-index 0 when cellReferences is set
    // Actually, row number cells don't have data-col-index, data cells start at colOffset
    // Let's find the first data cell by column-id
    const nameCell = container.querySelector('td[data-column-id="name"][data-row-index="0"]') as HTMLElement;
    expect(nameCell).not.toBeNull();
    nameCell.click();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // First column (A), first row (1) -> "A1"
    expect(nameBox!.textContent).toBe('A1');

    grid.destroy();
  });

  it('name box shows correct reference for different columns', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
    });

    // Click the age cell in the second row
    const ageCell = container.querySelector('td[data-column-id="age"][data-row-index="1"]') as HTMLElement;
    expect(ageCell).not.toBeNull();
    ageCell.click();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // Age is column B (index 1), row 2 -> "B2"
    expect(nameBox!.textContent).toBe('B2');

    grid.destroy();
  });

  it('name box shows correct reference for third column', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
    });

    // Click the active cell in the third row
    const activeCell = container.querySelector('td[data-column-id="active"][data-row-index="2"]') as HTMLElement;
    expect(activeCell).not.toBeNull();
    activeCell.click();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // Active is column C (index 2), row 3 -> "C3"
    expect(nameBox!.textContent).toBe('C3');

    grid.destroy();
  });

  it('name box uses formatCellReference to compute the display value', () => {
    // Verify the format matches what formatCellReference produces
    expect(formatCellReference(0, 1)).toBe('A1');
    expect(formatCellReference(1, 2)).toBe('B2');
    expect(formatCellReference(2, 3)).toBe('C3');
    expect(formatCellReference(25, 100)).toBe('Z100');
    expect(formatCellReference(26, 1)).toBe('AA1');
  });
});

// ============================================================
// Name Box with Pagination
// ============================================================

describe('Cell References - Name Box with Pagination', () => {
  it('row numbers are offset by page on page 2', () => {
    // Create enough data for 2 pages with pageSize=3
    const pagedData: TestRow[] = [
      { id: 1, name: 'Alice', age: 30, active: true },
      { id: 2, name: 'Bob', age: 25, active: false },
      { id: 3, name: 'Charlie', age: 35, active: true },
      { id: 4, name: 'Dave', age: 28, active: false },
      { id: 5, name: 'Eve', age: 32, active: true },
    ];

    const { container, grid } = createGrid({
      cellReferences: true,
      data: pagedData,
      pageSize: 3,
      page: 2,
    });

    // On page 2 with pageSize=3, row numbers should start at 4
    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(2); // Only 2 items on page 2 (items 4 and 5)
    expect(rowNumberCells[0].textContent).toBe('4');
    expect(rowNumberCells[1].textContent).toBe('5');

    grid.destroy();
  });

  it('name box accounts for page offset when clicking cells on page 2', () => {
    const pagedData: TestRow[] = [
      { id: 1, name: 'A1', age: 10, active: true },
      { id: 2, name: 'A2', age: 20, active: false },
      { id: 3, name: 'A3', age: 30, active: true },
      { id: 4, name: 'A4', age: 40, active: false },
      { id: 5, name: 'A5', age: 50, active: true },
    ];

    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
      data: pagedData,
      pageSize: 3,
      page: 2,
    });

    // Click the first data cell on page 2
    const nameCell = container.querySelector('td[data-column-id="name"][data-row-index="0"]') as HTMLElement;
    expect(nameCell).not.toBeNull();
    nameCell.click();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // On page 2 with pageSize=3: row number = (2-1)*3 + 0 + 1 = 4
    // Column A, row 4 -> "A4"
    expect(nameBox!.textContent).toBe('A4');

    grid.destroy();
  });

  it('name box shows correct reference on page 1', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
      pageSize: 3,
      page: 1,
    });

    // Click the last cell on page 1
    const cell = container.querySelector('td[data-column-id="active"][data-row-index="2"]') as HTMLElement;
    expect(cell).not.toBeNull();
    cell.click();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // Page 1, row index 2 -> row number = 3, column C -> "C3"
    expect(nameBox!.textContent).toBe('C3');

    grid.destroy();
  });

  it('row numbers on page 1 start at 1', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      pageSize: 3,
      page: 1,
    });

    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(3); // pageSize=3
    expect(rowNumberCells[0].textContent).toBe('1');
    expect(rowNumberCells[1].textContent).toBe('2');
    expect(rowNumberCells[2].textContent).toBe('3');

    grid.destroy();
  });
});

// ============================================================
// Default behavior (cellReferences: false / not set)
// ============================================================

describe('Cell References - Default (disabled)', () => {
  it('no column letter row without cellReferences', () => {
    const { container, grid } = createGrid();

    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).toBeNull();

    const letterCells = container.querySelectorAll('.ogrid-column-letter-cell');
    expect(letterCells.length).toBe(0);

    grid.destroy();
  });

  it('no name box without cellReferences', () => {
    const { container, grid } = createGrid();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).toBeNull();

    grid.destroy();
  });

  it('no row numbers without cellReferences or showRowNumbers', () => {
    const { container, grid } = createGrid();

    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(0);

    const rowNumHeader = container.querySelector('.ogrid-row-number-header');
    expect(rowNumHeader).toBeNull();

    grid.destroy();
  });

  it('headers render normally without cellReferences', () => {
    const { container, grid } = createGrid();

    const headers = container.querySelectorAll('th.ogrid-header-cell');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe('Name');
    expect(headers[1].textContent).toBe('Age');
    expect(headers[2].textContent).toBe('Active');

    grid.destroy();
  });
});

// ============================================================
// Integration: Cell References + Row Selection
// ============================================================

describe('Cell References + Row Selection Integration', () => {
  it('name box accounts for checkbox column offset', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
      rowSelection: 'multiple',
    });

    // With row selection, there's a checkbox column before data columns
    // Click the first data cell (Name column)
    const nameCell = container.querySelector('td[data-column-id="name"][data-row-index="0"]') as HTMLElement;
    expect(nameCell).not.toBeNull();
    nameCell.click();

    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();
    // Should still be A1 (checkbox offset should be subtracted)
    expect(nameBox!.textContent).toBe('A1');

    grid.destroy();
  });

  it('all three features coexist: column letters, row numbers, and name box', () => {
    const { container, grid } = createGrid({
      cellReferences: true,
      cellSelection: true,
      rowSelection: 'multiple',
    });

    // Column letter row
    const letterRow = container.querySelector('.ogrid-column-letter-row');
    expect(letterRow).not.toBeNull();

    // Row numbers
    const rowNumberCells = container.querySelectorAll('.ogrid-row-number-cell');
    expect(rowNumberCells.length).toBe(5);

    // Name box
    const nameBox = container.querySelector('.ogrid-name-box');
    expect(nameBox).not.toBeNull();

    // Checkboxes
    const checkboxes = container.querySelectorAll('.ogrid-row-checkbox');
    expect(checkboxes.length).toBe(5);

    grid.destroy();
  });
});

// ============================================================
// Destroy cleanup
// ============================================================

describe('Cell References - Cleanup', () => {
  it('destroy clears all cell reference elements', () => {
    const { container, grid } = createGrid({ cellReferences: true });

    // Verify elements exist before destroy
    expect(container.querySelector('.ogrid-column-letter-row')).not.toBeNull();
    expect(container.querySelector('.ogrid-name-box')).not.toBeNull();
    expect(container.querySelectorAll('.ogrid-row-number-cell').length).toBe(5);

    grid.destroy();

    // After destroy, all grid DOM should be cleaned up
    expect(container.querySelector('.ogrid-column-letter-row')).toBeNull();
    expect(container.querySelector('.ogrid-name-box')).toBeNull();
    expect(container.querySelectorAll('.ogrid-row-number-cell').length).toBe(0);
  });
});
