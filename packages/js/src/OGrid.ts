import type { OGridOptions, OGridEvents } from './types/gridTypes';
import type { IOGridApi, ICellValueChangedEvent } from '@alaarab/ogrid-core';
import { GridState } from './state/GridState';
import { TableRenderer } from './renderer/TableRenderer';
import { PaginationControls } from './components/PaginationControls';
import { StatusBar } from './components/StatusBar';
import { ColumnChooser } from './components/ColumnChooser';
import { SelectionState } from './state/SelectionState';
import { KeyboardNavState } from './state/KeyboardNavState';
import { ClipboardState } from './state/ClipboardState';
import { UndoRedoState } from './state/UndoRedoState';
import { ColumnResizeState } from './state/ColumnResizeState';
import { InlineCellEditor } from './components/InlineCellEditor';
import { ContextMenu } from './components/ContextMenu';
import { EventEmitter } from './state/EventEmitter';
import type { RowId } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, isInSelectionRange } from '@alaarab/ogrid-core';

export class OGrid<T> {
  private state: GridState<T>;
  private renderer: TableRenderer<T>;
  private pagination: PaginationControls<T>;
  private statusBar: StatusBar<T>;
  private columnChooser: ColumnChooser<T>;

  // Interaction states
  private selectionState: SelectionState | null = null;
  private keyboardNavState: KeyboardNavState<T> | null = null;
  private clipboardState: ClipboardState<T> | null = null;
  private undoRedoState: UndoRedoState<T> | null = null;
  private resizeState: ColumnResizeState | null = null;
  private cellEditor: InlineCellEditor<T> | null = null;
  private contextMenu: ContextMenu | null = null;

  private events = new EventEmitter<OGridEvents<T>>();
  private unsubscribes: (() => void)[] = [];
  private containerEl: HTMLElement;
  private tableContainer: HTMLElement;
  private toolbarEl: HTMLElement;
  private paginationContainer: HTMLElement;
  private statusBarContainer: HTMLElement;
  private options: OGridOptions<T>;

  /** The imperative grid API (same interface as React's IOGridApi). */
  readonly api: IOGridApi<T>;

  constructor(container: HTMLElement, options: OGridOptions<T>) {
    this.options = options;
    this.state = new GridState<T>(options);
    this.api = this.state.getApi();

    // Build layout
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'ogrid-container';

    // Toolbar
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'ogrid-toolbar';
    this.containerEl.appendChild(this.toolbarEl);

    // Table container
    this.tableContainer = document.createElement('div');
    this.tableContainer.className = 'ogrid-table-container';
    this.containerEl.appendChild(this.tableContainer);

    // Status bar container
    this.statusBarContainer = document.createElement('div');
    this.statusBarContainer.className = 'ogrid-status-bar-container';
    this.containerEl.appendChild(this.statusBarContainer);

    // Pagination container
    this.paginationContainer = document.createElement('div');
    this.paginationContainer.className = 'ogrid-pagination-container';
    this.containerEl.appendChild(this.paginationContainer);

    container.appendChild(this.containerEl);

    // Create sub-components
    this.renderer = new TableRenderer<T>(this.tableContainer, this.state);
    this.pagination = new PaginationControls<T>(this.paginationContainer, this.state);
    this.statusBar = new StatusBar<T>(this.statusBarContainer);
    this.columnChooser = new ColumnChooser<T>(this.toolbarEl, this.state);

    // Initial render (must happen before interaction init so wrapper DOM exists)
    this.renderer.render();

    // Initialize interaction features if enabled (default: true for cellSelection)
    const shouldEnableInteraction = options.cellSelection !== false || options.editable === true;
    if (shouldEnableInteraction) {
      this.initializeInteraction();
    }

    // Subscribe to state changes
    this.unsubscribes.push(
      this.state.onStateChange(() => {
        this.renderAll();
      })
    );

    // Complete initial render (pagination, status bar, column chooser)
    this.renderAll();
  }

