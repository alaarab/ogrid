import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useDataGridState } from '../useDataGridState';
import type { IOGridDataGridProps } from '../../types';

type Row = { id: string; name: string; score: number };

const defaultProps: IOGridDataGridProps<Row> = {
  items: [
    { id: '1', name: 'Alice', score: 10 },
    { id: '2', name: 'Bob', score: 20 },
  ],
  columns: [
    { columnId: 'id', name: 'ID' },
    { columnId: 'name', name: 'Name' },
    { columnId: 'score', name: 'Score' },
  ],
  getRowId: (r) => r.id,
  sortBy: 'name',
  sortDirection: 'asc',
  onColumnSort: jest.fn(),
  visibleColumns: new Set(['id', 'name', 'score']),
  multiSelectFilters: {},
  onMultiSelectFilterChange: jest.fn(),
  textFilters: {},
  filterOptions: {},
  loadingFilterOptions: {},
};

// ResizeObserver is not in jsdom
const mockResizeObserver = jest.fn().mockImplementation((cb: () => void) => {
  return {
    observe: jest.fn(() => {
      // Simulate initial measure
      cb();
    }),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  };
});

beforeAll(() => {
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = mockResizeObserver;
});

beforeEach(() => {
  mockResizeObserver.mockClear();
});

describe('useDataGridState', () => {
  it('returns all expected state and handlers', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    const state = result.current;

    // Columns & layout
    expect(state.flatColumns).toHaveLength(3);
    expect(state.visibleCols).toHaveLength(3);
    expect(state.visibleColumnCount).toBe(3);
    expect(state.hasCheckboxCol).toBe(false);
    expect(state.colOffset).toBe(0);
    expect(state.totalColCount).toBe(3);
    expect(state.rowIndexByRowId).toBeInstanceOf(Map);
    expect(state.rowIndexByRowId.get('1')).toBe(0);
    expect(state.rowIndexByRowId.get('2')).toBe(1);

    // Row selection
    expect(state.selectedRowIds).toBeInstanceOf(Set);
    expect(typeof state.updateSelection).toBe('function');
    expect(typeof state.handleRowCheckboxChange).toBe('function');
    expect(typeof state.handleSelectAll).toBe('function');
    expect(state.allSelected).toBe(false);
    expect(state.someSelected).toBe(false);

    // Cell editing
    expect(state.editingCell).toBeNull();
    expect(typeof state.setEditingCell).toBe('function');
    expect(typeof state.setPendingEditorValue).toBe('function');

    // Active cell & selection range
    expect(state.activeCell).toBeNull();
    expect(typeof state.setActiveCell).toBe('function');
    expect(state.selectionRange).toBeNull();
    expect(typeof state.setSelectionRange).toBe('function');
    expect(typeof state.handleCellMouseDown).toBe('function');
    expect(typeof state.handleSelectAllCells).toBe('function');

    // Context menu
    expect(state.contextMenu).toBeNull();
    expect(typeof state.setContextMenu).toBe('function');
    expect(typeof state.handleCellContextMenu).toBe('function');
    expect(typeof state.closeContextMenu).toBe('function');

    // Clipboard
    expect(typeof state.handleCopy).toBe('function');
    expect(typeof state.handleCut).toBe('function');
    expect(typeof state.handlePaste).toBe('function');
    expect(state.cutRange).toBeNull();

    // Keyboard & fill handle
    expect(typeof state.handleGridKeyDown).toBe('function');
    expect(typeof state.handleFillHandleMouseDown).toBe('function');

    // Container & sizing
    expect(typeof state.containerWidth).toBe('number');
    expect(typeof state.minTableWidth).toBe('number');
    expect(state.columnSizingOverrides).toEqual({});
    expect(typeof state.setColumnSizingOverrides).toBe('function');

    // Status bar & empty
    expect(state.statusBarConfig).toBeNull();
    expect(state.showEmptyInGrid).toBe(false);
    expect(state.hasCellSelection).toBe(false);
  });

  it('derives visibleCols from visibleColumns and columnOrder', () => {
    const propsWithOrder: IOGridDataGridProps<Row> = {
      ...defaultProps,
      visibleColumns: new Set(['score', 'name', 'id']),
      columnOrder: ['id', 'score', 'name'],
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsWithOrder, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.visibleCols.map((c) => c.columnId)).toEqual(['id', 'score', 'name']);
  });

  it('returns statusBarConfig null when statusBar is undefined', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );
    expect(result.current.statusBarConfig).toBeNull();
  });

  it('returns statusBarConfig when statusBar is object', () => {
    const propsWithStatusBar: IOGridDataGridProps<Row> = {
      ...defaultProps,
      statusBar: { totalCount: 100, filteredCount: 50, selectedCount: 2 },
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsWithStatusBar, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.statusBarConfig).toEqual({
      totalCount: 100,
      filteredCount: 50,
      selectedCount: 2,
    });
  });

  it('returns showEmptyInGrid true when items empty and emptyState provided', () => {
    const propsEmpty: IOGridDataGridProps<Row> = {
      ...defaultProps,
      items: [],
      emptyState: {
        onClearAll: jest.fn(),
        hasActiveFilters: false,
        message: 'No items',
      },
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsEmpty, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.showEmptyInGrid).toBe(true);
  });

  it('returns hasCheckboxCol and colOffset when rowSelection is multiple', () => {
    const propsMulti: IOGridDataGridProps<Row> = {
      ...defaultProps,
      rowSelection: 'multiple',
      selectedRows: new Set(),
      onSelectionChange: jest.fn(),
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsMulti, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.hasCheckboxCol).toBe(true);
    expect(result.current.colOffset).toBe(1);
    expect(result.current.totalColCount).toBe(4); // 3 data + 1 checkbox
  });

  it('setSelectionRange updates selectionRange', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.selectionRange).toBeNull();

    act(() => {
      result.current.setSelectionRange({
        startRow: 0,
        startCol: 0,
        endRow: 1,
        endCol: 1,
      });
    });

    expect(result.current.selectionRange).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });
    expect(result.current.hasCellSelection).toBe(true);
  });

  it('setActiveCell updates activeCell and hasCellSelection', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.activeCell).toBeNull();
    expect(result.current.hasCellSelection).toBe(false);

    act(() => {
      result.current.setActiveCell({ rowIndex: 0, columnIndex: 1 });
    });

    expect(result.current.activeCell).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(result.current.hasCellSelection).toBe(true);
  });

  it('closeContextMenu clears contextMenu', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    act(() => {
      result.current.setContextMenu({ x: 100, y: 200 });
    });
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.closeContextMenu();
    });
    expect(result.current.contextMenu).toBeNull();
  });
});
