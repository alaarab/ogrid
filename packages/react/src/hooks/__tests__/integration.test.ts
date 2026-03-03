import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import { useDataGridState } from '../useDataGridState';
import { useClipboard } from '../useClipboard';
import { useUndoRedo } from '../useUndoRedo';
import { useKeyboardNavigation } from '../useKeyboardNavigation';
import type { IOGridApi, IOGridDataGridProps, ICellValueChangedEvent, IColumnDef } from '../../types';

/**
 * Integration tests  -  multi-step user flows that exercise multiple hooks together.
 * Each test simulates a complete user interaction sequence, not isolated hook behavior.
 */

type Row = { id: string; name: string; score: number; status: string };

const testData: Row[] = [
  { id: '1', name: 'Alice', score: 90, status: 'Active' },
  { id: '2', name: 'Bob', score: 75, status: 'Closed' },
  { id: '3', name: 'Charlie', score: 85, status: 'Active' },
  { id: '4', name: 'Diana', score: 60, status: 'Closed' },
  { id: '5', name: 'Eve', score: 95, status: 'Active' },
  { id: '6', name: 'Frank', score: 70, status: 'Closed' },
  { id: '7', name: 'Grace', score: 80, status: 'Active' },
  { id: '8', name: 'Hank', score: 55, status: 'Closed' },
];

const testColumns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'score', name: 'Score', type: 'numeric', editable: true },
  { columnId: 'status', name: 'Status', editable: true },
];

const filterableColumns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
  { columnId: 'score', name: 'Score', type: 'numeric' },
  { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' as const } },
];

const getRowId = (r: Row) => r.id;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

// ResizeObserver mock for useDataGridState
const mockResizeObserver = jest.fn().mockImplementation((cb: () => void) => ({
  observe: jest.fn(() => cb()),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

beforeAll(() => {
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = mockResizeObserver;
});

// Clipboard mock
let writeTextMock: jest.Mock;
let readTextMock: jest.Mock;

beforeEach(() => {
  writeTextMock = jest.fn().mockResolvedValue(undefined);
  readTextMock = jest.fn().mockResolvedValue('');
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock, readText: readTextMock },
    writable: true,
    configurable: true,
  });
  mockResizeObserver.mockClear();
});

/** Helper to build useOGrid props */
function makeClientProps(overrides: Record<string, unknown> = {}) {
  return {
    columns: testColumns,
    getRowId,
    data: testData,
    ...overrides,
  } as Parameters<typeof useOGrid<Row>>[0];
}

function renderUseOGrid(overrides: Record<string, unknown> = {}) {
  const apiRef = React.createRef<IOGridApi<Row>>();
  const props = makeClientProps(overrides);
  const hookResult = renderHook(() => useOGrid(props, apiRef), { wrapper });
  return { ...hookResult, apiRef };
}

