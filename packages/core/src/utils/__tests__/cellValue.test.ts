import { getCellValue, createFormulaRowMap, createOffsetFormulaRowMap } from '../cellValue';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  id: string;
  name: string;
  score: number;
}

describe('getCellValue', () => {
  it('returns item[columnId] when column has no valueGetter', () => {
    const item: Row = { id: '1', name: 'Alice', score: 10 };
    const col: IColumnDef<Row> = { columnId: 'name', name: 'Name' };
    expect(getCellValue(item, col)).toBe('Alice');
  });

  it('uses valueGetter when defined', () => {
    const item: Row = { id: '1', name: 'Alice', score: 10 };
    const col: IColumnDef<Row> = {
      columnId: 'double',
      name: 'Double',
      valueGetter: (row) => row.score * 2,
    };
    expect(getCellValue(item, col)).toBe(20);
  });

  it('returns undefined for missing key when no valueGetter', () => {
    const item: Row = { id: '1', name: 'Alice', score: 10 };
    const col: IColumnDef<Row> = { columnId: 'missing', name: 'Missing' };
    expect(getCellValue(item, col)).toBeUndefined();
  });
});

describe('createFormulaRowMap', () => {
  const data: Row[] = [
    { id: 'a', name: 'Cherry', score: 1 },
    { id: 'b', name: 'Apple', score: 2 },
    { id: 'c', name: 'Banana', score: 3 },
  ];
  const sheetRowById = new Map(data.map((r, i) => [r.id, i] as const));

  it('maps displayed rows to their index in the full data and back', () => {
    // Sorted by name and paged to the first two rows: Apple, Banana.
    const map = createFormulaRowMap(sheetRowById, [data[1], data[2]], (r) => r.id);
    expect(map.toSheetRow(0)).toBe(1);
    expect(map.toSheetRow(1)).toBe(2);
    expect(map.toDisplayRow(2)).toBe(1);
    // Cherry is on another page; out-of-range rows have no mapping.
    expect(map.toDisplayRow(0)).toBe(-1);
    expect(map.toSheetRow(5)).toBe(-1);
  });
});

describe('createOffsetFormulaRowMap', () => {
  it('maps a page starting at an absolute row', () => {
    const map = createOffsetFormulaRowMap(50, 25);
    expect(map.toSheetRow(0)).toBe(50);
    expect(map.toSheetRow(24)).toBe(74);
    expect(map.toSheetRow(25)).toBe(-1);
    expect(map.toDisplayRow(60)).toBe(10);
    expect(map.toDisplayRow(49)).toBe(-1);
  });
});
