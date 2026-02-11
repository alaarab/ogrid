import { getStatusBarParts } from '../statusBarHelpers';

describe('getStatusBarParts', () => {
  it('returns only total when no optional fields', () => {
    const parts = getStatusBarParts({ totalCount: 100 });
    expect(parts).toEqual([{ key: 'total', label: 'Rows:', value: 100 }]);
  });

  it('includes filtered when different from total', () => {
    const parts = getStatusBarParts({ totalCount: 100, filteredCount: 50 });
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({ key: 'filtered', label: 'Filtered:', value: 50 });
  });

  it('omits filtered when equal to total', () => {
    const parts = getStatusBarParts({ totalCount: 100, filteredCount: 100 });
    expect(parts).toHaveLength(1);
  });

  it('includes selected when > 0', () => {
    const parts = getStatusBarParts({ totalCount: 100, selectedCount: 5 });
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({ key: 'selected', label: 'Selected:', value: 5 });
  });

  it('includes cells when > 1', () => {
    const parts = getStatusBarParts({ totalCount: 100, selectedCellCount: 10 });
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({ key: 'cells', label: 'Cells:', value: 10 });
  });

  it('omits cells when <= 1', () => {
    const parts = getStatusBarParts({ totalCount: 100, selectedCellCount: 1 });
    expect(parts).toHaveLength(1);
  });

  it('includes aggregation parts when aggregation is provided', () => {
    const parts = getStatusBarParts({
      totalCount: 100,
      aggregation: { sum: 60, avg: 20, min: 10, max: 30, count: 3 },
    });
    expect(parts).toHaveLength(6); // total + 5 aggregation parts
    expect(parts.find((p) => p.key === 'sum')).toEqual({ key: 'sum', label: 'Sum:', value: 60 });
    expect(parts.find((p) => p.key === 'avg')).toEqual({ key: 'avg', label: 'Avg:', value: 20 });
    expect(parts.find((p) => p.key === 'min')).toEqual({ key: 'min', label: 'Min:', value: 10 });
    expect(parts.find((p) => p.key === 'max')).toEqual({ key: 'max', label: 'Max:', value: 30 });
    expect(parts.find((p) => p.key === 'count')).toEqual({ key: 'count', label: 'Count:', value: 3 });
  });

  it('rounds avg to 2 decimal places', () => {
    const parts = getStatusBarParts({
      totalCount: 100,
      aggregation: { sum: 7, avg: 2.3333333, min: 1, max: 3, count: 3 },
    });
    const avgPart = parts.find((p) => p.key === 'avg');
    expect(avgPart!.value).toBe(2.33);
  });

  it('omits aggregation parts when aggregation is null', () => {
    const parts = getStatusBarParts({
      totalCount: 100,
      aggregation: null,
    });
    expect(parts).toHaveLength(1);
  });

  it('omits aggregation parts when aggregation is undefined', () => {
    const parts = getStatusBarParts({
      totalCount: 100,
      aggregation: undefined,
    });
    expect(parts).toHaveLength(1);
  });
});