describe('Integration: Selection + Copy + Paste flow', () => {
  it('selects a range, copies, moves to new cell, and pastes', async () => {
    const onCellValueChanged = jest.fn();
    const editableCols: IColumnDef<Row>[] = testColumns.map((c) => ({ ...c, editable: true }));
    const wrapperRef = { current: document.createElement('div') };

    const defaultProps: IOGridDataGridProps<Row> = {
      items: testData,
      columns: editableCols,
      getRowId,
      sortBy: 'name',
      sortDirection: 'asc' as const,
      onColumnSort: jest.fn(),
      visibleColumns: new Set(['name', 'score', 'status']),
      filters: {},
      onFilterChange: jest.fn(),
      filterOptions: {},
      loadingFilterOptions: {},
      onCellValueChanged,
    };

    const { result } = renderHook(
      () => useDataGridState<Row>({ props: defaultProps, wrapperRef }),
      { wrapper }
    );

    // Step 1: Click on cell (0,0)  -  sets active cell and selection range
    act(() => {
      result.current.interaction.setActiveCell({ rowIndex: 0, columnIndex: 0 });
      result.current.interaction.setSelectionRange({
        startRow: 0,
        startCol: 0,
        endRow: 1,
        endCol: 1,
      });
    });

    // Verify selection is set
    expect(result.current.interaction.selectionRange).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });
    expect(result.current.interaction.hasCellSelection).toBe(true);

    // Step 2: Copy the selection
    act(() => {
      result.current.interaction.handleCopy();
    });

    // Verify clipboard was written (TSV format: 2 rows x 2 cols)
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('\t'); // TSV has tabs
    expect(copiedText.split('\n').length).toBe(2); // 2 rows

    // Step 3: Move active cell to row 4, col 0
    act(() => {
      result.current.interaction.setActiveCell({ rowIndex: 4, columnIndex: 0 });
      result.current.interaction.setSelectionRange({
        startRow: 4,
        startCol: 0,
        endRow: 4,
        endCol: 0,
      });
    });

    // Step 4: Paste
    readTextMock.mockResolvedValue(copiedText);
    await act(async () => {
      await result.current.interaction.handlePaste();
    });

    // Verify onCellValueChanged was called for each pasted cell
    expect(onCellValueChanged).toHaveBeenCalled();
    // Should have events for the paste (2 rows x 2 cols = up to 4 cells)
    const pasteCallCount = onCellValueChanged.mock.calls.length;
    expect(pasteCallCount).toBeGreaterThanOrEqual(2);
  });

  it('copies a single cell and pastes to another location', async () => {
    const onCellValueChanged = jest.fn();
    const editableCols: IColumnDef<Row>[] = testColumns.map((c) => ({ ...c, editable: true }));

    // Use useClipboard directly for a focused single-cell flow
    const { result } = renderHook(() =>
      useClipboard({
        items: testData,
        visibleCols: editableCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        onCellValueChanged,
      })
    );

    // Step 1: Copy single cell
    act(() => {
      result.current.handleCopy();
    });
    expect(writeTextMock).toHaveBeenCalledWith('Alice');

    // Step 2: Paste to a different location
    readTextMock.mockResolvedValue('Alice');
    const { result: result2 } = renderHook(() =>
      useClipboard({
        items: testData,
        visibleCols: editableCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: { rowIndex: 3, columnIndex: 0 },
        onCellValueChanged,
      })
    );

    await act(async () => {
      await result2.current.handlePaste();
    });

    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'name',
        newValue: 'Alice',
        rowIndex: 3,
      })
    );
  });
});

