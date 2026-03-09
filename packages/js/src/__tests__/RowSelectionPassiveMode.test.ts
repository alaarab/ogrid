import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name' },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

function createGrid(options?: Partial<OGridOptions<TestRow>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    rowSelection: 'multiple',
    cellSelection: false,
    editable: false,
    ...options,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Row selection without cell interaction', () => {
  it('still renders row checkboxes and toggles selection', () => {
    const { container, grid } = createGrid();

    const checkbox = container.querySelector('.ogrid-row-checkbox') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();

    checkbox!.click();

    expect(grid.api.getSelectedRows()).toEqual([1]);

    grid.destroy();
  });
});
