import { computeAggregations } from '../aggregationUtils';
import type { IColumnDef } from '../../types/columnTypes';

type Row = { id: string; amount: number; name: string; rate?: number };

const columns: IColumnDef<Row>[] = [
  { columnId: 'amount', name: 'Amount' },
  { columnId: 'name', name: 'Name' },
];

const items: Row[] = [
  { id: '1', amount: 10, name: 'Alice' },
  { id: '2', amount: 20, name: 'Bob' },
  { id: '3', amount: 30, name: 'Carol' },
];

describe('computeAggregations', () => {
  it('returns null for no selection', () => {
    expect(computeAggregations(items, columns, null)).toBeNull();
  });

  it('returns null for single cell selection', () => {
    expect(
      computeAggregations(items, columns, {
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 0,
      })
    ).toBeNull();
  });

  it('computes aggregation for numeric column range', () => {
    const result = computeAggregations(items, columns, {
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.sum).toBe(60);
    expect(result!.avg).toBe(20);
    expect(result!.min).toBe(10);
    expect(result!.max).toBe(30);
    expect(result!.count).toBe(3);
  });

  it('ignores non-numeric values', () => {
    const result = computeAggregations(items, columns, {
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });
    expect(result).not.toBeNull();
    // 4 cells total, but only 2 are numeric (amount column)
    expect(result!.sum).toBe(30); // 10 + 20
    expect(result!.count).toBe(2);
  });

  it('returns null when no numeric values in selection', () => {
    const result = computeAggregations(items, columns, {
      startRow: 0,
      startCol: 1,
      endRow: 1,
      endCol: 1,
    });
    // Only name column selected — no numbers
    expect(result).toBeNull();
  });

  it('handles reversed (bottom-right to top-left) selection range', () => {
    const result = computeAggregations(items, columns, {
      startRow: 2,
      startCol: 0,
      endRow: 0,
      endCol: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.sum).toBe(60);
    expect(result!.min).toBe(10);
    expect(result!.max).toBe(30);
    expect(result!.count).toBe(3);
  });

  it('clamps to actual data bounds', () => {
    const result = computeAggregations(items, columns, {
      startRow: 0,
      startCol: 0,
      endRow: 100,
      endCol: 0,
    });
    expect(result).not.toBeNull();
    // Only 3 rows exist
    expect(result!.sum).toBe(60);
    expect(result!.count).toBe(3);
  });

  it('computes correct avg with decimals', () => {
    const decimalItems: Row[] = [
      { id: '1', amount: 10, name: 'A', rate: 1.5 },
      { id: '2', amount: 20, name: 'B', rate: 2.5 },
      { id: '3', amount: 30, name: 'C', rate: 3.5 },
    ];
    const cols: IColumnDef<Row>[] = [
      { columnId: 'rate', name: 'Rate' },
    ];
    const result = computeAggregations(decimalItems, cols, {
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.sum).toBeCloseTo(7.5);
    expect(result!.avg).toBeCloseTo(2.5);
    expect(result!.min).toBeCloseTo(1.5);
    expect(result!.max).toBeCloseTo(3.5);
  });

  it('handles numeric strings via parseFloat', () => {
    type StringRow = { id: string; value: string };
    const stringItems: StringRow[] = [
      { id: '1', value: '100' },
      { id: '2', value: '200' },
    ];
    const stringCols: IColumnDef<StringRow>[] = [
      { columnId: 'value', name: 'Value' },
    ];
    const result = computeAggregations(stringItems, stringCols, {
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.sum).toBe(300);
    expect(result!.count).toBe(2);
  });

  it('uses valueGetter when defined', () => {
    const cols: IColumnDef<Row>[] = [
      {
        columnId: 'computed',
        name: 'Computed',
        valueGetter: (item: Row) => item.amount * 2,
      },
    ];
    const result = computeAggregations(items, cols, {
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.sum).toBe(120); // (10+20+30) * 2
    expect(result!.avg).toBe(40);
  });
});