describe('Integration: Edit + Undo + Redo flow', () => {
  it('records edits and undoes them in reverse order', () => {
    const changes: ICellValueChangedEvent<Row>[] = [];
    const onCellValueChanged = (evt: ICellValueChangedEvent<Row>) => {
      changes.push(evt);
    };

    const { result } = renderHook(() =>
      useUndoRedo({ onCellValueChanged })
    );

    // Step 1: Make first edit
    act(() => {
      result.current.onCellValueChanged!({
        rowIndex: 0,
        columnId: 'name',
        oldValue: 'Alice',
        newValue: 'Alicia',
        item: testData[0],
      });
    });

    // Step 2: Make second edit
    act(() => {
      result.current.onCellValueChanged!({
        rowIndex: 1,
        columnId: 'score',
        oldValue: 75,
        newValue: 80,
        item: testData[1],
      });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(changes).toHaveLength(2);

    // Step 3: Undo the second edit
    act(() => {
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
    // Undo fires an onCellValueChanged with reversed old/new values
    const undoEvent = changes[changes.length - 1];
    expect(undoEvent.columnId).toBe('score');
    expect(undoEvent.oldValue).toBe(80);
    expect(undoEvent.newValue).toBe(75);

    // Step 4: Redo the second edit
    act(() => {
      result.current.redo();
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    const redoEvent = changes[changes.length - 1];
    expect(redoEvent.columnId).toBe('score');
    expect(redoEvent.newValue).toBe(80);

    // Step 5: Undo both edits
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    // Last event should revert the first edit
    const lastEvent = changes[changes.length - 1];
    expect(lastEvent.columnId).toBe('name');
    expect(lastEvent.newValue).toBe('Alice');
  });

  it('batch edits are undone as a single step', () => {
    const changes: ICellValueChangedEvent<Row>[] = [];
    const onCellValueChanged = (evt: ICellValueChangedEvent<Row>) => {
      changes.push(evt);
    };

    const { result } = renderHook(() =>
      useUndoRedo({ onCellValueChanged })
    );

    // Step 1: Begin batch and make multiple edits
    act(() => {
      result.current.beginBatch();
      result.current.onCellValueChanged!({
        rowIndex: 0,
        columnId: 'name',
        oldValue: 'Alice',
        newValue: 'Alicia',
        item: testData[0],
      });
      result.current.onCellValueChanged!({
        rowIndex: 1,
        columnId: 'name',
        oldValue: 'Bob',
        newValue: 'Robert',
        item: testData[1],
      });
      result.current.onCellValueChanged!({
        rowIndex: 2,
        columnId: 'name',
        oldValue: 'Charlie',
        newValue: 'Charles',
        item: testData[2],
      });
      result.current.endBatch();
    });

    expect(changes).toHaveLength(3);
    expect(result.current.canUndo).toBe(true);

    // Step 2: Undo the entire batch  -  all 3 edits revert in one step
    const changeCountBefore = changes.length;
    act(() => {
      result.current.undo();
    });

    // All 3 edits should be reverted (3 new events)
    expect(changes.length - changeCountBefore).toBe(3);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Verify the reverted values are the original values
    const revertedNames = changes.slice(changeCountBefore).map((e) => e.newValue);
    expect(revertedNames).toEqual(
      expect.arrayContaining(['Alice', 'Bob', 'Charlie'])
    );
  });
});

describe('Integration: Keyboard navigation at grid boundaries', () => {
  it('stays within bounds at edges and navigates to extremes with Home/End', () => {
    const items = testData.slice(0, 3);
    const visibleCols = testColumns;
    const colOffset = 0;

    // Use mutable object so the hook's paramsRef always reads current values
    const state = {
      activeCell: { rowIndex: 0, columnIndex: 0 } as { rowIndex: number; columnIndex: number } | null,
      selectionRange: null as { startRow: number; startCol: number; endRow: number; endCol: number } | null,
      editingCell: null,
      selectedRowIds: new Set<string>(),
    };

    const setActiveCell = jest.fn((cell) => { state.activeCell = cell; });
    const setSelectionRange = jest.fn((range) => { state.selectionRange = range; });
    const setEditingCell = jest.fn();
    const handleRowCheckboxChange = jest.fn();

    // Build params as a stable object that the hook can re-read via paramsRef
    const hookParams = {
      data: {
        items,
        visibleCols,
        colOffset,
        hasCheckboxCol: false,
        visibleColumnCount: visibleCols.length,
        getRowId,
      },
      state,
      handlers: {
        setActiveCell,
        setSelectionRange,
        setEditingCell,
        handleRowCheckboxChange,
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    };

    const { result, rerender } = renderHook(() => useKeyboardNavigation<Row>(hookParams));

    const makeKeyEvent = (key: string, extra: Partial<React.KeyboardEvent> = {}) =>
      ({
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: jest.fn(),
        ...extra,
      }) as unknown as React.KeyboardEvent;

    // At (0,0), ArrowLeft should stay at (0,0)
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowLeft'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: 0 })
    );

    // At (0,0), ArrowUp should stay at (0,0)
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowUp'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 0 })
    );

    // End should go to last column
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('End'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: visibleCols.length - 1 })
    );

    // Simulate End navigation result and re-render so hook picks up new state
    state.activeCell = { rowIndex: 0, columnIndex: visibleCols.length - 1 };
    rerender();

    // ArrowRight at last column should stay at last column
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowRight'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ columnIndex: visibleCols.length - 1 })
    );

    // ArrowDown to last row
    state.activeCell = { rowIndex: 0, columnIndex: visibleCols.length - 1 };
    rerender();
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowDown'));
    });
    state.activeCell = { rowIndex: 1, columnIndex: visibleCols.length - 1 };
    rerender();
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowDown'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 2 })
    );

    // At last row, ArrowDown should stay at last row
    state.activeCell = { rowIndex: 2, columnIndex: visibleCols.length - 1 };
    rerender();
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowDown'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 2 })
    );

    // Home should go to first column
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('Home'));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 2, columnIndex: 0 })
    );

    // Ctrl+Home should go to (0,0)
    state.activeCell = { rowIndex: 2, columnIndex: 2 };
    rerender();
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('Home', { ctrlKey: true }));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowIndex: 0, columnIndex: 0 })
    );

    // Ctrl+End should go to last row, last col
    state.activeCell = { rowIndex: 0, columnIndex: 0 };
    rerender();
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('End', { ctrlKey: true }));
    });
    expect(setActiveCell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rowIndex: items.length - 1,
        columnIndex: visibleCols.length - 1,
      })
    );
  });

  it('initializes active cell on first arrow key when none is set', () => {
    const items = testData.slice(0, 3);
    const visibleCols = testColumns;

    let activeCell: { rowIndex: number; columnIndex: number } | null = null;
    const setActiveCell = jest.fn((cell) => { activeCell = cell; });
    const setSelectionRange = jest.fn();

    const params = () => ({
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: visibleCols.length,
        getRowId,
      },
      state: {
        activeCell,
        selectionRange: null,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell,
        setSelectionRange,
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    });

    const { result } = renderHook(() => useKeyboardNavigation<Row>(params()));

    const makeKeyEvent = (key: string) =>
      ({
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: jest.fn(),
      }) as unknown as React.KeyboardEvent;

    // No active cell  -  ArrowDown should set it to (0, 0)
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('ArrowDown'));
    });
    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
  });
});

