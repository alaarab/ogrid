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
  sortDirection: 'asc' as const,
  onColumnSort: jest.fn(),
  visibleColumns: new Set(['id', 'name', 'score']),
  filters: {},
  onFilterChange: jest.fn(),
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
    expect(state.layout.flatColumns).toHaveLength(3);
    expect(state.layout.visibleCols).toHaveLength(3);
    expect(state.layout.visibleColumnCount).toBe(3);
    expect(state.layout.hasCheckboxCol).toBe(false);
    expect(state.layout.colOffset).toBe(0);
    expect(state.layout.totalColCount).toBe(3);
    expect(state.layout.rowIndexByRowId).toBeInstanceOf(Map);
    expect(state.layout.rowIndexByRowId.get('1')).toBe(0);
    expect(state.layout.rowIndexByRowId.get('2')).toBe(1);

    // Row selection
    expect(state.rowSelection.selectedRowIds).toBeInstanceOf(Set);
    expect(typeof state.rowSelection.updateSelection).toBe('function');
    expect(typeof state.rowSelection.handleRowCheckboxChange).toBe('function');
    expect(typeof state.rowSelection.handleSelectAll).toBe('function');
    expect(state.rowSelection.allSelected).toBe(false);
    expect(state.rowSelection.someSelected).toBe(false);

    // Cell editing
    expect(state.editing.editingCell).toBeNull();
    expect(typeof state.editing.setEditingCell).toBe('function');
    expect(typeof state.editing.setPendingEditorValue).toBe('function');

    // Active cell & selection range
    expect(state.interaction.activeCell).toBeNull();
    expect(typeof state.interaction.setActiveCell).toBe('function');
    expect(state.interaction.selectionRange).toBeNull();
    expect(typeof state.interaction.setSelectionRange).toBe('function');
    expect(typeof state.interaction.handleCellMouseDown).toBe('function');
    expect(typeof state.interaction.handleSelectAllCells).toBe('function');

    // Context menu
    expect(state.contextMenu.menuPosition).toBeNull();
    expect(typeof state.contextMenu.setMenuPosition).toBe('function');
    expect(typeof state.contextMenu.handleCellContextMenu).toBe('function');
    expect(typeof state.contextMenu.closeContextMenu).toBe('function');

    // Clipboard
    expect(typeof state.interaction.handleCopy).toBe('function');
    expect(typeof state.interaction.handleCut).toBe('function');
    expect(typeof state.interaction.handlePaste).toBe('function');
    expect(state.interaction.cutRange).toBeNull();

    // Keyboard & fill handle
    expect(typeof state.interaction.handleGridKeyDown).toBe('function');
    expect(typeof state.interaction.handleFillHandleMouseDown).toBe('function');

    // Container & sizing
    expect(typeof state.layout.containerWidth).toBe('number');
    expect(typeof state.layout.minTableWidth).toBe('number');
    expect(state.layout.columnSizingOverrides).toEqual({});
    expect(typeof state.layout.setColumnSizingOverrides).toBe('function');

    // Status bar & empty
    expect(state.viewModels.statusBarConfig).toBeNull();
    expect(state.viewModels.showEmptyInGrid).toBe(false);
    expect(state.interaction.hasCellSelection).toBe(false);
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

    expect(result.current.layout.visibleCols.map((c) => c.columnId)).toEqual(['id', 'score', 'name']);
  });

  it('returns statusBarConfig null when statusBar is undefined', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );
    expect(result.current.viewModels.statusBarConfig).toBeNull();
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

    expect(result.current.viewModels.statusBarConfig).toEqual({
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

    expect(result.current.viewModels.showEmptyInGrid).toBe(true);
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

    expect(result.current.layout.hasCheckboxCol).toBe(true);
    expect(result.current.layout.colOffset).toBe(1);
    expect(result.current.layout.totalColCount).toBe(4); // 3 data + 1 checkbox
  });

  it('setSelectionRange updates selectionRange', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.interaction.selectionRange).toBeNull();

    act(() => {
      result.current.interaction.setSelectionRange({
        startRow: 0,
        startCol: 0,
        endRow: 1,
        endCol: 1,
      });
    });

    expect(result.current.interaction.selectionRange).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });
    expect(result.current.interaction.hasCellSelection).toBe(true);
  });

  it('setActiveCell updates activeCell and hasCellSelection', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.interaction.activeCell).toBeNull();
    expect(result.current.interaction.hasCellSelection).toBe(false);

    act(() => {
      result.current.interaction.setActiveCell({ rowIndex: 0, columnIndex: 1 });
    });

    expect(result.current.interaction.activeCell).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(result.current.interaction.hasCellSelection).toBe(true);
  });

  it('closeContextMenu clears contextMenu', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    act(() => {
      result.current.contextMenu.setMenuPosition({ x: 100, y: 200 });
    });
    expect(result.current.contextMenu.menuPosition).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.contextMenu.closeContextMenu();
    });
    expect(result.current.contextMenu.menuPosition).toBeNull();
  });
});
