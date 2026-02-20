/**
 * Shared spreadsheet integration tests for Vue.
 * Each Vue UI package calls createSpreadsheetTests() to run these.
 * Tests useDataGridState composable interactions: cell selection, editing,
 * clipboard, context menu, keyboard navigation, undo/redo.
 */
import { ref, shallowRef } from 'vue';
import { useActiveCell } from '../composables/useActiveCell';
import { useCellEditing } from '../composables/useCellEditing';
import { useCellSelection } from '../composables/useCellSelection';
import { useClipboard } from '../composables/useClipboard';
import { useContextMenu } from '../composables/useContextMenu';
import { useKeyboardNavigation } from '../composables/useKeyboardNavigation';
import { useUndoRedo } from '../composables/useUndoRedo';
import { useRowSelection } from '../composables/useRowSelection';
import type { IColumnDef, ICellValueChangedEvent } from '../types';
import { fixtureRows, getRowId, type FixtureRow } from './fixtures';

const editableColumns: IColumnDef<FixtureRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true, cellEditor: 'text' },
  { columnId: 'status', name: 'Status', sortable: true, editable: true, cellEditor: 'text' },
];

export function createSpreadsheetTests(): void {
  describe('cell selection', () => {
    it('useActiveCell tracks active cell', () => {
      const { activeCell, setActiveCell } = useActiveCell();
      expect(activeCell.value).toBeNull();
      setActiveCell({ rowIndex: 0, columnIndex: 0 });
      expect(activeCell.value).toEqual({ rowIndex: 0, columnIndex: 0 });
    });

    it('useActiveCell deduplicates same coordinates', () => {
      const { activeCell, setActiveCell } = useActiveCell();
      setActiveCell({ rowIndex: 1, columnIndex: 2 });
      const first = activeCell.value;
      setActiveCell({ rowIndex: 1, columnIndex: 2 });
      // Should be same reference (no update)
      expect(activeCell.value).toBe(first);
    });

    it('useCellSelection initializes with null range', () => {
      const wrapperRef = shallowRef<HTMLElement | null>(null);
      const { selectionRange, isDragging } = useCellSelection({
        colOffset: 0,
        rowCount: ref(3),
        visibleColCount: ref(2),
        setActiveCell: () => {},
        wrapperRef,
      });
      expect(selectionRange.value).toBeNull();
      expect(isDragging.value).toBe(false);
    });

    it('setSelectionRange updates range', () => {
      const wrapperRef = shallowRef<HTMLElement | null>(null);
      const { selectionRange, setSelectionRange } = useCellSelection({
        colOffset: 0,
        rowCount: ref(3),
        visibleColCount: ref(2),
        setActiveCell: () => {},
        wrapperRef,
      });
      setSelectionRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      expect(selectionRange.value).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    });

    it('handleSelectAllCells selects entire grid', () => {
      const wrapperRef = shallowRef<HTMLElement | null>(null);
      const setActiveCell = jest.fn();
      const { selectionRange, handleSelectAllCells } = useCellSelection({
        colOffset: 0,
        rowCount: ref(3),
        visibleColCount: ref(2),
        setActiveCell,
        wrapperRef,
      });
      handleSelectAllCells();
      expect(selectionRange.value).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 1 });
      expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });
  });

  describe('cell editing', () => {
    it('useCellEditing initializes with null', () => {
      const { editingCell, pendingEditorValue } = useCellEditing();
      expect(editingCell.value).toBeNull();
      expect(pendingEditorValue.value).toBeUndefined();
    });

    it('setEditingCell opens editor', () => {
      const { editingCell, setEditingCell } = useCellEditing();
      setEditingCell({ rowId: '1', columnId: 'name' });
      expect(editingCell.value).toEqual({ rowId: '1', columnId: 'name' });
    });

    it('setEditingCell(null) closes editor', () => {
      const { editingCell, setEditingCell } = useCellEditing();
      setEditingCell({ rowId: '1', columnId: 'name' });
      setEditingCell(null);
      expect(editingCell.value).toBeNull();
    });

    it('setPendingEditorValue tracks pending value', () => {
      const { pendingEditorValue, setPendingEditorValue } = useCellEditing();
      setPendingEditorValue('new value');
      expect(pendingEditorValue.value).toBe('new value');
    });
  });

  describe('clipboard', () => {
    it('handleCopy writes TSV to clipboard', () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText, readText: jest.fn().mockResolvedValue('') },
        configurable: true,
      });

      const items = ref(fixtureRows);
      const visibleCols = ref(editableColumns);
      const selectionRange = shallowRef({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
      const activeCell = shallowRef({ rowIndex: 0, columnIndex: 0 });
      const onCellValueChanged = ref<((e: ICellValueChangedEvent<FixtureRow>) => void) | undefined>(jest.fn());

      const { handleCopy } = useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange,
        activeCell,
        editable: ref(true),
        onCellValueChanged,
      });

      handleCopy();
      expect(writeText).toHaveBeenCalled();
      const tsv = writeText.mock.calls[0][0];
      expect(tsv).toContain('Alpha');
      expect(tsv).toContain('Active');
    });

    it('handleCut sets cutRange', () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText, readText: jest.fn().mockResolvedValue('') },
        configurable: true,
      });

      const items = ref(fixtureRows);
      const visibleCols = ref(editableColumns);
      const selectionRange = shallowRef({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      const activeCell = shallowRef({ rowIndex: 0, columnIndex: 0 });
      const onCellValueChanged = ref<((e: ICellValueChangedEvent<FixtureRow>) => void) | undefined>(jest.fn());

      const { handleCut, cutRange } = useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange,
        activeCell,
        editable: ref(true),
        onCellValueChanged,
      });

      handleCut();
      expect(cutRange.value).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    });

    it('handlePaste calls onCellValueChanged for pasted cells', async () => {
      const readText = jest.fn().mockResolvedValue('Pasted1\tPasted2');
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText, writeText: jest.fn().mockResolvedValue(undefined) },
        configurable: true,
      });

      const onCellValueChanged = jest.fn();
      const items = ref(fixtureRows);
      const visibleCols = ref(editableColumns);
      const selectionRange = shallowRef({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      const activeCell = shallowRef({ rowIndex: 0, columnIndex: 0 });

      const { handlePaste } = useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange,
        activeCell,
        editable: ref(true),
        onCellValueChanged: ref(onCellValueChanged),
      });

      await handlePaste();
      expect(readText).toHaveBeenCalled();
      expect(onCellValueChanged).toHaveBeenCalled();
      const values = onCellValueChanged.mock.calls.map((c: unknown[]) => (c[0] as { newValue: unknown }).newValue);
      expect(values).toContain('Pasted1');
    });

    it('clearClipboardRanges clears copy and cut ranges', () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText, readText: jest.fn().mockResolvedValue('') },
        configurable: true,
      });

      const items = ref(fixtureRows);
      const visibleCols = ref(editableColumns);
      const selectionRange = shallowRef({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      const activeCell = shallowRef({ rowIndex: 0, columnIndex: 0 });
      const onCellValueChanged = ref<((e: ICellValueChangedEvent<FixtureRow>) => void) | undefined>(jest.fn());

      const { handleCopy, copyRange, clearClipboardRanges } = useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange,
        activeCell,
        editable: ref(true),
        onCellValueChanged,
      });

      handleCopy();
      expect(copyRange.value).not.toBeNull();
      clearClipboardRanges();
      expect(copyRange.value).toBeNull();
    });
  });

  describe('context menu', () => {
    it('useContextMenu initializes with null position', () => {
      const { contextMenuPosition } = useContextMenu();
      expect(contextMenuPosition.value).toBeNull();
    });

    it('handleCellContextMenu sets menu position', () => {
      const { contextMenuPosition, handleCellContextMenu } = useContextMenu();
      handleCellContextMenu({ clientX: 100, clientY: 200, preventDefault: jest.fn() });
      expect(contextMenuPosition.value).toEqual({ x: 100, y: 200 });
    });

    it('closeContextMenu resets position to null', () => {
      const { contextMenuPosition, handleCellContextMenu, closeContextMenu } = useContextMenu();
      handleCellContextMenu({ clientX: 50, clientY: 50, preventDefault: jest.fn() });
      expect(contextMenuPosition.value).not.toBeNull();
      closeContextMenu();
      expect(contextMenuPosition.value).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    function createKeyboardNav(overrides: { editable?: boolean; cellSelection?: boolean } = {}) {
      const items = ref(fixtureRows);
      const visibleCols = ref<IColumnDef<FixtureRow>[]>(editableColumns);
      const { activeCell, setActiveCell } = useActiveCell();
      const { editingCell, setEditingCell } = useCellEditing();
      const selectionRange = shallowRef<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
      const selectedRowIds = ref<Set<string>>(new Set());
      const onCellValueChanged = ref<((e: ICellValueChangedEvent<FixtureRow>) => void) | undefined>(jest.fn());

      // Start with an active cell
      setActiveCell({ rowIndex: 0, columnIndex: 0 });
      selectionRange.value = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };

      const { handleGridKeyDown } = useKeyboardNavigation({
        data: {
          items,
          visibleCols,
          colOffset: 0,
          hasCheckboxCol: ref(false),
          visibleColumnCount: ref(2),
          getRowId,
        },
        state: {
          activeCell,
          selectionRange,
          editingCell,
          selectedRowIds,
        },
        handlers: {
          setActiveCell,
          setSelectionRange: (r) => { selectionRange.value = r; },
          setEditingCell,
          handleRowCheckboxChange: jest.fn(),
          handleCopy: jest.fn(),
          handleCut: jest.fn(),
          handlePaste: jest.fn().mockResolvedValue(undefined),
          setContextMenu: jest.fn(),
        },
        features: {
          editable: ref(overrides.editable !== false ? true : false),
          onCellValueChanged,
          rowSelection: ref('none' as const),
          wrapperRef: shallowRef(null),
        },
      });

      return { handleGridKeyDown, activeCell, selectionRange, editingCell, setActiveCell };
    }

    it('ArrowDown moves active cell down', () => {
      const { handleGridKeyDown, activeCell } = createKeyboardNav();
      const e = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(activeCell.value).toEqual({ rowIndex: 1, columnIndex: 0 });
    });

    it('ArrowRight moves active cell right', () => {
      const { handleGridKeyDown, activeCell } = createKeyboardNav();
      const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(activeCell.value).toEqual({ rowIndex: 0, columnIndex: 1 });
    });

    it('Shift+ArrowDown extends selection range', () => {
      const { handleGridKeyDown, selectionRange } = createKeyboardNav();
      const e = new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(selectionRange.value?.endRow).toBe(1);
    });

    it('Tab moves to next column and wraps rows', () => {
      const { handleGridKeyDown, activeCell } = createKeyboardNav();
      // Tab: col 0 -> col 1
      const e1 = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(e1, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e1);
      expect(activeCell.value).toEqual({ rowIndex: 0, columnIndex: 1 });
      // Tab: col 1, row 0 -> col 0, row 1
      const e2 = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(e2, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e2);
      expect(activeCell.value).toEqual({ rowIndex: 1, columnIndex: 0 });
    });

    it('Home moves to first column', () => {
      const { handleGridKeyDown, activeCell, setActiveCell } = createKeyboardNav();
      setActiveCell({ rowIndex: 1, columnIndex: 1 });
      const e = new KeyboardEvent('keydown', { key: 'Home' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(activeCell.value?.columnIndex).toBe(0);
      expect(activeCell.value?.rowIndex).toBe(1);
    });

    it('End moves to last column', () => {
      const { handleGridKeyDown, activeCell } = createKeyboardNav();
      const e = new KeyboardEvent('keydown', { key: 'End' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(activeCell.value?.columnIndex).toBe(1);
    });

    it('Enter opens editor on editable cell', () => {
      const { handleGridKeyDown, editingCell } = createKeyboardNav({ editable: true });
      const e = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(editingCell.value).not.toBeNull();
      expect(editingCell.value?.rowId).toBe('1');
      expect(editingCell.value?.columnId).toBe('name');
    });

    it('F2 opens editor on editable cell', () => {
      const { handleGridKeyDown, editingCell } = createKeyboardNav({ editable: true });
      const e = new KeyboardEvent('keydown', { key: 'F2' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(editingCell.value).not.toBeNull();
    });

    it('Escape closes editor', () => {
      const { handleGridKeyDown, editingCell } = createKeyboardNav({ editable: true });
      // Open editor
      const enter = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(enter, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(enter);
      expect(editingCell.value).not.toBeNull();
      // Close editor
      const esc = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(esc, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(esc);
      expect(editingCell.value).toBeNull();
    });

    it('Escape when not editing clears active cell and selection', () => {
      const { handleGridKeyDown, activeCell, selectionRange } = createKeyboardNav();
      expect(activeCell.value).not.toBeNull();
      const e = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(activeCell.value).toBeNull();
      expect(selectionRange.value).toBeNull();
    });

    it('Ctrl+A selects all cells', () => {
      const { handleGridKeyDown, selectionRange } = createKeyboardNav();
      const e = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      Object.defineProperty(e, 'preventDefault', { value: jest.fn() });
      handleGridKeyDown(e);
      expect(selectionRange.value).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 1 });
    });
  });

  describe('undo/redo', () => {
    it('tracks edits and allows undo', () => {
      const onCellValueChanged = jest.fn();
      const undoRedo = useUndoRedo<FixtureRow>({ onCellValueChanged });
      expect(undoRedo.canUndo.value).toBe(false);
      expect(undoRedo.canRedo.value).toBe(false);

      // Make an edit
      undoRedo.onCellValueChanged?.({
        item: fixtureRows[0],
        columnId: 'name',
        oldValue: 'Alpha',
        newValue: 'Changed',
        rowIndex: 0,
      });
      expect(undoRedo.canUndo.value).toBe(true);
      expect(onCellValueChanged).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Changed' }));

      // Undo
      undoRedo.undo();
      expect(undoRedo.canUndo.value).toBe(false);
      expect(undoRedo.canRedo.value).toBe(true);
      // Undo calls onCellValueChanged with reversed old/new
      expect(onCellValueChanged).toHaveBeenLastCalledWith(expect.objectContaining({ oldValue: 'Changed', newValue: 'Alpha' }));
    });

    it('redo replays undone edit', () => {
      const onCellValueChanged = jest.fn();
      const undoRedo = useUndoRedo<FixtureRow>({ onCellValueChanged });

      undoRedo.onCellValueChanged?.({
        item: fixtureRows[0],
        columnId: 'name',
        oldValue: 'Alpha',
        newValue: 'Changed',
        rowIndex: 0,
      });
      undoRedo.undo();
      expect(undoRedo.canRedo.value).toBe(true);

      undoRedo.redo();
      expect(undoRedo.canRedo.value).toBe(false);
      expect(undoRedo.canUndo.value).toBe(true);
      expect(onCellValueChanged).toHaveBeenLastCalledWith(expect.objectContaining({ newValue: 'Changed' }));
    });

    it('batch groups multiple edits into single undo step', () => {
      const onCellValueChanged = jest.fn();
      const undoRedo = useUndoRedo<FixtureRow>({ onCellValueChanged });

      undoRedo.beginBatch();
      undoRedo.onCellValueChanged?.({
        item: fixtureRows[0], columnId: 'name', oldValue: 'Alpha', newValue: 'X', rowIndex: 0,
      });
      undoRedo.onCellValueChanged?.({
        item: fixtureRows[1], columnId: 'name', oldValue: 'Beta', newValue: 'Y', rowIndex: 1,
      });
      undoRedo.endBatch();

      expect(undoRedo.canUndo.value).toBe(true);
      // Single undo reverses both
      undoRedo.undo();
      expect(undoRedo.canUndo.value).toBe(false);
      // Both edits reversed (called in reverse order)
      const lastTwoCalls = onCellValueChanged.mock.calls.slice(-2);
      expect(lastTwoCalls[0][0].newValue).toBe('Beta'); // Y -> Beta (reversed)
      expect(lastTwoCalls[1][0].newValue).toBe('Alpha'); // X -> Alpha (reversed)
    });
  });

  describe('row selection', () => {
    it('useRowSelection tracks selected rows', () => {
      const items = ref(fixtureRows);
      const rowSelection = ref('multiple' as const);
      const controlledSelectedRows = ref<Set<string> | undefined>(undefined);

      const result = useRowSelection({
        items,
        getRowId,
        rowSelection,
        controlledSelectedRows,
        onSelectionChange: undefined,
      });

      expect(result.selectedRowIds.value.size).toBe(0);
      result.handleRowCheckboxChange('1', true, 0, false);
      expect(result.selectedRowIds.value.has('1')).toBe(true);
    });

    it('handleSelectAll selects all rows', () => {
      const items = ref(fixtureRows);
      const rowSelection = ref('multiple' as const);
      const controlledSelectedRows = ref<Set<string> | undefined>(undefined);

      const result = useRowSelection({
        items,
        getRowId,
        rowSelection,
        controlledSelectedRows,
        onSelectionChange: undefined,
      });

      result.handleSelectAll(true);
      expect(result.allSelected.value).toBe(true);
      expect(result.selectedRowIds.value.size).toBe(3);
    });

    it('handleSelectAll(false) deselects all', () => {
      const items = ref(fixtureRows);
      const rowSelection = ref('multiple' as const);
      const controlledSelectedRows = ref<Set<string> | undefined>(undefined);

      const result = useRowSelection({
        items,
        getRowId,
        rowSelection,
        controlledSelectedRows,
        onSelectionChange: undefined,
      });

      result.handleSelectAll(true);
      result.handleSelectAll(false);
      expect(result.selectedRowIds.value.size).toBe(0);
      expect(result.allSelected.value).toBe(false);
    });

    it('single mode replaces selection', () => {
      const items = ref(fixtureRows);
      const rowSelection = ref('single' as const);
      const controlledSelectedRows = ref<Set<string> | undefined>(undefined);

      const result = useRowSelection({
        items,
        getRowId,
        rowSelection,
        controlledSelectedRows,
        onSelectionChange: undefined,
      });

      result.handleRowCheckboxChange('1', true, 0, false);
      expect(result.selectedRowIds.value.has('1')).toBe(true);
      result.handleRowCheckboxChange('2', true, 1, false);
      expect(result.selectedRowIds.value.has('1')).toBe(false);
      expect(result.selectedRowIds.value.has('2')).toBe(true);
    });
  });
}