describe('Integration: Filter + Sort + Paginate flow', () => {
  it('applies a text filter, then sorts, then paginates through results', () => {
    const { result } = renderUseOGrid({
      columns: filterableColumns,
      defaultPageSize: 3,
    });

    // Initial state: 8 items, first page of 3
    expect(result.current.dataGridProps.items).toHaveLength(3);
    expect(result.current.pagination.displayTotalCount).toBe(8);

    // Step 1: Apply text filter on 'name'  -  filter for names containing 'a'
    act(() => {
      result.current.dataGridProps.onFilterChange!('name', {
        type: 'text',
        value: 'a',
      });
    });

    // Should filter to names containing 'a' (case-insensitive): Alice, Charlie, Diana, Grace, Frank, Hank
    expect(result.current.filters.hasActiveFilters).toBe(true);
    const filteredTotal = result.current.pagination.displayTotalCount;
    expect(filteredTotal).toBeGreaterThan(0);
    expect(filteredTotal).toBeLessThan(8);

    // Step 2: Sort by score descending
    act(() => {
      result.current.dataGridProps.onColumnSort('score', 'desc');
    });

    expect(result.current.dataGridProps.sortBy).toBe('score');
    expect(result.current.dataGridProps.sortDirection).toBe('desc');

    // Verify scores are in descending order on current page
    const scores = result.current.dataGridProps.items.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }

    // Step 3: Page resets to 1 after sort  -  now navigate to page 2 if there are enough items
    expect(result.current.pagination.page).toBe(1);
    const totalPages = Math.ceil(filteredTotal / 3);
    if (totalPages > 1) {
      act(() => {
        result.current.pagination.setPage(2);
      });
      expect(result.current.pagination.page).toBe(2);
      // Page 2 items should also be sorted
      const page2Scores = result.current.dataGridProps.items.map((r) => r.score);
      for (let i = 1; i < page2Scores.length; i++) {
        expect(page2Scores[i]).toBeLessThanOrEqual(page2Scores[i - 1]);
      }
    }

    // Step 4: Clear the filter  -  should go back to all items
    act(() => {
      result.current.filters.setFilters({});
    });

    expect(result.current.filters.hasActiveFilters).toBe(false);
    expect(result.current.pagination.displayTotalCount).toBe(8);
  });

  it('filter change resets page to 1', () => {
    const { result } = renderUseOGrid({
      columns: filterableColumns,
      defaultPageSize: 2,
    });

    // Go to page 3
    act(() => {
      result.current.pagination.setPage(3);
    });
    expect(result.current.pagination.page).toBe(3);

    // Apply filter  -  page should reset to 1
    act(() => {
      result.current.dataGridProps.onFilterChange!('name', {
        type: 'text',
        value: 'Alice',
      });
    });
    expect(result.current.pagination.page).toBe(1);
  });
});

