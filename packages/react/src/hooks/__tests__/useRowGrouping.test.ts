import { renderHook, act } from '@testing-library/react';
import { useRowGrouping } from '../useRowGrouping';
import type { IColumnDef } from '../../types';
import { isGroupHeader } from '@alaarab/ogrid-core';

interface Employee {
  id: number;
  name: string;
  department: string;
}

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'department', name: 'Department' },
];

const items: Employee[] = [
  { id: 1, name: 'Alice', department: 'Engineering' },
  { id: 2, name: 'Bob', department: 'Engineering' },
  { id: 3, name: 'Charlie', department: 'Marketing' },
  { id: 4, name: 'Dave', department: 'Sales' },
];

describe('useRowGrouping', () => {
  it('groups items by a column and returns group headers in displayRows', () => {
    const { result } = renderHook(() =>
      useRowGrouping({ items, columns, groupBy: ['department'] }),
    );

    expect(result.current.isGroupingActive).toBe(true);
    expect(result.current.groupTree.length).toBe(3);

    // displayRows should contain group headers
    const headers = result.current.displayRows.filter((r) => isGroupHeader(r));
    expect(headers.length).toBe(3);
  });

  it('toggleGroup collapses a group (removes its items from displayRows)', () => {
    const { result } = renderHook(() =>
      useRowGrouping({ items, columns, groupBy: ['department'] }),
    );

    // Find the Engineering group key
    const engGroup = result.current.groupTree.find((g) => g.displayText === 'Engineering');
    expect(engGroup).toBeTruthy();

    // First, expand all to get a known state
    act(() => {
      result.current.expandAll();
    });

    const beforeCount = result.current.displayRows.length;
    // 3 headers + 4 items = 7
    expect(beforeCount).toBe(7);

    // Collapse Engineering (removes its 2 items)
    act(() => {
      result.current.toggleGroup(engGroup!.groupKey);
    });

    expect(result.current.displayRows.length).toBe(5);
  });

  it('empty groupBy returns items as-is', () => {
    const { result } = renderHook(() =>
      useRowGrouping({ items, columns, groupBy: [] }),
    );

    expect(result.current.isGroupingActive).toBe(false);
    expect(result.current.displayRows).toEqual(items);
    expect(result.current.groupTree.length).toBe(0);
  });

  it('collapseAll removes all items, expandAll shows them', () => {
    const { result } = renderHook(() =>
      useRowGrouping({ items, columns, groupBy: ['department'] }),
    );

    // Collapse all
    act(() => {
      result.current.collapseAll();
    });
    // Only group headers should remain
    const afterCollapse = result.current.displayRows.filter((r) => !isGroupHeader(r));
    expect(afterCollapse.length).toBe(0);

    // Expand all
    act(() => {
      result.current.expandAll();
    });
    // All items should be visible
    const afterExpand = result.current.displayRows.filter((r) => !isGroupHeader(r));
    expect(afterExpand.length).toBe(4);
  });
});
