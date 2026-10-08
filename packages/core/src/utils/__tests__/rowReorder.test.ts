import {
  applyRowOrder,
  computeRowOrderChange,
  isRowMoveNoop,
  moveRows,
  rowIndexById,
} from '../rowReorder';

interface Row {
  id: number;
  label: string;
}

const rows: Row[] = [
  { id: 1, label: 'a' },
  { id: 2, label: 'b' },
  { id: 3, label: 'c' },
  { id: 4, label: 'd' },
];
const getRowId = (r: Row) => r.id;

describe('moveRows', () => {
  it('moves a single row down to the drop gap', () => {
    const { data, toIndex, changed } = moveRows(rows, [0], 2);
    expect(changed).toBe(true);
    expect(data.map(getRowId)).toEqual([2, 1, 3, 4]);
    expect(toIndex).toBe(1);
  });

  it('moves a single row to the end', () => {
    const { data } = moveRows(rows, [0], 4);
    expect(data.map(getRowId)).toEqual([2, 3, 4, 1]);
  });

  it('moves a contiguous block', () => {
    const { data, toIndex } = moveRows(rows, [1, 2], 4);
    expect(data.map(getRowId)).toEqual([1, 4, 2, 3]);
    expect(toIndex).toBe(2);
  });

  it('is a no-op when dropping on the block', () => {
    const { data, changed } = moveRows(rows, [1, 2], 2);
    expect(changed).toBe(false);
    expect(data.map(getRowId)).toEqual([1, 2, 3, 4]);
  });

  it('does not mutate the input', () => {
    moveRows(rows, [0], 3);
    expect(rows.map(getRowId)).toEqual([1, 2, 3, 4]);
  });

  it('clamps an out-of-range gap', () => {
    expect(moveRows(rows, [3], 99).data.map(getRowId)).toEqual([1, 2, 3, 4]);
  });
});

describe('computeRowOrderChange', () => {
  it('reports ids, from/to and the new data', () => {
    const event = computeRowOrderChange(rows, [0], 3, getRowId);
    expect(event).not.toBeNull();
    expect(event?.rowIds).toEqual([2, 3, 1, 4]);
    expect(event?.fromIndex).toBe(0);
    expect(event?.toIndex).toBe(2);
    expect(event?.data.map(getRowId)).toEqual([2, 3, 1, 4]);
  });

  it('is null for a no-op move', () => {
    expect(computeRowOrderChange(rows, [1], 2, getRowId)).toBeNull();
  });
});

describe('applyRowOrder', () => {
  it('reorders to the given id order', () => {
    expect(applyRowOrder(rows, [3, 1, 2, 4], getRowId).map(getRowId)).toEqual([3, 1, 2, 4]);
  });

  it('appends ids the order does not list, in source order', () => {
    expect(applyRowOrder(rows, [3, 1], getRowId).map(getRowId)).toEqual([3, 1, 2, 4]);
  });

  it('ignores a null or empty order', () => {
    expect(applyRowOrder(rows, null, getRowId).map(getRowId)).toEqual([1, 2, 3, 4]);
    expect(applyRowOrder(rows, [], getRowId).map(getRowId)).toEqual([1, 2, 3, 4]);
  });
});

describe('rowIndexById / isRowMoveNoop', () => {
  it('finds a row index by id', () => {
    expect(rowIndexById(rows, 3, getRowId)).toBe(2);
    expect(rowIndexById(rows, 99, getRowId)).toBe(-1);
  });

  it('flags drops on the moved block', () => {
    expect(isRowMoveNoop([1, 2], 2)).toBe(true);
    expect(isRowMoveNoop([1, 2], 3)).toBe(true);
    expect(isRowMoveNoop([1, 2], 4)).toBe(false);
    expect(isRowMoveNoop([1, 2], 1)).toBe(true);
  });
});
