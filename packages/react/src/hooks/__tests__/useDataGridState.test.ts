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

  it('hasRowNumbersCol and colOffset with showRowNumbers', () => {
    const propsWithRowNumbers: IOGridDataGridProps<Row> = {
      ...defaultProps,
      showRowNumbers: true,
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsWithRowNumbers, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.layout.hasRowNumbersCol).toBe(true);
    expect(result.current.layout.colOffset).toBe(1);
    expect(result.current.layout.totalColCount).toBe(4); // 3 data + 1 row numbers
  });

  it('colOffset is 2 when both rowSelection multiple and showRowNumbers', () => {
    const propsBoth: IOGridDataGridProps<Row> = {
      ...defaultProps,
      rowSelection: 'multiple',
      selectedRows: new Set(),
      onSelectionChange: jest.fn(),
      showRowNumbers: true,
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsBoth, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.layout.hasCheckboxCol).toBe(true);
    expect(result.current.layout.hasRowNumbersCol).toBe(true);
    expect(result.current.layout.colOffset).toBe(2);
    expect(result.current.layout.totalColCount).toBe(5); // 3 data + 1 checkbox + 1 row numbers
  });

  it('filters visibleCols by visibleColumns set', () => {
    const propsPartialVis: IOGridDataGridProps<Row> = {
      ...defaultProps,
      visibleColumns: new Set(['name', 'score']),
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsPartialVis, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.layout.visibleCols).toHaveLength(2);
    expect(result.current.layout.visibleCols.map((c) => c.columnId)).toEqual(['name', 'score']);
    expect(result.current.layout.visibleColumnCount).toBe(2);
  });

  it('setEditingCell updates editingCell', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.editing.editingCell).toBeNull();

    act(() => {
      result.current.editing.setEditingCell({ rowId: '1', columnId: 'name' });
    });

    expect(result.current.editing.editingCell).toEqual({ rowId: '1', columnId: 'name' });
  });

  it('cancelPopoverEdit clears editing state', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    act(() => {
      result.current.editing.setEditingCell({ rowId: '1', columnId: 'name' });
      result.current.editing.setPendingEditorValue('test');
    });

    expect(result.current.editing.editingCell).not.toBeNull();

    act(() => {
      result.current.editing.cancelPopoverEdit();
    });

    expect(result.current.editing.editingCell).toBeNull();
    expect(result.current.editing.popoverAnchorEl).toBeNull();
  });

  it('interaction handlers are no-ops when cellSelection is disabled', () => {
    const propsNoCell: IOGridDataGridProps<Row> = {
      ...defaultProps,
      cellSelection: false,
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsNoCell, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    // All interaction state should be null/false when cellSelection is disabled
    expect(result.current.interaction.activeCell).toBeNull();
    expect(result.current.interaction.selectionRange).toBeNull();
    expect(result.current.interaction.hasCellSelection).toBe(false);
    expect(result.current.interaction.cutRange).toBeNull();
    expect(result.current.interaction.copyRange).toBeNull();
    expect(result.current.interaction.isDragging).toBe(false);

    // Context menu should also be null
    expect(result.current.contextMenu.menuPosition).toBeNull();
  });

  it('rowIndexByRowId maps row IDs to indices', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    const map = result.current.layout.rowIndexByRowId;
    expect(map.get('1')).toBe(0);
    expect(map.get('2')).toBe(1);
    expect(map.size).toBe(2);
  });

  it('showEmptyInGrid is false when isLoading is true even with empty items', () => {
    const propsLoading: IOGridDataGridProps<Row> = {
      ...defaultProps,
      items: [],
      isLoading: true,
      emptyState: {
        onClearAll: jest.fn(),
        hasActiveFilters: false,
        message: 'No items',
      },
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsLoading, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.viewModels.showEmptyInGrid).toBe(false);
  });

  it('returns statusBarConfig with item count when statusBar has totalCount', () => {
    const propsStatusBar: IOGridDataGridProps<Row> = {
      ...defaultProps,
      statusBar: { totalCount: 2, selectedCount: 0 },
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsStatusBar, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.viewModels.statusBarConfig).not.toBeNull();
    expect(result.current.viewModels.statusBarConfig!.totalCount).toBe(2);
  });

  it('applies pinned column overrides', () => {
    const propsWithPinning: IOGridDataGridProps<Row> = {
      ...defaultProps,
      pinnedColumns: { id: 'left' },
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsWithPinning, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    // The flat column for 'id' should have pinned set
    const idCol = result.current.layout.flatColumns.find((c) => c.columnId === 'id');
    expect(idCol?.pinned).toBe('left');

    // Pinning state should reflect the override
    expect(result.current.pinning.pinnedColumns).toEqual({ id: 'left' });
    expect(result.current.pinning.isPinned('id')).toBe('left');
    expect(result.current.pinning.isPinned('name')).toBeUndefined();
  });

  it('headerFilterInput passes sort and filter props through', () => {
    const propsWithFilters: IOGridDataGridProps<Row> = {
      ...defaultProps,
      sortBy: 'score',
      sortDirection: 'desc',
      filters: { name: { type: 'text', value: 'A' } },
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsWithFilters, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.viewModels.headerFilterInput.sortBy).toBe('score');
    expect(result.current.viewModels.headerFilterInput.sortDirection).toBe('desc');
    expect(result.current.viewModels.headerFilterInput.filters).toEqual({
      name: { type: 'text', value: 'A' },
    });
  });

  it('undo/redo state is initialized', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.interaction.canUndo).toBe(false);
    expect(result.current.interaction.canRedo).toBe(false);
    expect(typeof result.current.interaction.onUndo).toBe('function');
    expect(typeof result.current.interaction.onRedo).toBe('function');
  });

  it('pinning state exposes headerMenu', () => {
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    expect(result.current.pinning.headerMenu.isOpen).toBe(false);
    expect(result.current.pinning.headerMenu.openForColumn).toBeNull();
    expect(typeof result.current.pinning.headerMenu.open).toBe('function');
    expect(typeof result.current.pinning.headerMenu.close).toBe('function');
    expect(typeof result.current.pinning.headerMenu.handlePinLeft).toBe('function');
    expect(typeof result.current.pinning.headerMenu.handlePinRight).toBe('function');
    expect(typeof result.current.pinning.headerMenu.handleUnpin).toBe('function');
  });

  it('handles column groups', () => {
    const groupColumns = [
      {
        columnId: 'personal',
        name: 'Personal',
        children: [
          { columnId: 'name', name: 'Name' },
          { columnId: 'id', name: 'ID' },
        ],
      },
      { columnId: 'score', name: 'Score' },
    ];
    const propsWithGroups: IOGridDataGridProps<Row> = {
      ...defaultProps,
      columns: groupColumns as IOGridDataGridProps<Row>['columns'],
      visibleColumns: new Set(['name', 'id', 'score']),
    };
    const wrapperRef = { current: document.createElement('div') };
    const { result } = renderHook(
      () => useDataGridState<Row>({ props: propsWithGroups, wrapperRef }),
      { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) }
    );

    // flatColumns should flatten the group
    expect(result.current.layout.flatColumns).toHaveLength(3);
    expect(result.current.layout.flatColumns.map((c) => c.columnId)).toEqual(['name', 'id', 'score']);
  });
});
