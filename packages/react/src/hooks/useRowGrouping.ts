import { useState, useMemo, useCallback } from 'react';
import { buildGroupedRows, isGroupHeader, flattenColumns } from '@alaarab/ogrid-core';
import type { IColumnDef, IColumnGroupDef } from '../types';
import type { IRowGroup, RowGroupingDisplayRow } from '@alaarab/ogrid-core';

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
  items: T[];
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  groupBy?: string[];
}

export interface UseRowGroupingResult<T> {
  displayRows: RowGroupingDisplayRow<T>[];
  groupTree: IRowGroup<T>[];
  expandedGroups: Set<string>;
  toggleGroup: (groupKey: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isGroupingActive: boolean;
}

export function useRowGrouping<T>({
  items,
  columns,
  groupBy,
}: UseRowGroupingParams<T>): UseRowGroupingResult<T> {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set<string>());

  const flatCols = useMemo(
    () => flattenColumns(columns as IColumnDef<T>[]) as IColumnDef<T>[],
    [columns],
  );

  const isGroupingActive = !!groupBy && groupBy.length > 0;

  // Build the group tree (without expanding) so we can auto-expand top-level on first groupBy change
  const groupTree = useMemo(() => {
    if (!isGroupingActive) return [];
    const { groupTree: tree } = buildGroupedRows(items, flatCols, groupBy!, new Set());
    return tree;
  }, [items, flatCols, groupBy, isGroupingActive]);

  // Auto-expand top-level groups when groupBy changes
  const groupByKey = groupBy?.join(',') ?? '';
  const [prevGroupByKey, setPrevGroupByKey] = useState(groupByKey);
  if (groupByKey !== prevGroupByKey) {
    setPrevGroupByKey(groupByKey);
    if (isGroupingActive) {
      const topKeys = new Set(groupTree.map((g) => g.groupKey));
      setExpandedGroups(topKeys);
    } else {
      setExpandedGroups(new Set());
    }
  }

  const displayRows = useMemo(() => {
    if (!isGroupingActive) return items as RowGroupingDisplayRow<T>[];
    const { displayRows: rows } = buildGroupedRows(items, flatCols, groupBy!, expandedGroups);
    return rows;
  }, [items, flatCols, groupBy, expandedGroups, isGroupingActive]);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allKeys = collectAllGroupKeys(groupTree);
    setExpandedGroups(new Set(allKeys));
  }, [groupTree]);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

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
