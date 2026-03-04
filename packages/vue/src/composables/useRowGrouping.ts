import { ref, computed, watch, type Ref } from 'vue';
import { buildGroupedRows, isGroupHeader, flattenColumns } from '@alaarab/ogrid-core';
import type { IRowGroup, RowGroupingDisplayRow } from '@alaarab/ogrid-core';
import type { IColumnDef, IColumnGroupDef } from '../types';

function collectAllGroupKeys<T>(groups: IRowGroup<T>[]): string[] {
  const keys: string[] = [];
  for (const g of groups) {
    keys.push(g.groupKey);
    if (g.subGroups) {
      keys.push(...collectAllGroupKeys(g.subGroups));
    }
  }
  return keys;
}

export interface UseRowGroupingParams<T> {
  items: Ref<T[]>;
  columns: Ref<(IColumnDef<T> | IColumnGroupDef<T>)[]>;
  groupBy: Ref<string[] | undefined>;
}

export interface UseRowGroupingResult<T> {
  displayRows: Ref<RowGroupingDisplayRow<T>[]>;
  groupTree: Ref<IRowGroup<T>[]>;
  expandedGroups: Ref<Set<string>>;
  toggleGroup: (groupKey: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isGroupingActive: Ref<boolean>;
}

export function useRowGrouping<T>({
  items,
  columns,
  groupBy,
}: UseRowGroupingParams<T>): UseRowGroupingResult<T> {
  const expandedGroups = ref<Set<string>>(new Set()) as Ref<Set<string>>;

  const flatCols = computed(
    () => flattenColumns(columns.value as IColumnDef<T>[]) as IColumnDef<T>[],
  );

  const isGroupingActive = computed(() => !!groupBy.value && groupBy.value.length > 0);

  const groupTree = computed(() => {
    if (!isGroupingActive.value) return [];
    const { groupTree: tree } = buildGroupedRows(items.value, flatCols.value, groupBy.value!, new Set());
    return tree;
  });

  // Auto-expand top-level groups when groupBy changes
  watch(
    () => groupBy.value?.join(',') ?? '',
    (key, prevKey) => {
      if (key === prevKey) return;
      if (isGroupingActive.value) {
        const topKeys = new Set(groupTree.value.map((g) => g.groupKey));
        expandedGroups.value = topKeys;
      } else {
        expandedGroups.value = new Set();
      }
    },
  );

  const displayRows = computed<RowGroupingDisplayRow<T>[]>(() => {
    if (!isGroupingActive.value) return items.value;
    const { displayRows: rows } = buildGroupedRows(items.value, flatCols.value, groupBy.value!, expandedGroups.value);
    return rows;
  });

  const toggleGroup = (groupKey: string) => {
    const next = new Set(expandedGroups.value);
    if (next.has(groupKey)) {
      next.delete(groupKey);
    } else {
      next.add(groupKey);
    }
    expandedGroups.value = next;
  };

  const expandAll = () => {
    const allKeys = collectAllGroupKeys(groupTree.value);
    expandedGroups.value = new Set(allKeys);
  };

  const collapseAll = () => {
    expandedGroups.value = new Set();
  };

  return {
    displayRows,
    groupTree,
    expandedGroups,
    toggleGroup,
    expandAll,
    collapseAll,
    isGroupingActive,
  };
}
