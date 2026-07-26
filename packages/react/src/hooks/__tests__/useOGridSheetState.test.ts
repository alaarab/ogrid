import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IOGridApi } from '../../types';

/**
 * Sheet-scoped grid state.
 *
 * Every assertion here has the same shape: state that is keyed on one sheet's
 * column ids or row ids must not survive onto another sheet, and must come back
 * when the user returns to the sheet they set it on.
 */

type Row = { id: string; a1?: string; a2?: string; b1?: string; b2?: string; shared?: string };

const colsA = [
  { columnId: 'a1', name: 'A1', filterable: { type: 'text' as const } },
  { columnId: 'a2', name: 'A2' },
];
const colsB = [
  { columnId: 'b1', name: 'B1', pinned: 'left' as const },
  { columnId: 'b2', name: 'B2' },
];

/** 30 rows, so page 3 exists at pageSize 10. */
const dataA: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: `a${i}`,
  a1: `v${String(i).padStart(2, '0')}`,
  a2: 'x',
}));

/** 3 rows, deliberately not in b1 order so a missing sort is visible. */
const dataB: Row[] = [
  { id: 'a0', b1: 'zeta' },
  { id: 'a1', b1: 'alpha' },
  { id: 'zz', b1: 'mid' },
];

const getRowId = (r: Row) => r.id;
const sheetDefs = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
];
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

type Sheet = 'a' | 'b';

/** Two-sheet grid whose columns and rows both change with the active sheet. */
function renderWorkbook(overrides: Record<string, unknown> = {}) {
  const apiRef = React.createRef<IOGridApi<Row>>();
  const r = renderHook(
    ({ sheet }: { sheet: Sheet }) =>
      useOGrid(
        {
          columns: sheet === 'a' ? colsA : colsB,
          data: sheet === 'a' ? dataA : dataB,
          getRowId,
          defaultPageSize: 10,
          sheetDefs,
          activeSheet: sheet,
          onSheetChange: () => {},
          ...overrides,
        } as unknown as Parameters<typeof useOGrid<Row>>[0],
        apiRef
      ),
    { wrapper, initialProps: { sheet: 'a' as Sheet } }
  );
  return { ...r, apiRef };
}

