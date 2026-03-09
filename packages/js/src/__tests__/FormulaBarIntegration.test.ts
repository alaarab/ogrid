import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', editable: true },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
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
    formulas: true,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Formula bar integration', () => {
  it('maps active cells to the correct column reference when formulas are enabled without row gutters', () => {
    const { container, grid } = createGrid();

    const firstCell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    firstCell.click();

    const nameBox = container.querySelector('.ogrid-formula-bar-name') as HTMLElement;
    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;

    expect(nameBox.textContent).toBe('A1');
    expect(input.value).toBe('Alice');

    const secondCell = container.querySelector('td[data-row-index="0"][data-col-index="1"]') as HTMLElement;
    secondCell.click();

    expect(nameBox.textContent).toBe('B1');
    expect(input.value).toBe('30');

    grid.destroy();
  });
});
