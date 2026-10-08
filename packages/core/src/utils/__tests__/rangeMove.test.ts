import { moveCellRange } from '../rangeMove';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  id: number;
  a: unknown;
  b: unknown;
  [key: string]: unknown;
}

const items: Row[] = [
  { id: 1, a: '1', b: '2' },
  { id: 2, a: '3', b: '4' },
  { id: 3, a: '5', b: '6' },
];

const cols: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', type: 'numeric', editable: true },
  { columnId: 'b', name: 'B', type: 'numeric', editable: true },
];

describe('moveCellRange', () => {
  it('moves a single cell and clears the source', () => {
    const events = moveCellRange({
      items,
      visibleCols: cols,
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRow: 2,
      targetCol: 0,
    });
    const paste = events.find((e) => e.rowIndex === 2 && e.columnId === 'a');
    expect(paste).toBeDefined();
    expect(paste?.newValue).toBe(1);
    const clear = events.find((e) => e.rowIndex === 0 && e.columnId === 'a');
    expect(clear).toBeDefined();
    expect(clear?.newValue).toBeNull();
  });

  it('moves a rectangular range', () => {
    const events = moveCellRange({
      items,
      visibleCols: cols,
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
      targetRow: 1,
      targetCol: 0,
    });
    // Row 1 already held 3/4, overwritten by 1/2.
    expect(events.find((e) => e.rowIndex === 1 && e.columnId === 'a')?.newValue).toBe(1);
    expect(events.find((e) => e.rowIndex === 1 && e.columnId === 'b')?.newValue).toBe(2);
    // Source row emptied.
    expect(events.find((e) => e.rowIndex === 0 && e.columnId === 'a')?.newValue).toBeNull();
    expect(events.find((e) => e.rowIndex === 0 && e.columnId === 'b')?.newValue).toBeNull();
  });

  it('copies without clearing the source', () => {
    const events = moveCellRange({
      items,
      visibleCols: cols,
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRow: 2,
      targetCol: 0,
      copy: true,
    });
    expect(events.every((e) => e.rowIndex !== 0)).toBe(true);
    expect(events.find((e) => e.rowIndex === 2 && e.columnId === 'a')?.newValue).toBe(1);
  });

  it('does not clear overwritten source cells when source and target overlap', () => {
    const events = moveCellRange({
      items,
      visibleCols: cols,
      source: { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
      targetRow: 1,
      targetCol: 0,
    });
    // The move moves row 0 down over row 1's cell; both become the moved value.
    const destination = events.find((e) => e.rowIndex === 1 && e.columnId === 'a');
    expect(destination?.newValue).toBe(1);
    const clears = events.filter((e) => e.newValue === null);
    // Only the source cell that did not receive a value is cleared.
    expect(clears).toHaveLength(1);
    expect(clears[0]?.rowIndex).toBe(0);
  });

  it('is a no-op for an unchanged move', () => {
    expect(
      moveCellRange({
        items,
        visibleCols: cols,
        source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        targetRow: 0,
        targetCol: 0,
      }),
    ).toEqual([]);
  });

  it('applies a column valueParser on the way in', () => {
    const upperCols: IColumnDef<Row>[] = [
      {
        columnId: 'a',
        name: 'A',
        editable: true,
        valueParser: ({ newValue }) => String(newValue).toUpperCase(),
      },
    ];
    const events = moveCellRange({
      items: [{ id: 1, a: 'x' }, { id: 2, a: 'y' }],
      visibleCols: upperCols,
      source: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      targetRow: 1,
      targetCol: 0,
    });
    expect(events.find((e) => e.rowIndex === 1)?.newValue).toBe('X');
  });
  it.each([
    { name: 'read-only destination', targetRow: 1, targetCol: 1, endRow: 0, readOnly: true },
    { name: 'clipped rows', targetRow: 2, targetCol: 0, endRow: 1 },
    { name: 'clipped columns', targetRow: 1, targetCol: 1, endRow: 0, endCol: 1 },
    { name: 'rejected parser', targetRow: 1, targetCol: 1, endRow: 0, rejected: true },
    { name: 'covered destination', targetRow: 1, targetCol: 1, endRow: 0, covered: true },
  ])('preserves values and formulas for a $name', ({ targetRow, targetCol, endRow, endCol = 0, readOnly, rejected, covered }) => {
    const setFormula = jest.fn();
    const events = moveCellRange({
      items, visibleCols: [cols[0], { ...cols[1], editable: !readOnly,
        valueParser: rejected ? () => undefined : undefined }],
      source: { startRow: 0, startCol: 0, endRow, endCol }, targetRow, targetCol,
      formulaOptions: { colOffset: 0, flatColumns: cols, hasFormula: (_c, r) => !rejected && r === 0,
        getFormula: () => '=1+2', setFormula },
      isCoveredCell: covered ? (r, c) => r === 1 && c === 1 : undefined,
    });
    expect(events).toEqual([]);
    expect(setFormula).not.toHaveBeenCalled();
  });

});
