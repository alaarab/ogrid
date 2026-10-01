import { flattenColumns, buildHeaderRows } from '../columnUtils';
import type { IColumnDef, IColumnGroupDef } from '../../types/columnTypes';

describe('flattenColumns', () => {
  it('returns flat columns unchanged', () => {
    const cols: IColumnDef<{ a: string; b: number }>[] = [
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
    ];
    expect(flattenColumns(cols)).toEqual(cols);
  });

  it('flattens one level of groups', () => {
    const group: IColumnGroupDef<{ a: string; b: number }> = {
      headerName: 'Group',
      children: [
        { columnId: 'a', name: 'A' },
        { columnId: 'b', name: 'B' },
      ],
    };
    expect(flattenColumns([group])).toEqual([
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
    ]);
  });

  it('flattens nested groups', () => {
    const tree: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Outer',
        children: [
          {
            headerName: 'Inner',
            children: [
              { columnId: 'x', name: 'X' },
              { columnId: 'y', name: 'Y' },
            ],
          },
          { columnId: 'z', name: 'Z' },
        ],
      },
    ];
    expect(flattenColumns(tree)).toEqual([
      { columnId: 'x', name: 'X' },
      { columnId: 'y', name: 'Y' },
      { columnId: 'z', name: 'Z' },
    ]);
  });
});

describe('buildHeaderRows', () => {
  it('returns single row for flat columns', () => {
    const cols: IColumnDef<{ a: string; b: number }>[] = [
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
    ];
    const rows = buildHeaderRows(cols);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({ label: 'A', colSpan: 1, isGroup: false });
    expect(rows[0][1]).toMatchObject({ label: 'B', colSpan: 1, isGroup: false });
  });

  it('returns two rows for one level of groups', () => {
    const cols: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Group',
        children: [
          { columnId: 'a', name: 'A' },
          { columnId: 'b', name: 'B' },
        ],
      },
      { columnId: 'c', name: 'C' },
    ];
    const rows = buildHeaderRows(cols);
    expect(rows).toHaveLength(2);
    // Top row: Group (colSpan 2) + C (colSpan 1, leaf promoted)
    expect(rows[0]).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({ label: 'Group', colSpan: 2, isGroup: true });
    expect(rows[0][1]).toMatchObject({ label: 'C', colSpan: 1, isGroup: false });
    // Bottom row: A, B (leaves under group)
    expect(rows[1]).toHaveLength(2);
    expect(rows[1][0]).toMatchObject({ label: 'A', colSpan: 1, isGroup: false });
    expect(rows[1][1]).toMatchObject({ label: 'B', colSpan: 1, isGroup: false });
  });

  it('returns three rows for nested groups', () => {
    const cols: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Outer',
        children: [
          {
            headerName: 'Inner',
            children: [
              { columnId: 'x', name: 'X' },
              { columnId: 'y', name: 'Y' },
            ],
          },
          { columnId: 'z', name: 'Z' },
        ],
      },
    ];
    const rows = buildHeaderRows(cols);
    expect(rows).toHaveLength(3);
    // Top: Outer (colSpan 3)
    expect(rows[0][0]).toMatchObject({ label: 'Outer', colSpan: 3, isGroup: true });
    // Middle: Inner (colSpan 2) + Z (leaf)
    expect(rows[1]).toHaveLength(2);
    expect(rows[1][0]).toMatchObject({ label: 'Inner', colSpan: 2, isGroup: true });
    expect(rows[1][1]).toMatchObject({ label: 'Z', colSpan: 1, isGroup: false });
    // Bottom: X, Y
    expect(rows[2]).toHaveLength(2);
    expect(rows[2][0]).toMatchObject({ label: 'X', colSpan: 1, isGroup: false });
    expect(rows[2][1]).toMatchObject({ label: 'Y', colSpan: 1, isGroup: false });
  });

  it('filters by visibleColumns', () => {
    const cols: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Group',
        children: [
          { columnId: 'a', name: 'A' },
          { columnId: 'b', name: 'B' },
        ],
      },
    ];
    const rows = buildHeaderRows(cols, new Set(['a']));
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({ label: 'Group', colSpan: 1 });
    expect(rows[1]).toHaveLength(1);
    expect(rows[1][0]).toMatchObject({ label: 'A' });
  });

  it('skips empty groups when all children hidden', () => {
    const cols: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Group',
        children: [
          { columnId: 'a', name: 'A' },
        ],
      },
      { columnId: 'b', name: 'B' },
    ];
    const rows = buildHeaderRows(cols, new Set(['b']));
    // Group is empty (a is hidden), so only B remains  -  single row
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({ label: 'B' });
  });

  it('orders flat leaf cells by columnOrder', () => {
    const cols: IColumnDef<unknown>[] = [
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
      { columnId: 'c', name: 'C' },
    ];
    const rows = buildHeaderRows(cols, undefined, ['c', 'a', 'b']);
    expect(rows).toHaveLength(1);
    expect(rows[0].map((c) => c.columnDef?.columnId)).toEqual(['c', 'a', 'b']);
  });

  it('puts ids missing from columnOrder last, in definition order', () => {
    const cols: IColumnDef<unknown>[] = [
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
      { columnId: 'c', name: 'C' },
      { columnId: 'd', name: 'D' },
    ];
    const rows = buildHeaderRows(cols, new Set(['a', 'b', 'c', 'd']), ['d', 'b']);
    expect(rows[0].map((c) => c.columnDef?.columnId)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('applies the visible set and order together (responsive hiding + reorder)', () => {
    const cols: IColumnDef<unknown>[] = [
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
      { columnId: 'c', name: 'C' },
    ];
    const rows = buildHeaderRows(cols, new Set(['a', 'c']), ['c', 'a']);
    expect(rows[0].map((c) => c.columnDef?.columnId)).toEqual(['c', 'a']);
  });

  it('reorders leaves inside a group and keeps the group spanning them', () => {
    const cols: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Group',
        children: [
          { columnId: 'a', name: 'A' },
          { columnId: 'b', name: 'B' },
        ],
      },
      { columnId: 'c', name: 'C' },
    ];
    const rows = buildHeaderRows(cols, undefined, ['b', 'a', 'c']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({ label: 'Group', colSpan: 2, isGroup: true });
    expect(rows[0][1]).toMatchObject({ label: 'C', isGroup: false });
    expect(rows[1].map((c) => c.columnDef?.columnId)).toEqual(['b', 'a']);
  });

  it('splits a group whose leaves are no longer adjacent', () => {
    const cols: (IColumnGroupDef<unknown> | IColumnDef<unknown>)[] = [
      {
        headerName: 'Group',
        children: [
          { columnId: 'a', name: 'A' },
          { columnId: 'b', name: 'B' },
        ],
      },
      { columnId: 'c', name: 'C' },
    ];
    const rows = buildHeaderRows(cols, undefined, ['a', 'c', 'b']);
    expect(rows).toHaveLength(2);
    // Top row: Group(a) | C (leaf, spans both rows) | Group(b)
    expect(rows[0].map((c) => [c.label, c.colSpan, c.isGroup])).toEqual([
      ['Group', 1, true],
      ['C', 1, false],
      ['Group', 1, true],
    ]);
    expect(rows[1].map((c) => c.columnDef?.columnId)).toEqual(['a', 'b']);
    // Total leaf span across the top row matches the leaf count
    expect(rows[0].reduce((n, c) => n + c.colSpan, 0)).toBe(3);
  });
});
