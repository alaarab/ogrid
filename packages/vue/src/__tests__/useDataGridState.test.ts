import { ref, computed } from 'vue';
import { useDataGridState } from '../composables/useDataGridState';
import type { IOGridDataGridProps } from '../types';

// ResizeObserver is not in jsdom
const mockResizeObserver = jest.fn().mockImplementation((cb: () => void) => {
  return {
    observe: jest.fn(() => { cb(); }),
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

type Row = { id: string; name: string; score: number };

const testItems: Row[] = [
  { id: '1', name: 'Alice', score: 10 },
  { id: '2', name: 'Bob', score: 20 },
  { id: '3', name: 'Charlie', score: 30 },
];

const testColumns = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
  { columnId: 'score', name: 'Score' },
];

const getRowId = (r: Row) => r.id;

function createDefaultProps(overrides: Partial<IOGridDataGridProps<Row>> = {}): IOGridDataGridProps<Row> {
  return {
    items: testItems,
    columns: testColumns,
    getRowId,
    sortBy: 'name',
    sortDirection: 'asc' as const,
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['id', 'name', 'score']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: {},
    loadingFilterOptions: {},
    ...overrides,
  };
}

function createState(overrides: Partial<IOGridDataGridProps<Row>> = {}) {
  const props = ref(createDefaultProps(overrides));
  const wrapperRef = ref<HTMLDivElement | null>(document.createElement('div'));
  return useDataGridState<Row>({ props, wrapperRef });
}

describe('useDataGridState', () => {
  describe('layout state', () => {
    it('returns all expected sub-objects', () => {
      const state = createState();

      expect(state).toHaveProperty('layout');
      expect(state).toHaveProperty('rowSelection');
      expect(state).toHaveProperty('editing');
      expect(state).toHaveProperty('interaction');
      expect(state).toHaveProperty('contextMenu');
      expect(state).toHaveProperty('viewModels');
      expect(state).toHaveProperty('pinning');
    });

    it('computes flat columns and visible columns', () => {
      const state = createState();
      const layout = state.layout.value;

      expect(layout.flatColumns).toHaveLength(3);
      expect(layout.visibleCols).toHaveLength(3);
      expect(layout.visibleColumnCount).toBe(3);
      expect(layout.totalColCount).toBe(3);
      expect(layout.colOffset).toBe(0);
    });

    it('maps row IDs to indices via rowIndexByRowId', () => {
      const state = createState();
      const map = state.layout.value.rowIndexByRowId;

      expect(map.get('1')).toBe(0);
      expect(map.get('2')).toBe(1);
      expect(map.get('3')).toBe(2);
      expect(map.size).toBe(3);
    });

    it('filters visibleCols by visibleColumns set', () => {
      const state = createState({
        visibleColumns: new Set(['name', 'score']),
      });

      const layout = state.layout.value;
      expect(layout.visibleCols).toHaveLength(2);
      expect(layout.visibleCols.map((c) => c.columnId)).toEqual(['name', 'score']);
      expect(layout.visibleColumnCount).toBe(2);
    });

    it('orders visibleCols by columnOrder', () => {
      const state = createState({
        visibleColumns: new Set(['id', 'name', 'score']),
        columnOrder: ['score', 'id', 'name'],
      });

      expect(state.layout.value.visibleCols.map((c) => c.columnId)).toEqual(['score', 'id', 'name']);
    });

    it('handles column groups (flattenColumns)', () => {
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
      const state = createState({
        columns: groupColumns as IOGridDataGridProps<Row>['columns'],
        visibleColumns: new Set(['name', 'id', 'score']),
      });

      expect(state.layout.value.flatColumns).toHaveLength(3);
      expect(state.layout.value.flatColumns.map((c) => c.columnId)).toEqual(['name', 'id', 'score']);
    });

    it('hasCheckboxCol is true when rowSelection is multiple', () => {
      const state = createState({
        rowSelection: 'multiple',
        selectedRows: new Set(),
        onSelectionChange: jest.fn(),
      });

      expect(state.layout.value.hasCheckboxCol).toBe(true);
      expect(state.layout.value.colOffset).toBe(1);
      expect(state.layout.value.totalColCount).toBe(4); // 3 data + 1 checkbox
    });

    it('hasRowNumbersCol is true when showRowNumbers is set', () => {
      const state = createState({ showRowNumbers: true });

      expect(state.layout.value.hasRowNumbersCol).toBe(true);
      expect(state.layout.value.colOffset).toBe(1);
    });

    it('colOffset is 2 when both checkbox and row numbers', () => {
      const state = createState({
        rowSelection: 'multiple',
        selectedRows: new Set(),
        onSelectionChange: jest.fn(),
        showRowNumbers: true,
      });

      expect(state.layout.value.colOffset).toBe(2);
      expect(state.layout.value.totalColCount).toBe(5);
    });

    it('initializes column sizing overrides as empty', () => {
      const state = createState();

      expect(state.layout.value.columnSizingOverrides).toEqual({});
      expect(typeof state.layout.value.setColumnSizingOverrides).toBe('function');
    });
  });

  describe('row selection', () => {
    it('initializes with empty selection', () => {
      const state = createState();

      expect(state.rowSelection.value.selectedRowIds).toBeInstanceOf(Set);
      expect(state.rowSelection.value.selectedRowIds.size).toBe(0);
      expect(state.rowSelection.value.allSelected).toBe(false);
      expect(state.rowSelection.value.someSelected).toBe(false);
    });

    it('provides selection handlers', () => {
      const state = createState();

      expect(typeof state.rowSelection.value.updateSelection).toBe('function');
      expect(typeof state.rowSelection.value.handleRowCheckboxChange).toBe('function');
      expect(typeof state.rowSelection.value.handleSelectAll).toBe('function');
    });

    it('uses controlled selection when provided', () => {
      const state = createState({
        rowSelection: 'multiple',
        selectedRows: new Set(['1', '2']),
      });

      expect(state.rowSelection.value.selectedRowIds.has('1')).toBe(true);
      expect(state.rowSelection.value.selectedRowIds.has('2')).toBe(true);
      expect(state.rowSelection.value.selectedRowIds.size).toBe(2);
    });
  });

  describe('editing state', () => {
    it('initializes with null editing cell', () => {
      const state = createState();

      expect(state.editing.value.editingCell).toBeNull();
      expect(typeof state.editing.value.setEditingCell).toBe('function');
      expect(typeof state.editing.value.setPendingEditorValue).toBe('function');
    });

    it('setEditingCell updates editingCell', () => {
      const state = createState();

      state.editing.value.setEditingCell({ rowId: '1', columnId: 'name' });
      expect(state.editing.value.editingCell).toEqual({ rowId: '1', columnId: 'name' });
    });

    it('cancelPopoverEdit clears editing state', () => {
      const state = createState();

      state.editing.value.setEditingCell({ rowId: '1', columnId: 'name' });
      state.editing.value.setPendingEditorValue('test value');

      state.editing.value.cancelPopoverEdit();

      expect(state.editing.value.editingCell).toBeNull();
      expect(state.editing.value.popoverAnchorEl).toBeNull();
    });
  });

  describe('interaction state (cell selection)', () => {
    it('initializes with null active cell and selection range', () => {
      const state = createState();

      expect(state.interaction.value.activeCell).toBeNull();
      expect(state.interaction.value.selectionRange).toBeNull();
      expect(state.interaction.value.hasCellSelection).toBe(false);
    });

    it('setActiveCell updates activeCell', () => {
      const state = createState();

      state.interaction.value.setActiveCell({ rowIndex: 0, columnIndex: 1 });
      expect(state.interaction.value.activeCell).toEqual({ rowIndex: 0, columnIndex: 1 });
      expect(state.interaction.value.hasCellSelection).toBe(true);
    });

    it('setSelectionRange updates selectionRange', () => {
      const state = createState();

      state.interaction.value.setSelectionRange({
        startRow: 0,
        startCol: 0,
        endRow: 1,
        endCol: 2,
      });

      expect(state.interaction.value.selectionRange).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 1,
        endCol: 2,
      });
      expect(state.interaction.value.hasCellSelection).toBe(true);
    });

    it('provides clipboard handlers', () => {
      const state = createState();

      expect(typeof state.interaction.value.handleCopy).toBe('function');
      expect(typeof state.interaction.value.handleCut).toBe('function');
      expect(typeof state.interaction.value.handlePaste).toBe('function');
      expect(state.interaction.value.cutRange).toBeNull();
      expect(state.interaction.value.copyRange).toBeNull();
    });

    it('provides keyboard and fill handle handlers', () => {
      const state = createState();

      expect(typeof state.interaction.value.handleGridKeyDown).toBe('function');
      expect(typeof state.interaction.value.handleFillHandleMouseDown).toBe('function');
    });

    it('undo/redo state is initialized', () => {
      const state = createState();

      expect(state.interaction.value.canUndo).toBe(false);
      expect(state.interaction.value.canRedo).toBe(false);
      expect(typeof state.interaction.value.onUndo).toBe('function');
      expect(typeof state.interaction.value.onRedo).toBe('function');
    });

    it('interaction handlers are no-ops when cellSelection is disabled', () => {
      const state = createState({ cellSelection: false });

      expect(state.interaction.value.activeCell).toBeNull();
      expect(state.interaction.value.selectionRange).toBeNull();
      expect(state.interaction.value.hasCellSelection).toBe(false);
      expect(state.interaction.value.cutRange).toBeNull();
      expect(state.interaction.value.copyRange).toBeNull();
      expect(state.interaction.value.isDragging).toBe(false);
    });

    it('isDragging is initially false', () => {
      const state = createState();
      expect(state.interaction.value.isDragging).toBe(false);
    });
  });

  describe('context menu', () => {
    it('initializes with null menu position', () => {
      const state = createState();

      expect(state.contextMenu.value.menuPosition).toBeNull();
      expect(typeof state.contextMenu.value.setMenuPosition).toBe('function');
      expect(typeof state.contextMenu.value.handleCellContextMenu).toBe('function');
      expect(typeof state.contextMenu.value.closeContextMenu).toBe('function');
    });

    it('setMenuPosition and closeContextMenu work', () => {
      const state = createState();

      state.contextMenu.value.setMenuPosition({ x: 100, y: 200 });
      expect(state.contextMenu.value.menuPosition).toEqual({ x: 100, y: 200 });

      state.contextMenu.value.closeContextMenu();
      expect(state.contextMenu.value.menuPosition).toBeNull();
    });

    it('context menu is null when cellSelection is disabled', () => {
      const state = createState({ cellSelection: false });

      expect(state.contextMenu.value.menuPosition).toBeNull();
    });
  });

  describe('view models', () => {
    it('statusBarConfig is null when statusBar is undefined', () => {
      const state = createState();

      expect(state.viewModels.value.statusBarConfig).toBeNull();
    });

    it('statusBarConfig is returned when statusBar is an object', () => {
      const state = createState({
        statusBar: { totalCount: 100, filteredCount: 50, selectedCount: 2 },
      });

      expect(state.viewModels.value.statusBarConfig).toEqual({
        totalCount: 100,
        filteredCount: 50,
        selectedCount: 2,
      });
    });

    it('statusBarConfig includes item count when statusBar has totalCount', () => {
      const state = createState({ statusBar: { totalCount: 3, selectedCount: 0 } });

      expect(state.viewModels.value.statusBarConfig).not.toBeNull();
      expect(state.viewModels.value.statusBarConfig!.totalCount).toBe(3);
    });

    it('showEmptyInGrid is true when items empty and emptyState provided', () => {
      const state = createState({
        items: [],
        emptyState: {
          onClearAll: jest.fn(),
          hasActiveFilters: false,
          message: 'No items',
        },
      });

      expect(state.viewModels.value.showEmptyInGrid).toBe(true);
    });

    it('showEmptyInGrid is false when isLoading even with empty items', () => {
      const state = createState({
        items: [],
        isLoading: true,
        emptyState: {
          onClearAll: jest.fn(),
          hasActiveFilters: false,
          message: 'No items',
        },
      });

      expect(state.viewModels.value.showEmptyInGrid).toBe(false);
    });

    it('showEmptyInGrid is false when items are present', () => {
      const state = createState({
        emptyState: {
          onClearAll: jest.fn(),
          hasActiveFilters: false,
          message: 'No items',
        },
      });

      expect(state.viewModels.value.showEmptyInGrid).toBe(false);
    });

    it('headerFilterInput passes sort and filter props through', () => {
      const state = createState({
        sortBy: 'score',
        sortDirection: 'desc',
        filters: { name: { type: 'text', value: 'A' } },
      });

      expect(state.viewModels.value.headerFilterInput.sortBy).toBe('score');
      expect(state.viewModels.value.headerFilterInput.sortDirection).toBe('desc');
      expect(state.viewModels.value.headerFilterInput.filters).toEqual({
        name: { type: 'text', value: 'A' },
      });
    });
  });

  describe('pinning state', () => {
    it('initializes with empty pinned columns', () => {
      const state = createState();

      expect(state.pinning.value.pinnedColumns).toEqual({});
      expect(typeof state.pinning.value.pinColumn).toBe('function');
      expect(typeof state.pinning.value.unpinColumn).toBe('function');
      expect(typeof state.pinning.value.isPinned).toBe('function');
    });

    it('applies pinned column overrides from props', () => {
      const state = createState({
        pinnedColumns: { id: 'left' },
      });

      expect(state.pinning.value.pinnedColumns).toEqual({ id: 'left' });
      expect(state.pinning.value.isPinned('id')).toBe('left');
      expect(state.pinning.value.isPinned('name')).toBeUndefined();
    });

    it('flat columns reflect pinning overrides', () => {
      const state = createState({
        pinnedColumns: { id: 'left' },
      });

      const idCol = state.layout.value.flatColumns.find((c) => c.columnId === 'id');
      expect(idCol?.pinned).toBe('left');
    });

    it('exposes headerMenu state', () => {
      const state = createState();

      expect(state.pinning.value.headerMenu.isOpen).toBe(false);
      expect(state.pinning.value.headerMenu.openForColumn).toBeNull();
      expect(typeof state.pinning.value.headerMenu.open).toBe('function');
      expect(typeof state.pinning.value.headerMenu.close).toBe('function');
      expect(typeof state.pinning.value.headerMenu.handlePinLeft).toBe('function');
      expect(typeof state.pinning.value.headerMenu.handlePinRight).toBe('function');
    });
  });
});