describe('Integration: Column visibility toggle', () => {
  it('hides and shows a column, verifying it affects dataGridProps', () => {
    const { result } = renderUseOGrid();

    // All columns visible initially
    expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
    expect(result.current.columnChooser.visibleColumns.has('score')).toBe(true);
    expect(result.current.columnChooser.visibleColumns.has('status')).toBe(true);

    // Step 1: Hide 'score' column
    act(() => {
      result.current.columnChooser.onVisibilityChange('score', false);
    });

    expect(result.current.columnChooser.visibleColumns.has('score')).toBe(false);
    expect(result.current.columnChooser.visibleColumns.size).toBe(2);

    // The dataGridProps.visibleColumns should reflect the change
    expect(result.current.dataGridProps.visibleColumns.has('score')).toBe(false);

    // Step 2: Show 'score' column again
    act(() => {
      result.current.columnChooser.onVisibilityChange('score', true);
    });

    expect(result.current.columnChooser.visibleColumns.has('score')).toBe(true);
    expect(result.current.columnChooser.visibleColumns.size).toBe(3);
    expect(result.current.dataGridProps.visibleColumns.has('score')).toBe(true);
  });

  it('onSetVisibleColumns replaces the entire set', () => {
    const { result } = renderUseOGrid();

    // Step 1: Reduce to only 'name'
    act(() => {
      result.current.columnChooser.onSetVisibleColumns(new Set(['name']));
    });

    expect(result.current.columnChooser.visibleColumns.size).toBe(1);
    expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
    expect(result.current.columnChooser.visibleColumns.has('score')).toBe(false);

    // Step 2: Restore all
    act(() => {
      result.current.columnChooser.onSetVisibleColumns(
        new Set(['name', 'score', 'status'])
      );
    });

    expect(result.current.columnChooser.visibleColumns.size).toBe(3);
  });
});

describe('Integration: Sort + Filter + Column visibility combined', () => {
  it('applies multiple operations in sequence and verifies combined state', () => {
    const { result, apiRef } = renderUseOGrid({
      columns: filterableColumns,
      defaultPageSize: 25,
    });

    // Step 1: Sort by score descending
    act(() => {
      result.current.dataGridProps.onColumnSort('score', 'desc');
    });

    expect(result.current.dataGridProps.sortBy).toBe('score');
    const firstItem = result.current.dataGridProps.items[0];
    expect(firstItem.score).toBe(95); // Eve has highest score

    // Step 2: Apply filter for 'Active' status names only
    act(() => {
      result.current.dataGridProps.onFilterChange!('name', {
        type: 'text',
        value: 'e',
      });
    });

    // Items with 'e' in name: Alice, Eve, Charlie, Grace
    expect(result.current.filters.hasActiveFilters).toBe(true);
    const filteredCount = result.current.pagination.displayTotalCount;
    expect(filteredCount).toBeLessThan(8);

    // Items should still be sorted by score descending
    const items = result.current.dataGridProps.items;
    for (let i = 1; i < items.length; i++) {
      expect(items[i].score).toBeLessThanOrEqual(items[i - 1].score);
    }

    // Step 3: Hide 'status' column
    act(() => {
      result.current.columnChooser.onVisibilityChange('status', false);
    });

    expect(result.current.dataGridProps.visibleColumns.has('status')).toBe(false);

    // Step 4: Reset grid state via API
    act(() => {
      apiRef.current!.resetGridState();
    });

    // Filters and sort should be cleared
    expect(result.current.filters.hasActiveFilters).toBe(false);
    expect(result.current.pagination.displayTotalCount).toBe(8);
  });
});