describe('sheet-scoped grid state', () => {
  describe('sort', () => {
    it('sorts a first-seen sheet by its own default column, not the previous sheet\'s', () => {
      const { result, rerender } = renderWorkbook();
      expect(result.current.dataGridProps.sortBy).toBe('a1');

      rerender({ sheet: 'b' });

      expect(result.current.dataGridProps.sortBy).toBe('b1');
      expect(result.current.dataGridProps.items.map((r) => r.b1)).toEqual(['alpha', 'mid', 'zeta']);
    });

    it('restores the sort the user chose when they come back', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.dataGridProps.onColumnSort?.('a2', 'desc'));
      expect(result.current.dataGridProps.sortBy).toBe('a2');
      expect(result.current.dataGridProps.sortDirection).toBe('desc');

      rerender({ sheet: 'b' });
      expect(result.current.dataGridProps.sortBy).toBe('b1');

      rerender({ sheet: 'a' });
      expect(result.current.dataGridProps.sortBy).toBe('a2');
      expect(result.current.dataGridProps.sortDirection).toBe('desc');
    });
  });

  describe('filters', () => {
    it('does not carry a filter onto a sheet that reuses the column id', () => {
      const apiRef = React.createRef<IOGridApi<Row>>();
      // Sheet B has its own column that happens to share sheet A's id, so a
      // stale filter would actually apply  -  and match nothing.
      const collidingB = [{ columnId: 'a1', name: 'B1', filterable: { type: 'text' as const } }, ...colsB];
      const { result, rerender } = renderHook(
        ({ sheet }: { sheet: Sheet }) =>
          useOGrid(
            {
              columns: sheet === 'a' ? colsA : collidingB,
              data: sheet === 'a' ? dataA : dataB,
              getRowId,
              defaultPageSize: 10,
              sheetDefs,
              activeSheet: sheet,
              onSheetChange: () => {},
            } as unknown as Parameters<typeof useOGrid<Row>>[0],
            apiRef
          ),
        { wrapper, initialProps: { sheet: 'a' as Sheet } }
      );
      act(() => result.current.filters.setFilters({ a1: { type: 'text', value: 'v0' } }));
      expect(result.current.dataGridProps.items.length).toBeGreaterThan(0);

      rerender({ sheet: 'b' });

      expect(result.current.dataGridProps.items).toHaveLength(dataB.length);
      expect(result.current.filters.hasActiveFilters).toBe(false);
    });

    it('clears a filter whose column is gone, and restores it on return', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.filters.setFilters({ a1: { type: 'text', value: 'v0' } }));

      rerender({ sheet: 'b' });
      // The filter is unreachable on sheet B  -  there is no column to clear it
      // from  -  so it must not be reported as active either.
      expect(result.current.filters.hasActiveFilters).toBe(false);
      expect(result.current.dataGridProps.filters).toEqual({});

      rerender({ sheet: 'a' });
      expect(result.current.filters.hasActiveFilters).toBe(true);
      expect(result.current.dataGridProps.filters).toEqual({ a1: { type: 'text', value: 'v0' } });
    });
  });

  describe('pagination', () => {
    it('does not land past the end of a shorter sheet', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.pagination.setPage(3));
      expect(result.current.dataGridProps.items).toHaveLength(10);

      rerender({ sheet: 'b' });

      expect(result.current.pagination.page).toBe(1);
      expect(result.current.dataGridProps.items).toHaveLength(dataB.length);
    });

    it('restores the page the user was on when they come back', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.pagination.setPage(3));

      rerender({ sheet: 'b' });
      rerender({ sheet: 'a' });

      expect(result.current.pagination.page).toBe(3);
      expect(result.current.dataGridProps.items[0]?.id).toBe('a20');
    });
  });

  describe('row selection', () => {
    it('does not carry row ids onto a sheet with different rows', () => {
      const { result, rerender } = renderWorkbook();
      act(() =>
        result.current.dataGridProps.onSelectionChange?.({
          selectedRowIds: ['a0', 'a5'],
          selectedItems: [],
        })
      );
      expect(result.current.dataGridProps.selectedRows?.size).toBe(2);

      // Sheet B reuses the id 'a0', so a stale selection would silently
      // highlight an unrelated row and report a count for rows that don't exist.
      rerender({ sheet: 'b' });

      expect(result.current.dataGridProps.selectedRows?.size).toBe(0);
    });

    it('restores the selection on return', () => {
      const { result, rerender } = renderWorkbook();
      act(() =>
        result.current.dataGridProps.onSelectionChange?.({
          selectedRowIds: ['a0', 'a5'],
          selectedItems: [],
        })
      );

      rerender({ sheet: 'b' });
      rerender({ sheet: 'a' });

      expect([...(result.current.dataGridProps.selectedRows ?? [])]).toEqual(['a0', 'a5']);
    });
  });

  describe('column visibility', () => {
    it('restores hidden columns on return', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.columnChooser.onVisibilityChange('a2', false));
      expect([...result.current.columnChooser.visibleColumns]).toEqual(['a1']);

      rerender({ sheet: 'b' });
      expect([...result.current.columnChooser.visibleColumns].sort()).toEqual(['b1', 'b2']);

      rerender({ sheet: 'a' });
      expect([...result.current.columnChooser.visibleColumns]).toEqual(['a1']);
    });
  });

  describe('column widths', () => {
    it('does not carry a width onto another sheet, and restores it on return', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.dataGridProps.onColumnResized?.('a1', 400));
      expect(result.current.dataGridProps.initialColumnWidths).toEqual({ a1: 400 });

      rerender({ sheet: 'b' });
      expect(result.current.dataGridProps.initialColumnWidths).toEqual({});

      rerender({ sheet: 'a' });
      expect(result.current.dataGridProps.initialColumnWidths).toEqual({ a1: 400 });
    });
  });

  describe('column pinning', () => {
    it('pins the incoming sheet\'s columns from their own defs', () => {
      const { result, rerender } = renderWorkbook();
      expect(result.current.dataGridProps.pinnedColumns).toEqual({});

      rerender({ sheet: 'b' });

      expect(result.current.dataGridProps.pinnedColumns).toEqual({ b1: 'left' });
    });

    it('restores a pin the user set on return', () => {
      const { result, rerender } = renderWorkbook();
      act(() => result.current.dataGridProps.onColumnPinned?.('a1', 'right'));
      expect(result.current.dataGridProps.pinnedColumns).toEqual({ a1: 'right' });

      rerender({ sheet: 'b' });
      expect(result.current.dataGridProps.pinnedColumns).toEqual({ b1: 'left' });

      rerender({ sheet: 'a' });
      expect(result.current.dataGridProps.pinnedColumns).toEqual({ a1: 'right' });
    });
  });

  describe('column order', () => {
    it('does not carry an order onto another sheet, and restores it on return', () => {
      const { result, apiRef, rerender } = renderWorkbook();
      act(() => apiRef.current?.setColumnOrder(['a2', 'a1']));
      expect(result.current.dataGridProps.columnOrder).toEqual(['a2', 'a1']);

      rerender({ sheet: 'b' });
      expect(result.current.dataGridProps.columnOrder).toBeUndefined();

      rerender({ sheet: 'a' });
      expect(result.current.dataGridProps.columnOrder).toEqual(['a2', 'a1']);
    });
  });

  describe('reaching a sheet for the first time', () => {
    /** Everything a sheet's identity should determine, in one comparable shape. */
    function snapshot(r: ReturnType<typeof useOGrid<Row>>) {
      return {
        sortBy: r.dataGridProps.sortBy,
        sortDirection: r.dataGridProps.sortDirection,
        rows: r.dataGridProps.items.map(getRowId),
        page: r.pagination.page,
        totalCount: r.pagination.displayTotalCount,
        visibleColumns: [...r.columnChooser.visibleColumns].sort(),
        pinnedColumns: r.dataGridProps.pinnedColumns,
        columnWidths: r.dataGridProps.initialColumnWidths,
        columnOrder: r.dataGridProps.columnOrder,
        selectedRows: [...(r.dataGridProps.selectedRows ?? [])],
        filters: r.dataGridProps.filters,
        hasActiveFilters: r.filters.hasActiveFilters,
      };
    }

    it('looks exactly like mounting that sheet directly, however sheet A was left', () => {
      // Mess with every slot on sheet A first, so anything that leaks shows up.
      const { result, apiRef, rerender } = renderWorkbook();
      act(() => result.current.dataGridProps.onColumnSort?.('a2', 'desc'));
      act(() => result.current.filters.setFilters({ a1: { type: 'text', value: 'v0' } }));
      act(() => result.current.pagination.setPage(1));
      act(() => result.current.columnChooser.onVisibilityChange('a2', false));
      act(() => result.current.dataGridProps.onColumnResized?.('a1', 400));
      act(() => result.current.dataGridProps.onColumnPinned?.('a1', 'right'));
      act(() => apiRef.current?.setColumnOrder(['a2', 'a1']));
      act(() =>
        result.current.dataGridProps.onSelectionChange?.({
          selectedRowIds: ['a0', 'a5'],
          selectedItems: [],
        })
      );

      rerender({ sheet: 'b' });
      const afterSwitch = snapshot(result.current);

      // Mount straight onto B rather than switching into it.
      const direct = renderHook(
        () =>
          useOGrid(
            {
              columns: colsB,
              data: dataB,
              getRowId,
              defaultPageSize: 10,
              sheetDefs,
              activeSheet: 'b',
              onSheetChange: () => {},
            } as unknown as Parameters<typeof useOGrid<Row>>[0],
            React.createRef<IOGridApi<Row>>()
          ),
        { wrapper }
      );

      expect(afterSwitch).toEqual(snapshot(direct.result.current));
    });
  });

  describe('controlled slots', () => {
    it('leaves host-owned state alone across a switch', () => {
      const controlledFilters = { a1: { type: 'text' as const, value: 'v0' } };
      const controlledSort = { field: 'a2', direction: 'desc' as const };
      const controlledSelection = new Set(['a0']);
      const onPageChange = jest.fn();
      const { result, rerender } = renderWorkbook({
        filters: controlledFilters,
        sort: controlledSort,
        selectedRows: controlledSelection,
        page: 2,
        columnOrder: ['a2', 'a1'],
        onPageChange,
      });

      rerender({ sheet: 'b' });

      expect(result.current.dataGridProps.filters).toBe(controlledFilters);
      expect(result.current.dataGridProps.sortBy).toBe('a2');
      expect(result.current.dataGridProps.selectedRows).toBe(controlledSelection);
      expect(result.current.pagination.page).toBe(2);
      expect(result.current.dataGridProps.columnOrder).toEqual(['a2', 'a1']);
      // Page 2 is past the end of a 3-row sheet, but correcting it is the
      // host's call, not the grid's.
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('restoring is not reported as a user edit', () => {
    it('does not fire the change callbacks when a sheet is restored', () => {
      const onSortChange = jest.fn();
      const onFiltersChange = jest.fn();
      const onPageChange = jest.fn();
      const onSelectionChange = jest.fn();
      const { result, rerender } = renderWorkbook({
        onSortChange,
        onFiltersChange,
        onPageChange,
        onSelectionChange,
      });
      // A filter every row matches, so page 2 stays a real page.
      act(() => result.current.filters.setFilters({ a1: { type: 'text', value: 'v' } }));
      act(() => result.current.pagination.setPage(2));
      onSortChange.mockClear();
      onFiltersChange.mockClear();
      onPageChange.mockClear();
      onSelectionChange.mockClear();

      rerender({ sheet: 'b' });
      rerender({ sheet: 'a' });

      expect(onSortChange).not.toHaveBeenCalled();
      expect(onFiltersChange).not.toHaveBeenCalled();
      expect(onPageChange).not.toHaveBeenCalled();
      expect(onSelectionChange).not.toHaveBeenCalled();
      // The state itself did come back.
      expect(result.current.pagination.page).toBe(2);
      expect(result.current.filters.hasActiveFilters).toBe(true);
    });
  });

  describe('grids without sheets', () => {
    it('keeps filters, page and selection when the columns are swapped', () => {
      const apiRef = React.createRef<IOGridApi<Row>>();
      const { result, rerender } = renderHook(
        ({ extra }: { extra: boolean }) =>
          useOGrid(
            {
              columns: extra ? [...colsA, { columnId: 'a3', name: 'A3' }] : colsA,
              data: dataA,
              getRowId,
              defaultPageSize: 10,
            } as unknown as Parameters<typeof useOGrid<Row>>[0],
            apiRef
          ),
        { wrapper, initialProps: { extra: false } }
      );
      act(() => result.current.filters.setFilters({ a1: { type: 'text', value: 'v0' } }));
      act(() => result.current.pagination.setPage(1));
      act(() =>
        result.current.dataGridProps.onSelectionChange?.({
          selectedRowIds: ['a0'],
          selectedItems: [],
        })
      );

      rerender({ extra: true });

      expect(result.current.filters.hasActiveFilters).toBe(true);
      expect(result.current.dataGridProps.filters).toEqual({ a1: { type: 'text', value: 'v0' } });
      expect([...(result.current.dataGridProps.selectedRows ?? [])]).toEqual(['a0']);
    });
  });
});
