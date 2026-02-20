/**
 * Event wiring helper for OGrid (Vanilla JS).
 *
 * Extracts event subscription setup from OGrid for modularity:
 *   - initializeInteraction() — creates interaction states and subscribes events
 *   - attachGlobalHandlers() — global mouse handlers for resize and drag
 *
 * Not exported publicly — instantiated and owned by OGrid.
 */
import type { OGridOptions } from './types/gridTypes';
import type { GridState } from './state/GridState';
import type { TableRenderer } from './renderer/TableRenderer';
import { SelectionState } from './state/SelectionState';
import { KeyboardNavState } from './state/KeyboardNavState';
import { ClipboardState } from './state/ClipboardState';
import { UndoRedoState } from './state/UndoRedoState';
import { ColumnResizeState } from './state/ColumnResizeState';
import { FillHandleState } from './state/FillHandleState';
import { ColumnReorderState } from './state/ColumnReorderState';
import { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
import { InlineCellEditor } from './components/InlineCellEditor';
import { ContextMenu } from './components/ContextMenu';
import type { RowSelectionState } from './state/RowSelectionState';
import type { TableLayoutState } from './state/TableLayoutState';
import type { ColumnPinningState } from './state/ColumnPinningState';
import type { RowId } from '@alaarab/ogrid-core';
import { getCellCoordinates } from './utils/getCellCoordinates';

/**
 * Result of initializeInteraction — the created state objects and subscriptions.
 */
export interface InteractionResult<T> {
  selectionState: SelectionState;
  keyboardNavState: KeyboardNavState<T>;
  clipboardState: ClipboardState<T>;
  undoRedoState: UndoRedoState<T>;
  resizeState: ColumnResizeState;
  fillHandleState: FillHandleState<T>;
  reorderState: ColumnReorderState;
  marchingAnts: MarchingAntsOverlay | null;
  cellEditor: InlineCellEditor<T>;
  contextMenu: ContextMenu;
  unsubscribes: (() => void)[];
}

/**
 * Callbacks from OGrid needed by the event wiring.
 */
export interface EventWiringCallbacks<_T> {
  updateRendererInteractionState: () => void;
  updateDragAttributes: () => void;
  clearCachedDragCells: () => void;
  showContextMenu: (x: number, y: number) => void;
  startCellEdit: (rowId: RowId, columnId: string) => void;
}

export class OGridEventWiring<T> {
  /**
   * Creates all interaction states, subscribes to their events, and returns
   * the state objects so OGrid can store them.
   */
  initializeInteraction(
    options: OGridOptions<T>,
    state: GridState<T>,
    renderer: TableRenderer<T>,
    tableContainer: HTMLElement,
    layoutState: TableLayoutState,
    rowSelectionState: RowSelectionState<T> | null,
    pinningState: ColumnPinningState | null,
    callbacks: EventWiringCallbacks<T>,
  ): InteractionResult<T> {
    const { editable } = options;
    const colOffset = rowSelectionState ? 1 : 0;
    const unsubscribes: (() => void)[] = [];

    // Create interaction states
    const selectionState = new SelectionState();
    const resizeState = new ColumnResizeState();
    const contextMenu = new ContextMenu();
    const cellEditor = new InlineCellEditor<T>(tableContainer);

    // Undo/Redo (wraps onCellValueChanged if editable)
    const onCellValueChanged = options.onCellValueChanged;
    const undoRedoState = new UndoRedoState<T>(onCellValueChanged);

    // Clipboard
    const clipboardState = new ClipboardState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof ClipboardState<T>['prototype']['updateParams']>[0]['visibleCols'],
        colOffset,
        editable,
        onCellValueChanged: undoRedoState.getWrappedCallback(),
      },
      () => selectionState.activeCell ?? null,
      () => selectionState.selectionRange ?? null
    );

    // Fill handle
    const fillHandleState = new FillHandleState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof FillHandleState<T>['prototype']['updateParams']>[0]['visibleCols'],
        editable,
        onCellValueChanged: undoRedoState.getWrappedCallback(),
        colOffset,
        beginBatch: () => undoRedoState.beginBatch(),
        endBatch: () => undoRedoState.endBatch(),
      },
      () => selectionState.selectionRange ?? null,
      (range) => {
        selectionState.setSelectionRange(range);
        callbacks.updateRendererInteractionState();
      },
      (cell) => {
        selectionState.setActiveCell(cell);
      }
    );

    // Keyboard navigation
    const keyboardNavState = new KeyboardNavState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof KeyboardNavState<T>['prototype']['updateParams']>[0]['visibleCols'],
        colOffset,
        getRowId: state.getRowId,
        editable,
        onCellValueChanged: undoRedoState.getWrappedCallback(),
        onCopy: () => clipboardState.handleCopy(),
        onCut: () => clipboardState.handleCut(),
        onPaste: async () => { await clipboardState.handlePaste(); },
        onUndo: () => undoRedoState.undo(),
        onRedo: () => undoRedoState.redo(),
        onContextMenu: (x, y) => callbacks.showContextMenu(x, y),
        onStartEdit: (rowId, columnId) => callbacks.startCellEdit(rowId, columnId),
        clearClipboardRanges: () => clipboardState.clearClipboardRanges(),
      },
      () => selectionState.activeCell ?? null,
      () => selectionState.selectionRange ?? null,
      (cell) => selectionState.setActiveCell(cell),
      (range) => selectionState.setSelectionRange(range)
    );

    // Subscribe to selection changes
    unsubscribes.push(
      selectionState.onSelectionChange(() => {
        callbacks.updateRendererInteractionState();
      })
    );

    // Subscribe to clipboard range changes
    unsubscribes.push(
      clipboardState.onRangesChange(() => {
        callbacks.updateRendererInteractionState();
      })
    );

    // Subscribe to column resize changes
    unsubscribes.push(
      resizeState.onColumnWidthChange(() => {
        callbacks.updateRendererInteractionState();
      })
    );

    // Column reorder
    const reorderState = new ColumnReorderState();
    unsubscribes.push(
      reorderState.onStateChange(({ isDragging, dropIndicatorX }) => {
        renderer.updateDropIndicator(dropIndicatorX, isDragging);
      })
    );
    unsubscribes.push(
      reorderState.onReorder(({ columnOrder }) => {
        state.setColumnOrder(columnOrder);
      })
    );

    // Attach keyboard handler to wrapper
    const wrapper = renderer.getWrapperElement();
    let marchingAnts: MarchingAntsOverlay | null = null;
    if (wrapper) {
      wrapper.addEventListener('keydown', keyboardNavState.handleKeyDown);
      keyboardNavState.setWrapperRef(wrapper);
      fillHandleState.setWrapperRef(wrapper);

      // Initialize marching ants overlay
      marchingAnts = new MarchingAntsOverlay(wrapper, colOffset);
    }

    // Attach global mouse handlers for resize and drag
    const globalUnsubs = this.attachGlobalHandlers(
      selectionState,
      resizeState,
      layoutState,
      renderer,
      callbacks,
    );
    unsubscribes.push(...globalUnsubs);

    return {
      selectionState,
      keyboardNavState,
      clipboardState,
      undoRedoState,
      resizeState,
      fillHandleState,
      reorderState,
      marchingAnts,
      cellEditor,
      contextMenu,
      unsubscribes,
    };
  }

  private attachGlobalHandlers(
    selectionState: SelectionState,
    resizeState: ColumnResizeState,
    layoutState: TableLayoutState,
    renderer: TableRenderer<T>,
    callbacks: EventWiringCallbacks<T>,
  ): (() => void)[] {
    const unsubs: (() => void)[] = [];
    let resizing = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing && resizeState) {
        const newWidth = resizeState.updateResize(e.clientX);
        if (newWidth !== null && resizeState.resizingColumnId) {
          layoutState.setColumnOverride(resizeState.resizingColumnId, newWidth);
          callbacks.updateRendererInteractionState();
        }
      }
      if (selectionState?.isDragging) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TD') {
          const coords = getCellCoordinates(target);
          if (coords && coords.rowIndex >= 0 && coords.colIndex >= 0) {
            selectionState.updateDrag(coords.rowIndex, coords.colIndex, () => callbacks.updateDragAttributes());
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizing && resizeState) {
        const colId = resizeState.resizingColumnId;
        resizeState.endResize(e.clientX);
        if (colId) {
          const width = resizeState.getColumnWidth(colId);
          if (width) layoutState.setColumnOverride(colId, width);
        }
        resizing = false;
        document.body.style.cursor = '';
        callbacks.updateRendererInteractionState();
      }
      if (selectionState?.isDragging) {
        selectionState.endDrag();
        callbacks.clearCachedDragCells();
      }
    };

    const handleResizeStart = (columnId: string, clientX: number, currentWidth: number) => {
      resizing = true;
      document.body.style.cursor = 'col-resize';
      resizeState.startResize(columnId, clientX, currentWidth);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });

    unsubs.push(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });

    // Pass resize handler to renderer
    renderer.setInteractionState({
      activeCell: null,
      selectionRange: null,
      copyRange: null,
      cutRange: null,
      editingCell: null,
      columnWidths: {},
      onResizeStart: handleResizeStart,
    });

    return unsubs;
  }
}