describe('Integration: Row selection + Pagination interaction', () => {
  it('selecting rows persists across page changes', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderUseOGrid({
      rowSelection: 'multiple',
      onSelectionChange,
      defaultPageSize: 3,
    });

    // Step 1: Select rows on page 1
    act(() => {
      result.current.dataGridProps.onSelectionChange!({
        selectedRowIds: ['1', '2'],
        selectedItems: [testData[0], testData[1]],
      });
    });

    expect(result.current.dataGridProps.selectedRows!.has('1')).toBe(true);
    expect(result.current.dataGridProps.selectedRows!.has('2')).toBe(true);

    // Step 2: Go to page 2
    act(() => {
      result.current.pagination.setPage(2);
    });

    // Selected rows from page 1 should still be in the set
    expect(result.current.dataGridProps.selectedRows!.has('1')).toBe(true);
    expect(result.current.dataGridProps.selectedRows!.has('2')).toBe(true);
    expect(result.current.pagination.page).toBe(2);
  });
});

describe('Integration: API ref comprehensive flow', () => {
  it('uses API ref for programmatic control of grid state', () => {
    const columns = filterableColumns;
    const { result, apiRef } = renderUseOGrid({
      columns,
      defaultPageSize: 4,
    });

    // Step 1: Set rows via API
    act(() => {
      apiRef.current!.setSelectedRows(['1', '3', '5']);
    });
    expect(apiRef.current!.getSelectedRows()).toEqual(['1', '3', '5']);

    // Step 2: Apply column state via API
    act(() => {
      apiRef.current!.applyColumnState({
        visibleColumns: ['name', 'score'],
        sort: { field: 'score', direction: 'asc' },
      });
    });

    const colState = apiRef.current!.getColumnState();
    expect(colState.visibleColumns).toEqual(['name', 'score']);
    expect(colState.sort).toEqual({ field: 'score', direction: 'asc' });

    // Items should be sorted by score ascending
    const scores = result.current.dataGridProps.items.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }

    // Step 3: Set filter via API
    act(() => {
      apiRef.current!.setFilterModel({
        name: { type: 'text', value: 'Alice' },
      });
    });
    expect(result.current.filters.hasActiveFilters).toBe(true);
    expect(result.current.dataGridProps.items).toHaveLength(1);
    expect(result.current.dataGridProps.items[0].name).toBe('Alice');

    // Step 4: Clear filters
    act(() => {
      apiRef.current!.clearFilters();
    });
    expect(result.current.filters.hasActiveFilters).toBe(false);
    expect(result.current.pagination.displayTotalCount).toBe(8);

    // Step 5: Select all, then deselect all
    act(() => {
      apiRef.current!.selectAll();
    });
    expect(apiRef.current!.getSelectedRows().length).toBeGreaterThan(0);

    act(() => {
      apiRef.current!.deselectAll();
    });
    expect(apiRef.current!.getSelectedRows()).toEqual([]);
  });
});

