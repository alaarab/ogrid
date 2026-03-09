import { GridState } from '../state/GridState';
import { OGridOptions } from '../types/gridTypes';

type Row = {
  id: string;
  name: string;
  age: number;
};

function makeOptions(overrides: Partial<OGridOptions<Row>> = {}): OGridOptions<Row> {
  return {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true },
      { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
    ],
    data: [
      { id: '1', name: 'Alice', age: 30 },
      { id: '2', name: 'Bob', age: 20 },
      { id: '3', name: 'Cara', age: 10 },
    ],
    getRowId: (item) => item.id,
    ...overrides,
  };
}

describe('GridState stable ordering cache', () => {
  it('re-sorts when setData replaces rows with the same length but a different row-id order', () => {
    const state = new GridState(makeOptions({
      sort: { field: 'age', direction: 'asc' },
    }));

    expect(state.getProcessedItems().items.map((row) => row.id)).toEqual(['3', '2', '1']);

    state.setData([
      { id: '1', name: 'Alice', age: 30 },
      { id: '3', name: 'Cara', age: 10 },
      { id: '2', name: 'Bob', age: 20 },
    ]);

    expect(state.getProcessedItems().items.map((row) => row.id)).toEqual(['3', '2', '1']);
  });

  it('preserves stable row positions for same-order data updates', () => {
    const state = new GridState(makeOptions({
      sort: { field: 'age', direction: 'asc' },
    }));

    expect(state.getProcessedItems().items.map((row) => row.id)).toEqual(['3', '2', '1']);

    state.setData([
      { id: '1', name: 'Alice', age: 99 },
      { id: '2', name: 'Bob', age: 20 },
      { id: '3', name: 'Cara', age: 10 },
    ]);

    expect(state.getProcessedItems().items.map((row) => row.id)).toEqual(['3', '2', '1']);
  });
});
