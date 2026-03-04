import type { IColumnDef } from '../types/columnTypes';
import type { IRowGroup, RowGroupingDisplayRow } from '../types/groupingTypes';
import { getCellValue } from './cellValue';

export function isGroupHeader<T>(
  row: RowGroupingDisplayRow<T>,
): row is { __ogridGroupHeader: true; group: IRowGroup<T> } {
  return (
    row !== null &&
    typeof row === 'object' &&
    '__ogridGroupHeader' in row &&
    (row as { __ogridGroupHeader: unknown }).__ogridGroupHeader === true
  );
}

export function getGroupKey(columnId: string, value: unknown): string {
  return `${columnId}::${String(value ?? '')}`;
}

function formatGroupValue<T>(value: unknown, column: IColumnDef<T> | undefined, dummyItem: T): string {
  if (value === null || value === undefined || value === '') return '(blank)';
  if (column?.valueFormatter) return column.valueFormatter(value, dummyItem);
  return String(value);
}

function buildGroupTree<T>(
  items: T[],
  columns: IColumnDef<T>[],
  groupByColumnIds: string[],
  depth: number,
  parentKeyPrefix: string,
): IRowGroup<T>[] {
  if (groupByColumnIds.length === 0 || items.length === 0) return [];

  const columnId = groupByColumnIds[0];
  const remainingIds = groupByColumnIds.slice(1);
  const column = columns.find((c) => c.columnId === columnId);

  // Group items by value
  const buckets = new Map<string, { value: unknown; rows: T[] }>();
  const bucketOrder: string[] = [];

  for (const item of items) {
    const raw = column ? getCellValue(item, column) : (item as Record<string, unknown>)[columnId];
    const key = getGroupKey(columnId, raw);
    const fullKey = parentKeyPrefix ? `${parentKeyPrefix}>${key}` : key;

    let bucket = buckets.get(fullKey);
    if (!bucket) {
      bucket = { value: raw, rows: [] };
      buckets.set(fullKey, bucket);
      bucketOrder.push(fullKey);
    }
    bucket.rows.push(item);
  }

  return bucketOrder.map((fullKey) => {
    const bucket = buckets.get(fullKey)!;
    const subGroups =
      remainingIds.length > 0
        ? buildGroupTree(bucket.rows, columns, remainingIds, depth + 1, fullKey)
        : undefined;

    const itemCount = subGroups
      ? subGroups.reduce((sum, sg) => sum + sg.itemCount, 0)
      : bucket.rows.length;

    return {
      groupKey: fullKey,
      groupValue: bucket.value,
      columnId,
      displayText: formatGroupValue(bucket.value, column, bucket.rows[0]),
      items: bucket.rows,
      itemCount,
      subGroups,
      depth,
    };
  });
}

function flattenGroupTree<T>(
  groups: IRowGroup<T>[],
  expandedGroups: Set<string>,
): RowGroupingDisplayRow<T>[] {
  const result: RowGroupingDisplayRow<T>[] = [];

  for (const group of groups) {
    result.push({ __ogridGroupHeader: true, group });

    if (!expandedGroups.has(group.groupKey)) continue;

    if (group.subGroups && group.subGroups.length > 0) {
      result.push(...flattenGroupTree(group.subGroups, expandedGroups));
    } else {
      result.push(...group.items);
    }
  }

  return result;
}

export function buildGroupedRows<T>(
  items: T[],
  columns: IColumnDef<T>[],
  groupByColumnIds: string[],
  expandedGroups: Set<string>,
): { displayRows: RowGroupingDisplayRow<T>[]; groupTree: IRowGroup<T>[] } {
  if (groupByColumnIds.length === 0) {
    return { displayRows: items, groupTree: [] };
  }

  const groupTree = buildGroupTree(items, columns, groupByColumnIds, 0, '');
  const displayRows = flattenGroupTree(groupTree, expandedGroups);

  return { displayRows, groupTree };
}