describe('Integration: Keyboard shortcuts for copy/cut/paste', () => {
  it('Ctrl+C copies, Ctrl+V pastes via keyboard handler', async () => {
    const onCellValueChanged = jest.fn();
    const editableCols: IColumnDef<Row>[] = testColumns.map((c) => ({ ...c, editable: true }));

    const handleCopy = jest.fn();
    const handleCut = jest.fn();
    const handlePaste = jest.fn().mockResolvedValue(undefined);
    const onUndo = jest.fn();
    const onRedo = jest.fn();

    const hookParams = {
      data: {
        items: testData.slice(0, 3),
        visibleCols: editableCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: editableCols.length,
        getRowId,
      },
      state: {
        activeCell: { rowIndex: 0, columnIndex: 0 } as { rowIndex: number; columnIndex: number } | null,
        selectionRange: {
          startRow: 0,
          startCol: 0,
          endRow: 0,
          endCol: 0,
        } as { startRow: number; startCol: number; endRow: number; endCol: number } | null,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy,
        handleCut,
        handlePaste,
        setContextMenu: jest.fn(),
        onUndo,
        onRedo,
      },
      features: {
        editable: true,
        onCellValueChanged,
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    };

    const { result } = renderHook(() => useKeyboardNavigation<Row>(hookParams));

    const makeKeyEvent = (key: string, extra: Partial<React.KeyboardEvent> = {}) =>
      ({
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: jest.fn(),
        ...extra,
      }) as unknown as React.KeyboardEvent;

    // Ctrl+C should call handleCopy
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('c', { ctrlKey: true }));
    });
    expect(handleCopy).toHaveBeenCalledTimes(1);

    // Ctrl+X should call handleCut
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('x', { ctrlKey: true }));
    });
    expect(handleCut).toHaveBeenCalledTimes(1);

    // Ctrl+V should call handlePaste
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('v', { ctrlKey: true }));
    });
    expect(handlePaste).toHaveBeenCalledTimes(1);

    // Ctrl+Z should call onUndo
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('z', { ctrlKey: true }));
    });
    expect(onUndo).toHaveBeenCalledTimes(1);

    // Ctrl+Shift+Z should call onRedo
    act(() => {
      result.current.handleGridKeyDown(
        makeKeyEvent('z', { ctrlKey: true, shiftKey: true })
      );
    });
    expect(onRedo).toHaveBeenCalledTimes(1);

    // Ctrl+Y should also call onRedo
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('y', { ctrlKey: true }));
    });
    expect(onRedo).toHaveBeenCalledTimes(2);
  });

  it('Ctrl+A selects all cells', () => {
    const items = testData.slice(0, 3);
    const visibleCols = testColumns;

    let activeCell: { rowIndex: number; columnIndex: number } | null = {
      rowIndex: 1,
      columnIndex: 1,
    };
    let selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null = null;

    const setActiveCell = jest.fn((cell) => { activeCell = cell; });
    const setSelectionRange = jest.fn((range) => { selectionRange = range; });

    const params = () => ({
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: visibleCols.length,
        getRowId,
      },
      state: {
        activeCell,
        selectionRange,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell,
        setSelectionRange,
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    });

    const { result } = renderHook(() => useKeyboardNavigation<Row>(params()));

    const makeKeyEvent = (key: string, extra: Partial<React.KeyboardEvent> = {}) =>
      ({
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: jest.fn(),
        ...extra,
      }) as unknown as React.KeyboardEvent;

    // Ctrl+A should select all cells
    act(() => {
      result.current.handleGridKeyDown(makeKeyEvent('a', { ctrlKey: true }));
    });

    expect(setSelectionRange).toHaveBeenCalledWith({
      startRow: 0,
      startCol: 0,
      endRow: items.length - 1,
      endCol: visibleCols.length - 1,
    });
    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
  });
});

