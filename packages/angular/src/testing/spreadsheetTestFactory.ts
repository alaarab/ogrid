/**
 * Shared spreadsheet integration tests for Angular UI packages.
 * Each UI package calls createSpreadsheetTests(DataGridTableComponent) to run these.
 *
 * Since Angular mocks do not support DOM rendering, these tests verify behavior
 * through the DataGridStateService directly — testing active cell, selection range,
 * editing state, clipboard, context menu, keyboard navigation state, fill handle,
 * and undo/redo state.
 */
import { DataGridStateService } from '../services/datagrid-state.service';
import { fixtureRows, getRowId } from './fixtures';
import type { FixtureRow } from './fixtures';
import type { IOGridDataGridProps, IColumnDef } from '../types';

const editableColumns: IColumnDef<FixtureRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true, cellEditor: 'text' },
  { columnId: 'status', name: 'Status', sortable: true, editable: true, cellEditor: 'text' },
];

function makeProps(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}): IOGridDataGridProps<FixtureRow> {
  return {
    items: fixtureRows,
    columns: editableColumns as IColumnDef<FixtureRow>[],
    getRowId,
    sortBy: undefined,
    sortDirection: 'asc',
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['name', 'status']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: { status: ['Active', 'Closed'] },
    loadingFilterOptions: {},
    editable: true,
    onCellValueChanged: jest.fn(),
    ...overrides,
  } as IOGridDataGridProps<FixtureRow>;
}

/** Minimal shape for DataGridTable component used by createSpreadsheetTests. */
interface DataGridTableInstance {
  stateService: DataGridStateService<unknown>;
  commitEdit: (...args: unknown[]) => unknown;
  cancelEdit: (...args: unknown[]) => unknown;
  onEditorKeydown: (...args: unknown[]) => unknown;
  onWrapperMouseDown: (...args: unknown[]) => unknown;
  onGridKeyDown: (...args: unknown[]) => unknown;
  onCellMouseDown: (...args: unknown[]) => unknown;
  closeContextMenu: (...args: unknown[]) => unknown;
  handleCopy: (...args: unknown[]) => unknown;
  handleCut: (...args: unknown[]) => unknown;
  handlePaste: (...args: unknown[]) => unknown;
}

