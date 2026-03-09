import * as React from 'react';
import { renderHook, act, render } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IOGridProps, IOGridApi } from '../../types';

type Row = { id: string; name: string };
const columns = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
];
const getRowId = (r: Row) => r.id;
const data: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
];

describe('useOGrid', () => {
  it('returns dataGridProps with items and displayTotalCount (client-side)', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 10 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.dataGridProps.items).toEqual(data);
    expect(result.current.dataGridProps.items).toHaveLength(3);
    expect(result.current.pagination.displayTotalCount).toBe(3);
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.pagination.pageSize).toBe(10);
  });

  it('paginates items when pageSize is smaller than data length', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 2 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.dataGridProps.items).toHaveLength(2);
    expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    expect(result.current.pagination.displayTotalCount).toBe(3);
  });

  it('setPage changes page and dataGridProps.items slice', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 2 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    act(() => {
      result.current.pagination.setPage(2);
    });
    expect(result.current.pagination.page).toBe(2);
    expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Carol']);
  });

  it('handleVisibilityChange hides/shows columns', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 10 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
    act(() => {
      result.current.columnChooser.onVisibilityChange('name', false);
    });
    expect(result.current.columnChooser.visibleColumns.has('name')).toBe(false);
    act(() => {
      result.current.columnChooser.onVisibilityChange('name', true);
    });
    expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
  });

  it('getColumnState returns visibleColumns array and sort (via ref)', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
          defaultSortBy: 'name',
          defaultSortDirection: 'desc',
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);
    expect(ref.current).not.toBeNull();
    const state = ref.current!.getColumnState();
    expect(Array.isArray(state.visibleColumns)).toBe(true);
    expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
  });

  it('setRowData updates internal data (client-side)', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>({ columns, getRowId, data: [], defaultPageSize: 10 }, ref);
      return null;
    };
    render(<Wrapper />);
    expect(ref.current).not.toBeNull();
    const newData: Row[] = [{ id: 'x', name: 'X' }];
    act(() => {
      ref.current!.setRowData(newData);
    });
    const state = ref.current!.getColumnState();
    expect(state.visibleColumns).toBeDefined();
  });

  it('columnChooserColumns has one entry per column', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.columnChooser.columns).toHaveLength(2);
    expect(result.current.columnChooser.columns.map((c) => c.columnId)).toEqual(['id', 'name']);
  });

  // --- Column State Persistence API ---

  it('getColumnState includes filters when present', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const filterColumns = [
      { columnId: 'id', name: 'ID', filterable: { type: 'text' as const } },
      { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
    ];
    const Wrapper = () => {
      useOGrid<Row>(
        { columns: filterColumns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);
    // Initially no filters
    const state1 = ref.current!.getColumnState();
    expect(state1.filters).toBeUndefined();

    // Set a filter via setFilterModel
    act(() => {
      ref.current!.setFilterModel({ name: { type: 'text', value: 'Alice' } });
    });
    const state2 = ref.current!.getColumnState();
    expect(state2.filters).toEqual({ name: { type: 'text', value: 'Alice' } });
  });

  it('getColumnState omits columnWidths when none set', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);
    const state = ref.current!.getColumnState();
    expect(state.columnWidths).toBeUndefined();
  });

  it('applyColumnState restores visibility, sort, and filters', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.applyColumnState({
        visibleColumns: ['id'],
        sort: { field: 'id', direction: 'desc' },
        filters: { id: { type: 'text', value: '1' } },
      });
    });

    const state = ref.current!.getColumnState();
    expect(state.visibleColumns).toEqual(['id']);
    expect(state.sort).toEqual({ field: 'id', direction: 'desc' });
    expect(state.filters).toEqual({ id: { type: 'text', value: '1' } });
  });

  it('applyColumnState restores columnWidths', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.applyColumnState({
        columnWidths: { id: 200, name: 300 },
      });
    });

    const state = ref.current!.getColumnState();
    expect(state.columnWidths).toEqual({ id: 200, name: 300 });
  });

  it('applyColumnState round-trips: apply then get returns same state', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    const stateToApply = {
      visibleColumns: ['name'],
      sort: { field: 'name', direction: 'asc' as const },
      columnWidths: { name: 250 },
      filters: { name: { type: 'text' as const, value: 'Bob' } },
    };

    act(() => {
      ref.current!.applyColumnState(stateToApply);
    });

    const restored = ref.current!.getColumnState();
    expect(restored.visibleColumns).toEqual(['name']);
    expect(restored.sort).toEqual({ field: 'name', direction: 'asc' });
    expect(restored.columnWidths).toEqual({ name: 250 });
    expect(restored.filters).toEqual({ name: { type: 'text', value: 'Bob' } });
  });

  it('applyColumnState with partial state only changes specified fields', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
          defaultSortBy: 'name',
          defaultSortDirection: 'desc',
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    const before = ref.current!.getColumnState();
    expect(before.sort).toEqual({ field: 'name', direction: 'desc' });
    expect(before.visibleColumns).toContain('id');
    expect(before.visibleColumns).toContain('name');

    // Only change filters  -  visibility and sort should remain
    act(() => {
      ref.current!.applyColumnState({ filters: { id: { type: 'text', value: '2' } } });
    });

    const after = ref.current!.getColumnState();
    expect(after.sort).toEqual({ field: 'name', direction: 'desc' });
    expect(after.visibleColumns).toContain('id');
    expect(after.visibleColumns).toContain('name');
    expect(after.filters).toEqual({ id: { type: 'text', value: '2' } });
  });

  it('applyColumnState calls onColumnOrderChange when columnOrder is provided', () => {
    const onColumnOrderChange = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
          onColumnOrderChange,
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.applyColumnState({ columnOrder: ['name', 'id'] });
    });

    expect(onColumnOrderChange).toHaveBeenCalledWith(['name', 'id']);
  });

  it('applyColumnState stores columnOrder internally when uncontrolled', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.applyColumnState({ columnOrder: ['name', 'id'] });
    });

    expect(ref.current!.getColumnState().columnOrder).toEqual(['name', 'id']);
    expect(ref.current!.getColumnOrder()).toEqual(['name', 'id']);
  });

  it('getColumnState includes columnOrder when provided via props', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
          columnOrder: ['name', 'id'],
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);
    const state = ref.current!.getColumnState();
    expect(state.columnOrder).toEqual(['name', 'id']);
  });

  it('setColumnOrder stores columnOrder internally when uncontrolled', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.setColumnOrder(['name', 'id']);
    });

    expect(ref.current!.getColumnOrder()).toEqual(['name', 'id']);
    expect(ref.current!.getColumnState().columnOrder).toEqual(['name', 'id']);
  });

  it('onColumnResized callback is fired through dataGridProps', () => {
    const onColumnResized = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () =>
        useOGrid<Row>(
          { columns, getRowId, data, defaultPageSize: 10, onColumnResized },
          ref
        ),
      { wrapper: ({ children }) => <>{children}</> }
    );

    // Simulate a column resize via the dataGridProps callback
    act(() => {
      result.current.dataGridProps.onColumnResized?.('id', 200);
    });

    expect(onColumnResized).toHaveBeenCalledWith('id', 200);
    // Width should be stored internally and reflected in getColumnState
    const state = ref.current!.getColumnState();
    expect(state.columnWidths).toEqual({ id: 200 });
  });

  // --- onFirstDataRendered ---

  it('fires onFirstDataRendered once when grid first has data', () => {
    const onFirstDataRendered = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    renderHook(
      () =>
        useOGrid<Row>(
          { columns, getRowId, data, defaultPageSize: 10, onFirstDataRendered },
          ref
        ),
      { wrapper: ({ children }) => <>{children}</> }
    );

    expect(onFirstDataRendered).toHaveBeenCalledTimes(1);
  });

  it('does not fire onFirstDataRendered when data is empty', () => {
    const onFirstDataRendered = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    renderHook(
      () =>
        useOGrid<Row>(
          { columns, getRowId, data: [], defaultPageSize: 10, onFirstDataRendered },
          ref
        ),
      { wrapper: ({ children }) => <>{children}</> }
    );

    expect(onFirstDataRendered).not.toHaveBeenCalled();
  });

  it('fires onFirstDataRendered only once even if data changes', () => {
    const onFirstDataRendered = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    const { rerender } = renderHook(
      ({ d }: { d: Row[] }) =>
        useOGrid<Row>(
          { columns, getRowId, data: d, defaultPageSize: 10, onFirstDataRendered },
          ref
        ),
      {
        wrapper: ({ children }) => <>{children}</>,
        initialProps: { d: data },
      }
    );

    expect(onFirstDataRendered).toHaveBeenCalledTimes(1);

    // Re-render with different data  -  should NOT fire again
    rerender({ d: [...data, { id: '4', name: 'Dave' }] });
    expect(onFirstDataRendered).toHaveBeenCalledTimes(1);
  });

  // --- onColumnPinned callback ---

  it('onColumnPinned callback is fired through dataGridProps', () => {
    const onColumnPinned = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () =>
        useOGrid<Row>(
          { columns, getRowId, data, defaultPageSize: 10, onColumnPinned },
          ref
        ),
      { wrapper: ({ children }) => <>{children}</> }
    );

    act(() => {
      result.current.dataGridProps.onColumnPinned?.('id', 'left');
    });

    expect(onColumnPinned).toHaveBeenCalledWith('id', 'left');
  });

  it('onColumnPinned stores pin state in getColumnState', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () =>
        useOGrid<Row>(
          { columns, getRowId, data, defaultPageSize: 10 },
          ref
        ),
      { wrapper: ({ children }) => <>{children}</> }
    );

    // Initially no pinned columns
    expect(ref.current!.getColumnState().pinnedColumns).toBeUndefined();

    // Pin a column
    act(() => {
      result.current.dataGridProps.onColumnPinned?.('id', 'left');
    });

    expect(ref.current!.getColumnState().pinnedColumns).toEqual({ id: 'left' });

    // Unpin it
    act(() => {
      result.current.dataGridProps.onColumnPinned?.('id', null);
    });

    expect(ref.current!.getColumnState().pinnedColumns).toBeUndefined();
  });

  it('applyColumnState restores pinnedColumns', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.applyColumnState({
        pinnedColumns: { id: 'left', name: 'right' },
      });
    });

    const state = ref.current!.getColumnState();
    expect(state.pinnedColumns).toEqual({ id: 'left', name: 'right' });
  });

  it('applyColumnState round-trips pinnedColumns', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    const stateToApply = {
      visibleColumns: ['id', 'name'],
      pinnedColumns: { id: 'left' as const },
      columnWidths: { id: 150 },
    };

    act(() => {
      ref.current!.applyColumnState(stateToApply);
    });

    const restored = ref.current!.getColumnState();
    expect(restored.pinnedColumns).toEqual({ id: 'left' });
    expect(restored.columnWidths).toEqual({ id: 150 });
  });

  it('pinnedColumns override is passed to dataGridProps', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () =>
        useOGrid<Row>(
          { columns, getRowId, data, defaultPageSize: 10 },
          ref
        ),
      { wrapper: ({ children }) => <>{children}</> }
    );

    // Initially empty
    expect(result.current.dataGridProps.pinnedColumns).toEqual({});

    // Pin a column
    act(() => {
      result.current.dataGridProps.onColumnPinned?.('name', 'right');
    });

    expect(result.current.dataGridProps.pinnedColumns).toEqual({ name: 'right' });
  });

  // --- Date column type ---

  // --- New IOGridApi methods ---

  it('clearFilters removes all filters', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    // Set a filter first
    act(() => {
      ref.current!.setFilterModel({ name: { type: 'text', value: 'Alice' } });
    });
    expect(ref.current!.getColumnState().filters).toBeDefined();

    // Clear all filters
    act(() => {
      ref.current!.clearFilters();
    });
    expect(ref.current!.getColumnState().filters).toBeUndefined();
  });

  it('clearSort resets to default sort', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10, defaultSortBy: 'id', defaultSortDirection: 'asc' },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    // Change sort
    act(() => {
      ref.current!.applyColumnState({ sort: { field: 'name', direction: 'desc' } });
    });
    expect(ref.current!.getColumnState().sort).toEqual({ field: 'name', direction: 'desc' });

    // Clear sort
    act(() => {
      ref.current!.clearSort();
    });
    expect(ref.current!.getColumnState().sort).toEqual({ field: 'id', direction: 'asc' });
  });

  it('resetGridState clears filters, sort, and selection', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10, defaultSortBy: 'id' },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    // Set some state
    act(() => {
      ref.current!.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      ref.current!.applyColumnState({ sort: { field: 'name', direction: 'desc' } });
      ref.current!.setSelectedRows(['1', '2']);
    });

    // Reset everything
    act(() => {
      ref.current!.resetGridState();
    });

    const state = ref.current!.getColumnState();
    expect(state.filters).toBeUndefined();
    expect(state.sort).toEqual({ field: 'id', direction: 'asc' });
    expect(ref.current!.getSelectedRows()).toEqual([]);
  });

  it('resetGridState with keepSelection preserves selection', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 10, defaultSortBy: 'id' },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    act(() => {
      ref.current!.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      ref.current!.setSelectedRows(['1']);
    });

    act(() => {
      ref.current!.resetGridState({ keepSelection: true });
    });

    expect(ref.current!.getColumnState().filters).toBeUndefined();
    expect(ref.current!.getSelectedRows()).toEqual(['1']);
  });

  it('getDisplayedRows returns current page items', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        { columns, getRowId, data, defaultPageSize: 2 },
        ref
      );
      return null;
    };
    render(<Wrapper />);

    const rows = ref.current!.getDisplayedRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  describe('date column filtering and sorting', () => {
    type DateRow = { id: string; date: string };
    const dateColumns = [
      { columnId: 'id', name: 'ID' },
      { columnId: 'date', name: 'Date', type: 'date' as const, filterable: { type: 'date' as const } },
    ];
    const dateData: DateRow[] = [
      { id: '1', date: '2024-01-15' },
      { id: '2', date: '2024-06-20' },
      { id: '3', date: '2024-03-10' },
      { id: '4', date: '2024-12-01' },
    ];
    const getDateRowId = (r: DateRow) => r.id;

    it('filters rows by date range (from only)', () => {
      const ref = React.createRef<IOGridApi<DateRow>>();
      const { result } = renderHook(
        () =>
          useOGrid<DateRow>(
            {
              columns: dateColumns,
              getRowId: getDateRowId,
              data: dateData,
              defaultPageSize: 10,
              filters: { date: { type: 'date', value: { from: '2024-06-01' } } },
            },
            ref
          ),
        { wrapper: ({ children }) => <>{children}</> }
      );
      expect(result.current.dataGridProps.items.map((r) => r.id)).toEqual(['2', '4']);
    });

    it('filters rows by date range (to only)', () => {
      const ref = React.createRef<IOGridApi<DateRow>>();
      const { result } = renderHook(
        () =>
          useOGrid<DateRow>(
            {
              columns: dateColumns,
              getRowId: getDateRowId,
              data: dateData,
              defaultPageSize: 10,
              filters: { date: { type: 'date', value: { to: '2024-03-10' } } },
            },
            ref
          ),
        { wrapper: ({ children }) => <>{children}</> }
      );
      expect(result.current.dataGridProps.items.map((r) => r.id)).toEqual(['1', '3']);
    });

    it('filters rows by date range (from and to)', () => {
      const ref = React.createRef<IOGridApi<DateRow>>();
      const { result } = renderHook(
        () =>
          useOGrid<DateRow>(
            {
              columns: dateColumns,
              getRowId: getDateRowId,
              data: dateData,
              defaultPageSize: 10,
              filters: { date: { type: 'date', value: { from: '2024-02-01', to: '2024-07-01' } } },
            },
            ref
          ),
        { wrapper: ({ children }) => <>{children}</> }
      );
      expect(result.current.dataGridProps.items.map((r) => r.id)).toEqual(['2', '3']);
    });

    it('sorts date columns chronologically', () => {
      const ref = React.createRef<IOGridApi<DateRow>>();
      const { result } = renderHook(
        () =>
          useOGrid<DateRow>(
            {
              columns: dateColumns,
              getRowId: getDateRowId,
              data: dateData,
              defaultPageSize: 10,
              sort: { field: 'date', direction: 'asc' },
            },
            ref
          ),
        { wrapper: ({ children }) => <>{children}</> }
      );
      expect(result.current.dataGridProps.items.map((r) => r.date)).toEqual([
        '2024-01-15',
        '2024-03-10',
        '2024-06-20',
        '2024-12-01',
      ]);
    });

    it('sorts date columns descending', () => {
      const ref = React.createRef<IOGridApi<DateRow>>();
      const { result } = renderHook(
        () =>
          useOGrid<DateRow>(
            {
              columns: dateColumns,
              getRowId: getDateRowId,
              data: dateData,
              defaultPageSize: 10,
              sort: { field: 'date', direction: 'desc' },
            },
            ref
          ),
        { wrapper: ({ children }) => <>{children}</> }
      );
      expect(result.current.dataGridProps.items.map((r) => r.date)).toEqual([
        '2024-12-01',
        '2024-06-20',
        '2024-03-10',
        '2024-01-15',
      ]);
    });

    it('passes filters and onFilterChange to dataGridProps', () => {
      const ref = React.createRef<IOGridApi<DateRow>>();
      const { result } = renderHook(
        () =>
          useOGrid<DateRow>(
            {
              columns: dateColumns,
              getRowId: getDateRowId,
              data: dateData,
              defaultPageSize: 10,
              filters: { date: { type: 'date', value: { from: '2024-01-01', to: '2024-12-31' } } },
            },
            ref
          ),
        { wrapper: ({ children }) => <>{children}</> }
      );
      expect(result.current.dataGridProps.filters).toEqual({
        date: { type: 'date', value: { from: '2024-01-01', to: '2024-12-31' } },
      });
      expect(typeof result.current.dataGridProps.onFilterChange).toBe('function');
    });
  });
});