describe('Integration: Escape key clears selection and editing', () => {
  it('Escape clears active cell and selection when not editing', () => {
    const items = testData.slice(0, 3);
    const visibleCols = testColumns;

    let activeCell: { rowIndex: number; columnIndex: number } | null = {
      rowIndex: 1,
      columnIndex: 1,
    };
    let selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null = {
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 2,
    };

    const setActiveCell = jest.fn((cell) => { activeCell = cell; });
    const setSelectionRange = jest.fn((range) => { selectionRange = range; });
    const clearClipboardRanges = jest.fn();

    const params = () => ({
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: visibleCols.length,
        getRowId,
      },
      state: {
        activeCell,
        selectionRange,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell,
        setSelectionRange,
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
        clearClipboardRanges,
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    });

    const { result } = renderHook(() => useKeyboardNavigation<Row>(params()));

    const escEvent = {
      key: 'Escape',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(escEvent);
    });

    expect(clearClipboardRanges).toHaveBeenCalled();
    expect(setActiveCell).toHaveBeenCalledWith(null);
    expect(setSelectionRange).toHaveBeenCalledWith(null);
  });

  it('Escape cancels editing when in editing mode', () => {
    const items = testData.slice(0, 3);
    const visibleCols = testColumns;
    const setEditingCell = jest.fn();

    const params = () => ({
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: visibleCols.length,
        getRowId,
      },
      state: {
        activeCell: { rowIndex: 0, columnIndex: 0 },
        selectionRange: null,
        editingCell: { rowId: '1', columnId: 'name' },
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        setEditingCell,
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: true,
        onCellValueChanged: jest.fn(),
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    });

    const { result } = renderHook(() => useKeyboardNavigation<Row>(params()));

    const escEvent = {
      key: 'Escape',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(escEvent);
    });

    // Should cancel editing, not clear selection
    expect(setEditingCell).toHaveBeenCalledWith(null);
  });
});

describe('Integration: Delete/Backspace clears cell values', () => {
  it('Delete key fires onCellValueChanged with empty value for selected range', () => {
    const items = [
      { id: '1', name: 'Alice', score: 90, status: 'Active' },
      { id: '2', name: 'Bob', score: 75, status: 'Closed' },
    ];
    const editableCols: IColumnDef<Row>[] = testColumns.map((c) => ({
      ...c,
      editable: true,
    }));
    const onCellValueChanged = jest.fn();

    const params = () => ({
      data: {
        items,
        visibleCols: editableCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: editableCols.length,
        getRowId,
      },
      state: {
        activeCell: { rowIndex: 0, columnIndex: 0 },
        selectionRange: {
          startRow: 0,
          startCol: 0,
          endRow: 0,
          endCol: 1,
        },
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: true,
        onCellValueChanged,
        rowSelection: 'none' as const,
        wrapperRef: { current: document.createElement('div') },
      },
    });

    const { result } = renderHook(() => useKeyboardNavigation<Row>(params()));

    const deleteEvent = {
      key: 'Delete',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(deleteEvent);
    });

    // Should fire value changed events to clear the selected cells
    expect(onCellValueChanged).toHaveBeenCalled();
    // Two columns in range: name and score
    expect(onCellValueChanged).toHaveBeenCalledTimes(2);
  });
});

describe('Integration: Server-side data source with sort and filter', () => {
  it('sends updated params when sorting and filtering', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      items: testData.slice(0, 3),
      totalCount: 8,
    });
    const dataSource = { fetchPage };

    const serverProps = {
      columns: filterableColumns,
      getRowId,
      dataSource,
    } as Parameters<typeof useOGrid<Row>>[0];

    const apiRef = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>(serverProps, apiRef),
      { wrapper }
    );

    // Wait for initial fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage.mock.calls[0][0]).toMatchObject({
      page: 1,
      pageSize: 25,
    });

    // Sort by score  -  should trigger a new fetch
    act(() => {
      result.current.dataGridProps.onColumnSort('score', 'desc');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // fetchPage should be called again with sort params
    const sortCall = fetchPage.mock.calls[fetchPage.mock.calls.length - 1][0];
    expect(sortCall.sort).toEqual({ field: 'score', direction: 'desc' });
  });
});