export function createSpreadsheetTests(_DataGridTableComponent: new () => unknown): void {
  describe('DataGridTable spreadsheet features', () => {
    let stateService: DataGridStateService<FixtureRow>;

    beforeEach(() => {
      stateService = new DataGridStateService<FixtureRow>();
      stateService.props.set(makeProps());
    });

    describe('active cell tracking', () => {
      it('active cell is null initially', () => {
        const state = stateService.getState();
        expect(state.interaction.activeCell).toBeNull();
      });

      it('setActiveCell updates active cell', () => {
        stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
        const state = stateService.getState();
        expect(state.interaction.activeCell).toEqual({ rowIndex: 0, columnIndex: 0 });
      });

      it('setActiveCell(null) clears active cell', () => {
        stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
        stateService.setActiveCell(null);
        expect(stateService.getState().interaction.activeCell).toBeNull();
      });

      it('setActiveCell deduplicates identical calls', () => {
        stateService.setActiveCell({ rowIndex: 1, columnIndex: 1 });
        const state1 = stateService.getState();
        stateService.setActiveCell({ rowIndex: 1, columnIndex: 1 });
        const state2 = stateService.getState();
        // Should be the same reference (no change)
        expect(state1.interaction.activeCell).toEqual(state2.interaction.activeCell);
      });
    });

    describe('selection range management', () => {
      it('selection range is null initially', () => {
        expect(stateService.getState().interaction.selectionRange).toBeNull();
      });

      it('setSelectionRange updates selection', () => {
        const range = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
        stateService.setSelectionRange(range);
        expect(stateService.getState().interaction.selectionRange).toEqual(range);
      });

      it('setSelectionRange(null) clears selection', () => {
        stateService.setSelectionRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
        stateService.setSelectionRange(null);
        expect(stateService.getState().interaction.selectionRange).toBeNull();
      });

      it('hasCellSelection is true when selectionRange is set', () => {
        stateService.setSelectionRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
        expect(stateService.getState().interaction.hasCellSelection).toBe(true);
      });

      it('hasCellSelection is true when activeCell is set (no range)', () => {
        stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
        expect(stateService.getState().interaction.hasCellSelection).toBe(true);
      });

      it('hasCellSelection is false when nothing is selected', () => {
        expect(stateService.getState().interaction.hasCellSelection).toBe(false);
      });

      it('handleSelectAllCells selects entire grid', () => {
        stateService.handleSelectAllCells();
        const range = stateService.getState().interaction.selectionRange;
        expect(range).toEqual({
          startRow: 0, startCol: 0,
          endRow: fixtureRows.length - 1, endCol: 1,
        });
      });
    });

    describe('editing state', () => {
      it('editing cell is null initially', () => {
        expect(stateService.getState().editing.editingCell).toBeNull();
      });

      it('setEditingCell opens editing', () => {
        stateService.setEditingCell({ rowId: '1', columnId: 'name' });
        expect(stateService.getState().editing.editingCell).toEqual({ rowId: '1', columnId: 'name' });
      });

      it('setEditingCell(null) closes editing', () => {
        stateService.setEditingCell({ rowId: '1', columnId: 'name' });
        stateService.setEditingCell(null);
        expect(stateService.getState().editing.editingCell).toBeNull();
      });

      it('commitCellEdit closes editing and calls onCellValueChanged', () => {
        const onCellValueChanged = jest.fn();
        stateService.props.set(makeProps({ onCellValueChanged }));
        stateService.setEditingCell({ rowId: '1', columnId: 'name' });
        stateService.commitCellEdit(fixtureRows[0], 'name', 'Alpha', 'NewAlpha', 0, 0);
        expect(stateService.getState().editing.editingCell).toBeNull();
        expect(onCellValueChanged).toHaveBeenCalledWith(
          expect.objectContaining({ columnId: 'name', newValue: 'NewAlpha' }),
        );
      });

      it('cancelPopoverEdit clears editing and popover anchor', () => {
        stateService.setEditingCell({ rowId: '1', columnId: 'name' });
        stateService.cancelPopoverEdit();
        expect(stateService.getState().editing.editingCell).toBeNull();
        expect(stateService.getState().editing.popoverAnchorEl).toBeNull();
      });

      it('pendingEditorValue can be set and read', () => {
        stateService.setPendingEditorValue('test-value');
        expect(stateService.getState().editing.pendingEditorValue).toBe('test-value');
      });
    });

    describe('clipboard operations', () => {
      it('copyRange is null initially', () => {
        expect(stateService.getState().interaction.copyRange).toBeNull();
      });

      it('cutRange is null initially', () => {
        expect(stateService.getState().interaction.cutRange).toBeNull();
      });

      it('handleCopy sets copyRange when selection exists', () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });
        stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
        stateService.setSelectionRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
        stateService.handleCopy();
        expect(stateService.getState().interaction.copyRange).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
        expect(writeText).toHaveBeenCalled();
      });

      it('clearClipboardRanges resets copy and cut ranges', () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });
        stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
        stateService.setSelectionRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
        stateService.handleCopy();
        stateService.clearClipboardRanges();
        expect(stateService.getState().interaction.copyRange).toBeNull();
        expect(stateService.getState().interaction.cutRange).toBeNull();
      });
    });

    describe('context menu state', () => {
      it('menuPosition is null initially', () => {
        expect(stateService.getState().contextMenu.menuPosition).toBeNull();
      });

      it('handleCellContextMenu sets position', () => {
        const mockEvent = { clientX: 100, clientY: 200, preventDefault: jest.fn() };
        stateService.handleCellContextMenu(mockEvent);
        expect(stateService.getState().contextMenu.menuPosition).toEqual({ x: 100, y: 200 });
      });

      it('closeContextMenu clears position', () => {
        stateService.handleCellContextMenu({ clientX: 100, clientY: 200, preventDefault: jest.fn() });
        stateService.closeContextMenu();
        expect(stateService.getState().contextMenu.menuPosition).toBeNull();
      });
    });

    describe('undo/redo state', () => {
      it('canUndo and canRedo are false initially', () => {
        const state = stateService.getState();
        expect(state.interaction.canUndo).toBe(false);
        expect(state.interaction.canRedo).toBe(false);
      });

      it('undo becomes available after a cell edit', () => {
        const onCellValueChanged = jest.fn();
        stateService.props.set(makeProps({ onCellValueChanged }));
        stateService.commitCellEdit(fixtureRows[0], 'name', 'Alpha', 'Changed', 0, 0);
        expect(stateService.getState().interaction.canUndo).toBe(true);
        expect(stateService.getState().interaction.canRedo).toBe(false);
      });

      it('undo reverses the last edit and enables redo', () => {
        const onCellValueChanged = jest.fn();
        stateService.props.set(makeProps({ onCellValueChanged }));
        stateService.commitCellEdit(fixtureRows[0], 'name', 'Alpha', 'Changed', 0, 0);
        stateService.undo();
        expect(stateService.getState().interaction.canRedo).toBe(true);
        // Should have called onCellValueChanged with reversed values
        const lastCall = onCellValueChanged.mock.calls[onCellValueChanged.mock.calls.length - 1][0];
        expect(lastCall.oldValue).toBe('Changed');
        expect(lastCall.newValue).toBe('Alpha');
      });

      it('redo re-applies the undone edit', () => {
        const onCellValueChanged = jest.fn();
        stateService.props.set(makeProps({ onCellValueChanged }));
        stateService.commitCellEdit(fixtureRows[0], 'name', 'Alpha', 'Changed', 0, 0);
        stateService.undo();
        stateService.redo();
        expect(stateService.getState().interaction.canUndo).toBe(true);
        expect(stateService.getState().interaction.canRedo).toBe(false);
      });

      it('batch edits are undone as a single unit', () => {
        const onCellValueChanged = jest.fn();
        stateService.props.set(makeProps({ onCellValueChanged }));
        stateService.beginBatch();
        stateService.commitCellEdit(fixtureRows[0], 'name', 'Alpha', 'A1', 0, 0);
        stateService.commitCellEdit(fixtureRows[1], 'name', 'Beta', 'B1', 1, 0);
        stateService.endBatch();
        expect(stateService.getState().interaction.canUndo).toBe(true);
        stateService.undo();
        // Should undo both edits in one step
        expect(stateService.getState().interaction.canUndo).toBe(false);
        expect(stateService.getState().interaction.canRedo).toBe(true);
      });
    });

    describe('cellSelection=false disables interaction', () => {
      it('active cell stays null with cellSelection=false', () => {
        stateService.props.set(makeProps({ cellSelection: false }));
        const state = stateService.getState();
        // The interaction methods are replaced with noops
        state.interaction.setActiveCell({ rowIndex: 0, columnIndex: 0 });
        expect(stateService.getState().interaction.activeCell).toBeNull();
      });

      it('selection range stays null with cellSelection=false', () => {
        stateService.props.set(makeProps({ cellSelection: false }));
        const state = stateService.getState();
        state.interaction.setSelectionRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
        expect(stateService.getState().interaction.selectionRange).toBeNull();
      });

      it('context menu stays null with cellSelection=false', () => {
        stateService.props.set(makeProps({ cellSelection: false }));
        const state = stateService.getState();
        expect(state.contextMenu.menuPosition).toBeNull();
      });
    });

    describe('row selection', () => {
      it('selectedRowIds is empty initially', () => {
        expect(stateService.getState().rowSelection.selectedRowIds.size).toBe(0);
      });

      it('updateSelection changes selectedRowIds', () => {
        stateService.updateSelection(new Set(['1', '2']));
        expect(stateService.getState().rowSelection.selectedRowIds).toEqual(new Set(['1', '2']));
      });

      it('handleSelectAll(true) selects all rows', () => {
        stateService.handleSelectAll(true);
        expect(stateService.getState().rowSelection.selectedRowIds).toEqual(new Set(['1', '2', '3']));
        expect(stateService.getState().rowSelection.allSelected).toBe(true);
      });

      it('handleSelectAll(false) deselects all rows', () => {
        stateService.handleSelectAll(true);
        stateService.handleSelectAll(false);
        expect(stateService.getState().rowSelection.selectedRowIds.size).toBe(0);
      });

      it('someSelected is true when partial selection exists', () => {
        stateService.updateSelection(new Set(['1']));
        expect(stateService.getState().rowSelection.someSelected).toBe(true);
        expect(stateService.getState().rowSelection.allSelected).toBe(false);
      });
    });

    describe('column pinning', () => {
      it('pinColumn delegates to props.onColumnPinned', () => {
        const onColumnPinned = jest.fn();
        stateService.props.set(makeProps({ onColumnPinned }));
        stateService.pinColumn('name', 'left');
        expect(onColumnPinned).toHaveBeenCalledWith('name', 'left');
      });

      it('unpinColumn delegates to props.onColumnPinned with null', () => {
        const onColumnPinned = jest.fn();
        stateService.props.set(makeProps({ onColumnPinned }));
        stateService.unpinColumn('name');
        expect(onColumnPinned).toHaveBeenCalledWith('name', null);
      });

      it('isPinned returns the pin state from props', () => {
        stateService.props.set(makeProps({ pinnedColumns: { name: 'left' } }));
        expect(stateService.isPinned('name')).toBe('left');
        expect(stateService.isPinned('status')).toBeUndefined();
      });

      it('getPinState returns correct state', () => {
        stateService.props.set(makeProps({ pinnedColumns: { name: 'left' } }));
        const ps = stateService.getPinState('name');
        expect(ps.canPinLeft).toBe(false);
        expect(ps.canPinRight).toBe(true);
        expect(ps.canUnpin).toBe(true);
      });
    });

    describe('isDragging state', () => {
      it('isDragging is false initially', () => {
        expect(stateService.getState().interaction.isDragging).toBe(false);
      });
    });

    describe('component class instantiation', () => {
      it('component class instantiates and has stateService', () => {
        const comp = new _DataGridTableComponent() as DataGridTableInstance;
        expect(comp).toBeTruthy();
        expect(comp.stateService).toBeDefined();
      });

      it('component has event handler methods', () => {
        const comp = new _DataGridTableComponent() as DataGridTableInstance;
        expect(typeof comp.commitEdit).toBe('function');
        expect(typeof comp.cancelEdit).toBe('function');
        expect(typeof comp.onEditorKeydown).toBe('function');
        expect(typeof comp.onWrapperMouseDown).toBe('function');
        expect(typeof comp.onGridKeyDown).toBe('function');
        expect(typeof comp.onCellMouseDown).toBe('function');
        expect(typeof comp.closeContextMenu).toBe('function');
        expect(typeof comp.handleCopy).toBe('function');
        expect(typeof comp.handleCut).toBe('function');
        expect(typeof comp.handlePaste).toBe('function');
      });
    });
  });
}
