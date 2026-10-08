import {
  insertRowsAt,
  removeRowsById,
  restoreRemovedRows,
  insertColumnAt,
  removeColumnById,
  createStructureColumn,
  countLeafColumns,
  remapMergedCells,
} from '../structureEdits';
import { flattenColumns } from '../columnUtils';
import { getStructureMenuItems, getColumnHeaderMenuItems } from '../gridContextMenuHelpers';
import type { IColumnDef, IColumnGroupDef } from '../../types/columnTypes';

type Row = { id: number };
const data: Row[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('row structure helpers', () => {
  it('insertRowsAt inserts before the index, clamped, without mutating the input', () => {
    expect(ids(insertRowsAt(data, 1, [{ id: 9 }]))).toEqual([1, 9, 2, 3, 4]);
    expect(ids(insertRowsAt(data, 99, [{ id: 9 }]))).toEqual([1, 2, 3, 4, 9]);
    expect(ids(insertRowsAt(data, -5, [{ id: 9 }]))).toEqual([9, 1, 2, 3, 4]);
    expect(ids(data)).toEqual([1, 2, 3, 4]);
  });

  it('removeRowsById and restoreRemovedRows round-trip non-contiguous rows', () => {
    const { data: next, removed } = removeRowsById(data, [4, 2], (r) => r.id);
    expect(ids(next)).toEqual([1, 3]);
    expect(removed.map((r) => r.index)).toEqual([1, 3]);
    expect(ids(restoreRemovedRows(next, removed))).toEqual([1, 2, 3, 4]);
  });
});

const col = (columnId: string): IColumnDef<Row> => ({ columnId, name: columnId });
const leafIds = (cols: (IColumnDef<Row> | IColumnGroupDef<Row>)[]) => flattenColumns(cols).map((c) => c.columnId);

describe('column structure helpers', () => {
  it('insertColumnAt places a column at a flat index in a flat list', () => {
    const cols = [col('a'), col('b')];
    expect(leafIds(insertColumnAt(cols, 1, col('x')))).toEqual(['a', 'x', 'b']);
    expect(leafIds(insertColumnAt(cols, 2, col('x')))).toEqual(['a', 'b', 'x']);
  });

  it('insertColumnAt joins the group of the column it goes before, or of the last leaf', () => {
    const tree: (IColumnDef<Row> | IColumnGroupDef<Row>)[] = [col('a'), { headerName: 'G', children: [col('b'), col('c')] }];
    const inGroup = insertColumnAt(tree, 2, col('x'));
    expect(leafIds(inGroup)).toEqual(['a', 'b', 'x', 'c']);
    expect((inGroup[1] as IColumnGroupDef<Row>).children).toHaveLength(3);
    const atEnd = insertColumnAt(tree, 3, col('y'));
    expect((atEnd[1] as IColumnGroupDef<Row>).children.map((c) => (c as IColumnDef<Row>).columnId)).toEqual(['b', 'c', 'y']);
    expect(countLeafColumns(tree)).toBe(3);
  });

  it('removeColumnById reports the flat index and drops emptied groups', () => {
    const tree: (IColumnDef<Row> | IColumnGroupDef<Row>)[] = [col('a'), { headerName: 'G', children: [col('b')] }, col('c')];
    const result = removeColumnById(tree, 'b');
    expect(result?.index).toBe(1);
    expect(result?.columns).toHaveLength(2);
    expect(leafIds(result?.columns ?? [])).toEqual(['a', 'c']);
    expect(removeColumnById(tree, 'zzz')).toBeNull();
  });

  it('createStructureColumn picks the first free columnN id', () => {
    expect(createStructureColumn(['column1', 'column3'])).toEqual({ columnId: 'column2', name: 'Column 2', editable: true });
  });
});

describe('structure menu items', () => {
  it('labels count the selected rows and columns', () => {
    const labels = getStructureMenuItems({ rowCount: 2, columnCount: 1 }).map((i) => i.label);
    expect(labels).toEqual([
      'Insert 2 rows above', 'Insert 2 rows below', 'Delete 2 rows',
      'Insert column left', 'Insert column right', 'Delete column',
    ]);
  });

  it('omits row inserts when rows cannot be created, and sections with no count', () => {
    const items = getStructureMenuItems({ rowCount: 1, columnCount: 0, canInsertRows: false });
    expect(items.map((i) => i.id)).toEqual(['deleteRows']);
    expect(items[0]?.dividerBefore).toBe(true);
  });

  it('the column header menu adds column items only with canEditStructure', () => {
    const base = { canPinLeft: true, canPinRight: true, canUnpin: false };
    expect(getColumnHeaderMenuItems(base).some((i) => i.id === 'deleteColumn')).toBe(false);
    const items = getColumnHeaderMenuItems({ ...base, canEditStructure: true });
    expect(items.slice(-3).map((i) => i.id)).toEqual(['insertColumnLeft', 'insertColumnRight', 'deleteColumn']);
    expect(items[items.length - 4]?.divider).toBe(true);
  });
});

describe('remapMergedCells', () => {
  const merge = { rowId: 2, columnId: 'a', rowSpan: 2, colSpan: 2 };

  it('grows a merge when a row is inserted inside it, not at its edges', () => {
    expect(remapMergedCells([merge], 'row', [1, 2, 3, 4], [1, 2, 9, 3, 4])).toEqual([{ ...merge, rowSpan: 3 }]);
    expect(remapMergedCells([merge], 'row', [1, 2, 3, 4], [1, 9, 2, 3, 4])).toEqual([merge]);
  });

  it('moves the anchor to the next row when the anchor row is deleted, and shrinks', () => {
    expect(remapMergedCells([merge], 'row', [1, 2, 3, 4], [1, 3, 4])).toEqual([{ ...merge, rowId: 3, rowSpan: 1 }]);
  });

  it('drops a merge left as a single cell or with nothing left', () => {
    const tall = { rowId: 2, columnId: 'a', rowSpan: 2 };
    expect(remapMergedCells([tall], 'row', [1, 2, 3], [1, 3])).toEqual([]);
    expect(remapMergedCells([tall], 'row', [1, 2, 3], [1])).toEqual([]);
  });

  it('remaps column spans over leaf column ids', () => {
    const wide = { rowId: 1, columnId: 'b', colSpan: 2 };
    expect(remapMergedCells([wide], 'col', ['a', 'b', 'c'], ['a', 'b', 'x', 'c'])).toEqual([{ ...wide, colSpan: 3 }]);
    expect(remapMergedCells([wide], 'col', ['a', 'b', 'c'], ['a', 'c'])).toEqual([]);
  });

  it('leaves merges whose anchor is not in the order untouched', () => {
    const other = { rowId: 99, columnId: 'a', rowSpan: 2 };
    expect(remapMergedCells([other], 'row', [1, 2], [2])).toEqual([other]);
  });
});
