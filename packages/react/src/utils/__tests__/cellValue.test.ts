import { getCellValue } from '../cellValue';
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