  private initializeInteraction(): void {
    const { cellSelection, editable } = this.options;

    // Create interaction states
    this.selectionState = new SelectionState();
    this.resizeState = new ColumnResizeState();
    this.contextMenu = new ContextMenu();
    this.cellEditor = new InlineCellEditor<T>(this.tableContainer);

    // Undo/Redo (wraps onCellValueChanged if editable)
    const onCellValueChanged = this.options.onCellValueChanged;
    this.undoRedoState = new UndoRedoState<T>(onCellValueChanged);

    // Clipboard
    this.clipboardState = new ClipboardState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof ClipboardState<T>['prototype']['updateParams']>[0]['visibleCols'],
        colOffset: 0,
        editable,
        onCellValueChanged: this.undoRedoState.getWrappedCallback(),
      },
      () => this.selectionState?.activeCell ?? null,
      () => this.selectionState?.selectionRange ?? null
    );

    // Keyboard navigation
    this.keyboardNavState = new KeyboardNavState<T>(
      {
        items: [],
        visibleCols: [] as unknown as Parameters<typeof KeyboardNavState<T>['prototype']['updateParams']>[0]['visibleCols'],
        colOffset: 0,
        getRowId: this.state.getRowId,
        editable,
        onCellValueChanged: this.undoRedoState.getWrappedCallback(),
        onCopy: () => this.clipboardState?.handleCopy(),
        onCut: () => this.clipboardState?.handleCut(),
        onPaste: async () => { await this.clipboardState?.handlePaste(); },
        onUndo: () => this.undoRedoState?.undo(),
        onRedo: () => this.undoRedoState?.redo(),
        onContextMenu: (x, y) => this.showContextMenu(x, y),
        onStartEdit: (rowId, columnId) => this.startCellEdit(rowId, columnId),
        clearClipboardRanges: () => this.clipboardState?.clearClipboardRanges(),
      },
      () => this.selectionState?.activeCell ?? null,
      () => this.selectionState?.selectionRange ?? null,
      (cell) => this.selectionState?.setActiveCell(cell),
      (range) => this.selectionState?.setSelectionRange(range)
    );

    // Subscribe to selection changes
    this.unsubscribes.push(
      this.selectionState.onSelectionChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Subscribe to clipboard range changes
    this.unsubscribes.push(
      this.clipboardState.onRangesChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Subscribe to column resize changes
    this.unsubscribes.push(
      this.resizeState.onColumnWidthChange(() => {
        this.updateRendererInteractionState();
      })
    );

    // Attach keyboard handler to wrapper
    const wrapper = this.renderer.getWrapperElement();
    if (wrapper) {
      wrapper.addEventListener('keydown', this.keyboardNavState.handleKeyDown);
      this.keyboardNavState.setWrapperRef(wrapper);
    }

    // Attach global mouse handlers for resize and drag
    this.attachGlobalHandlers();

    // Set initial interaction state on renderer
    this.updateRendererInteractionState();
  }

  private attachGlobalHandlers(): void {
    let resizing = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing && this.resizeState) {
        const newWidth = this.resizeState.updateResize(e.clientX);
        if (newWidth !== null) {
          this.updateRendererInteractionState();
        }
      }
      if (this.selectionState?.isDragging) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TD') {
          const rowIndex = parseInt(target.getAttribute('data-row-index') ?? '-1', 10);
          const colIndex = parseInt(target.getAttribute('data-col-index') ?? '-1', 10);
          if (rowIndex >= 0 && colIndex >= 0) {
            this.selectionState.updateDrag(rowIndex, colIndex, () => this.updateDragAttributes());
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (resizing && this.resizeState) {
        resizing = false;
        document.body.style.cursor = '';
        this.updateRendererInteractionState();
      }
      if (this.selectionState?.isDragging) {
        this.selectionState.endDrag();
      }
    };

    const handleResizeStart = (columnId: string, clientX: number, currentWidth: number) => {
      resizing = true;
      document.body.style.cursor = 'col-resize';
      this.resizeState?.startResize(columnId, clientX, currentWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Store references for cleanup
    this.unsubscribes.push(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });

    // Pass resize handler to renderer
    this.renderer.setInteractionState({
      activeCell: null,
      selectionRange: null,
      copyRange: null,
      cutRange: null,
      editingCell: null,
      columnWidths: {},
      onResizeStart: handleResizeStart,
    });
  }

  private updateRendererInteractionState(): void {
    if (!this.selectionState || !this.clipboardState || !this.resizeState) return;

    this.renderer.setInteractionState({
      activeCell: this.selectionState.activeCell,
      selectionRange: this.selectionState.selectionRange,
      copyRange: this.clipboardState.copyRange,
      cutRange: this.clipboardState.cutRange,
      editingCell: this.cellEditor ? { rowId: '', columnId: '' } : null, // TODO: track editing cell
      columnWidths: this.resizeState.getAllColumnWidths(),
      onCellClick: (rowIndex, colIndex) => this.handleCellClick(rowIndex, colIndex),
      onCellMouseDown: (rowIndex, colIndex, e) => this.handleCellMouseDown(rowIndex, colIndex, e),
      onCellDoubleClick: (rowIndex, colIndex, rowId, columnId) => this.startCellEdit(rowId, columnId),
      onCellContextMenu: (rowIndex, colIndex, e) => this.handleCellContextMenu(rowIndex, colIndex, e),
      onResizeStart: this.renderer['interactionState']?.onResizeStart,
    });

    this.renderer.update();
  }

  private updateDragAttributes(): void {
    const wrapper = this.renderer.getWrapperElement();
    if (!wrapper || !this.selectionState) return;

    const range = this.selectionState.getDragRange();
    if (!range) return;

    const norm = normalizeSelectionRange(range);
    const cells = wrapper.querySelectorAll('td[data-row-index][data-col-index]');

    for (const cell of Array.from(cells)) {
      const rowIndex = parseInt((cell as HTMLElement).getAttribute('data-row-index') ?? '-1', 10);
      const colIndex = parseInt((cell as HTMLElement).getAttribute('data-col-index') ?? '-1', 10);

      if (isInSelectionRange(norm, rowIndex, colIndex)) {
        (cell as HTMLElement).setAttribute('data-drag-range', 'true');
      } else {
        (cell as HTMLElement).removeAttribute('data-drag-range');
      }
    }
  }

  private handleCellClick(rowIndex: number, colIndex: number): void {
    if (!this.selectionState) return;
    this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex });
    this.updateRendererInteractionState();
  }

  private handleCellMouseDown(rowIndex: number, colIndex: number, e: MouseEvent): void {
    if (!this.selectionState) return;
    e.preventDefault();
    this.selectionState.startDrag(rowIndex, colIndex);
  }

  private handleCellContextMenu(rowIndex: number, colIndex: number, e: MouseEvent): void {
    e.preventDefault();
    if (!this.contextMenu || !this.selectionState || !this.clipboardState || !this.undoRedoState) return;

    // Set active cell if not already set
    if (!this.selectionState.activeCell || this.selectionState.activeCell.rowIndex !== rowIndex || this.selectionState.activeCell.columnIndex !== colIndex) {
      this.selectionState.setActiveCell({ rowIndex, columnIndex: colIndex });
      this.updateRendererInteractionState();
    }

    this.showContextMenu(e.clientX, e.clientY);
  }

  private showContextMenu(x: number, y: number): void {
    if (!this.contextMenu || !this.clipboardState || !this.undoRedoState || !this.keyboardNavState || !this.selectionState) return;

    this.contextMenu.show(
      x,
      y,
      {
        onCopy: () => this.clipboardState!.handleCopy(),
        onCut: () => this.clipboardState!.handleCut(),
        onPaste: () => void this.clipboardState!.handlePaste(),
        onSelectAll: () => {
          const { items } = this.state.getProcessedItems();
          const visibleCols = this.state.visibleColumnDefs;
          if (items.length > 0 && visibleCols.length > 0) {
            this.selectionState!.setSelectionRange({
              startRow: 0,
              startCol: 0,
              endRow: items.length - 1,
              endCol: visibleCols.length - 1,
            });
            this.updateRendererInteractionState();
          }
        },
        onUndo: () => this.undoRedoState!.undo(),
        onRedo: () => this.undoRedoState!.redo(),
      },
      this.undoRedoState.canUndo,
      this.undoRedoState.canRedo,
      this.selectionState.selectionRange
    );
  }

  private startCellEdit(rowId: RowId, columnId: string): void {
    if (!this.cellEditor || !this.undoRedoState) return;

    const { items } = this.state.getProcessedItems();
    const visibleCols = this.state.visibleColumnDefs;
    const item = items.find((it) => this.state.getRowId(it) === rowId);
    const column = visibleCols.find((col) => col.columnId === columnId);

    if (!item || !column) return;

    const wrapper = this.renderer.getWrapperElement();
    if (!wrapper) return;

    // Find the row first, then the cell within it
    const row = wrapper.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;

    const cell = row.querySelector(`td[data-column-id="${columnId}"]`) as HTMLTableCellElement | null;
    if (!cell) return;

    const onCommit = (rid: RowId, cid: string, value: unknown) => {
      const itm = items.find((i) => this.state.getRowId(i) === rid);
      const col = visibleCols.find((c) => c.columnId === cid);
      if (!itm || !col) return;

      const oldValue = (itm as Record<string, unknown>)[cid];
      (itm as Record<string, unknown>)[cid] = value;

      const wrapped = this.undoRedoState!.getWrappedCallback();
      if (wrapped) {
        wrapped({
          item: itm,
          columnId: cid,
          oldValue,
          newValue: value,
          rowIndex: items.indexOf(itm),
        });
      }

      this.updateRendererInteractionState();
    };

    const onCancel = () => {
      this.updateRendererInteractionState();
    };

    this.cellEditor.startEdit(rowId, columnId, item, column, cell, onCommit, onCancel);
  }

  private renderAll(): void {
    // Update interaction states with current data
    if (this.keyboardNavState && this.clipboardState) {
      const { items } = this.state.getProcessedItems();
      const visibleCols = this.state.visibleColumnDefs;
      const colOffset = 0; // No checkbox column in vanilla JS yet

      this.keyboardNavState.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof this.keyboardNavState.updateParams>[0]['visibleCols'],
        colOffset,
        getRowId: this.state.getRowId,
        editable: this.options.editable,
        onCellValueChanged: this.undoRedoState?.getWrappedCallback(),
        onCopy: () => this.clipboardState?.handleCopy(),
        onCut: () => this.clipboardState?.handleCut(),
        onPaste: async () => { await this.clipboardState?.handlePaste(); },
        onUndo: () => this.undoRedoState?.undo(),
        onRedo: () => this.undoRedoState?.redo(),
        onContextMenu: (x, y) => this.showContextMenu(x, y),
        onStartEdit: (rowId, columnId) => this.startCellEdit(rowId, columnId),
        clearClipboardRanges: () => this.clipboardState?.clearClipboardRanges(),
      });

      this.clipboardState.updateParams({
        items,
        visibleCols: visibleCols as unknown as Parameters<typeof this.clipboardState.updateParams>[0]['visibleCols'],
        colOffset,
        editable: this.options.editable,
        onCellValueChanged: this.undoRedoState?.getWrappedCallback(),
      });

      // Update renderer interaction state before rendering
      this.updateRendererInteractionState();
    } else {
      this.renderer.update();
    }

    const { totalCount } = this.state.getProcessedItems();
    this.pagination.render(totalCount);
    this.statusBar.render({ totalCount });
    this.columnChooser.render();
  }

  /** Subscribe to grid events. */
  on<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.on(event, handler);
  }

  /** Unsubscribe from grid events. */
  off<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.off(event, handler);
  }

  /** Clean up all event listeners and DOM. */
  destroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.renderer.destroy();
    this.pagination.destroy();
    this.statusBar.destroy();
    this.columnChooser.destroy();
    this.state.destroy();
    this.selectionState?.destroy();
    this.clipboardState?.destroy();
    this.undoRedoState?.destroy();
    this.resizeState?.destroy();
    this.cellEditor?.closeEditor();
    this.contextMenu?.close();
    this.events.removeAllListeners();
    this.containerEl.remove();
  }
}
