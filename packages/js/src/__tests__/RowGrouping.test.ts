import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface Employee {
  id: number;
  name: string;
  department: string;
  country: string;
}

const testColumns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'country', name: 'Country' },
];

const testData: Employee[] = [
  { id: 1, name: 'Alice', department: 'Engineering', country: 'US' },
  { id: 2, name: 'Bob', department: 'Engineering', country: 'US' },
  { id: 3, name: 'Charlie', department: 'Marketing', country: 'UK' },
  { id: 4, name: 'Dave', department: 'Marketing', country: 'US' },
  { id: 5, name: 'Eve', department: 'Sales', country: 'UK' },
];

function createGrid(options?: Partial<OGridOptions<Employee>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<Employee>(container, {
    columns: testColumns,
    data: testData,
    getRowId: (item) => item.id,
    pageSize: 50,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Row Grouping - JS Package', () => {
  it('setGroupBy renders group header rows in the table', () => {
    const { container, grid } = createGrid();

    // No grouping initially - should have 5 data rows
    const rowsBefore = container.querySelectorAll('.ogrid-row');
    expect(rowsBefore.length).toBe(5);

    // Group by department
    grid.setGroupBy(['department']);

    // Should see group header rows (collapsed by default, so only headers)
    const groupHeaders = container.querySelectorAll('.ogrid-group-header-row');
    expect(groupHeaders.length).toBe(3); // Engineering, Marketing, Sales

    // No data rows visible when collapsed
    const dataRows = container.querySelectorAll('.ogrid-row');
    expect(dataRows.length).toBe(0);

    grid.destroy();
  });

  it('toggleGroup expands and collapses a group', () => {
    const { container, grid } = createGrid({ groupBy: ['department'] });

    // All collapsed - only headers
    let groupHeaders = container.querySelectorAll('.ogrid-group-header-row');
    expect(groupHeaders.length).toBe(3);
    expect(container.querySelectorAll('.ogrid-row').length).toBe(0);

    // Expand Engineering group (key format: columnId::value)
    grid.toggleGroup('department::Engineering');

    // Now Engineering's 2 items should be visible
    const dataRows = container.querySelectorAll('.ogrid-row');
    expect(dataRows.length).toBe(2);
    groupHeaders = container.querySelectorAll('.ogrid-group-header-row');
    expect(groupHeaders.length).toBe(3);

    // Collapse it again
    grid.toggleGroup('department::Engineering');
    expect(container.querySelectorAll('.ogrid-row').length).toBe(0);

    grid.destroy();
  });

  it('expandAllGroups shows all items', () => {
    const { container, grid } = createGrid({ groupBy: ['department'] });

    grid.expandAllGroups();

    // All 5 data rows visible plus 3 group headers
    expect(container.querySelectorAll('.ogrid-row').length).toBe(5);
    expect(container.querySelectorAll('.ogrid-group-header-row').length).toBe(3);

    grid.destroy();
  });

  it('collapseAllGroups hides all items', () => {
    const { container, grid } = createGrid({ groupBy: ['department'] });

    grid.expandAllGroups();
    expect(container.querySelectorAll('.ogrid-row').length).toBe(5);

    grid.collapseAllGroups();
    expect(container.querySelectorAll('.ogrid-row').length).toBe(0);
    expect(container.querySelectorAll('.ogrid-group-header-row').length).toBe(3);

    grid.destroy();
  });

  it('group header displays correct text and item count', () => {
    const { container, grid } = createGrid({ groupBy: ['department'] });

    const headers = container.querySelectorAll('.ogrid-group-header-row td');
    const headerTexts = Array.from(headers).map((td) => td.textContent?.trim());

    expect(headerTexts).toContain('\u25B6 Engineering (2)');
    expect(headerTexts).toContain('\u25B6 Marketing (2)');
    expect(headerTexts).toContain('\u25B6 Sales (1)');

    grid.destroy();
  });

  it('clicking a group header row toggles expansion', () => {
    const { container, grid } = createGrid({ groupBy: ['department'] });

    const firstHeader = container.querySelector('.ogrid-group-header-row td');
    expect(firstHeader).toBeTruthy();

    // Click to expand
    firstHeader!.dispatchEvent(new Event('click', { bubbles: true }));

    // Should have data rows visible for that group
    expect(container.querySelectorAll('.ogrid-row').length).toBeGreaterThan(0);

    grid.destroy();
  });

  it('empty groupBy returns items as-is', () => {
    const { container, grid } = createGrid({ groupBy: [] });

    expect(container.querySelectorAll('.ogrid-row').length).toBe(5);
    expect(container.querySelectorAll('.ogrid-group-header-row').length).toBe(0);

    grid.destroy();
  });
});
