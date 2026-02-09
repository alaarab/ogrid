import { flattenColumns } from '../columnUtils';
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
