import { OGrid } from '../OGrid';
import type { IColumnDef, OGridOptions } from '../types';

interface TestRow {
  id: number;
  name: string;
  age: number;
}

interface DateRow {
  id: number;
  startDate: string;
  name: string;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
  { columnId: 'age', name: 'Age', type: 'numeric', editable: true, cellEditor: 'text' },
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

const dateColumns: IColumnDef<DateRow>[] = [
  { columnId: 'startDate', name: 'Start Date', type: 'date', editable: true, cellEditor: 'date' },
  { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
];

function createDateGrid(options?: Partial<OGridOptions<DateRow>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<DateRow>(container, {
    columns: dateColumns,
    data: [
      { id: 1, startDate: '2024-01-01', name: 'Alpha' },
      { id: 2, startDate: '2024-02-02', name: 'Beta' },
    ],
    getRowId: (item: DateRow) => item.id,
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

function startFormulaBarEdit(input: HTMLInputElement, value: string): void {
  input.click();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Formula bar integration', () => {
  it('applies initial formulas before the first render paints the grid', () => {
    const { container, grid } = createGrid({
      initialFormulas: [{ col: 1, row: 0, formula: '=20+20' }],
    });

    const secondCell = container.querySelector('td[data-row-index="0"][data-col-index="1"]') as HTMLElement;
    expect(secondCell.textContent?.trim()).toBe('40');

    secondCell.click();

    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;
    expect(input.value).toBe('=20+20');

    grid.destroy();
  });

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

  it('commits formulas to the active cell without shifting left when no row gutters are enabled', () => {
    const { container, grid } = createGrid();

    const secondCell = container.querySelector('td[data-row-index="0"][data-col-index="1"]') as HTMLElement;
    secondCell.click();

    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;
    startFormulaBarEdit(input, '=40');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const formulaEngine = (grid as unknown as {
      formulaEngine: { getFormula: (col: number, row: number) => string | undefined };
    }).formulaEngine;

    expect(formulaEngine.getFormula(1, 0)).toBe('=40');
    expect(formulaEngine.getFormula(0, 0)).toBeUndefined();

    grid.destroy();
  });

  it('cancels formula-bar edits back to the active cell value without shifting left when no row gutters are enabled', () => {
    const { container, grid } = createGrid();

    const secondCell = container.querySelector('td[data-row-index="0"][data-col-index="1"]') as HTMLElement;
    secondCell.click();

    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;
    startFormulaBarEdit(input, 'Edited');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(input.value).toBe('30');

    grid.destroy();
  });

  it('shows the active date format as the formula-bar placeholder for date cells', () => {
    const { container, grid } = createDateGrid();

    const dateCell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    dateCell.click();

    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;
    expect(input.placeholder).toBe('YYYY-MM-DD');

    grid.destroy();
  });

  it('commits date values on formula-bar blur for date cells', () => {
    const { container, grid } = createDateGrid();

    const dateCell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    dateCell.click();

    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;
    startFormulaBarEdit(input, '2026-03-03');
    input.dispatchEvent(new Event('blur'));

    const updatedDateCell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    expect(updatedDateCell.textContent?.trim()).toBe('2026-03-03');

    grid.destroy();
  });

  it('commits formula-bar edits before selecting a different cell', () => {
    const { container, grid } = createDateGrid();

    const dateCell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    dateCell.click();

    const input = container.querySelector('.ogrid-formula-bar-input') as HTMLInputElement;
    startFormulaBarEdit(input, '2026-04-04');

    const nextCell = container.querySelector('td[data-row-index="1"][data-col-index="1"]') as HTMLElement;
    nextCell.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    nextCell.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

    const updatedDateCell = container.querySelector('td[data-row-index="0"][data-col-index="0"]') as HTMLElement;
    expect(updatedDateCell.textContent?.trim()).toBe('2026-04-04');

    grid.destroy();
  });
});
