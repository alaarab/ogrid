import { signal, computed } from '@angular/core';
import {
  getCellValue,
  normalizeSelectionRange,
  parseValue,
  UndoRedoStack,
  findCtrlArrowTarget,
  computeTabNavigation,
  formatSelectionAsTsv,
  parseTsvClipboard,
  rangesEqual,
  applyFillValues,
  applyCellDeletion,
  getScrollTopForRow,
} from '@alaarab/ogrid-core';
import type {
  RowId,
  IActiveCell,
  ISelectionRange,
  ICellValueChangedEvent,
} from '../types';
import type { IColumnDef as IAngularColumnDef } from '../types';


type IColumnDef<T> = IAngularColumnDef<T>;

/**
 * Manages cell selection, keyboard navigation, clipboard, fill handle, and undo/redo.
 * Extracted from DataGridStateService for modularity.
 *
 * Not @Injectable — instantiated and owned by DataGridStateService.
 */
export class DataGridInteractionHelper<T> {
  // --- Signals ---
  readonly activeCellSig = signal<IActiveCell | null>(null);
  readonly selectionRangeSig = signal<ISelectionRange | null>(null);
  readonly isDraggingSig = signal<boolean>(false);
  readonly contextMenuPositionSig = signal<{ x: number; y: number } | null>(null);
  readonly cutRangeSig = signal<ISelectionRange | null>(null);
  readonly copyRangeSig = signal<ISelectionRange | null>(null);
  private internalClipboard: string | null = null;

  // Undo/redo
  readonly undoRedoStack = new UndoRedoStack<ICellValueChangedEvent<T>>(100);
  readonly undoLengthSig = signal<number>(0);
  readonly redoLengthSig = signal<number>(0);
  readonly canUndo = computed(() => this.undoLengthSig() > 0);
  readonly canRedo = computed(() => this.redoLengthSig() > 0);
  readonly hasCellSelection = computed(() => this.selectionRangeSig() != null || this.activeCellSig() != null);

  // Fill handle state
  fillDragStart: { startRow: number; startCol: number } | null = null;
  fillRafId = 0;
  fillMoveHandler: ((e: MouseEvent) => void) | null = null;
  fillUpHandler: (() => void) | null = null;

  // Drag selection refs
  dragStartPos: { row: number; col: number } | null = null;
  dragMoved = false;
  isDraggingRef = false;
  liveDragRange: ISelectionRange | null = null;
  rafId = 0;
  lastMousePos: { cx: number; cy: number } | null = null;
  autoScrollInterval: ReturnType<typeof setInterval> | null = null;

  setActiveCell(cell: IActiveCell | null): void {
    const prev = this.activeCellSig();
    if (prev === cell) return;
    if (prev && cell && prev.rowIndex === cell.rowIndex && prev.columnIndex === cell.columnIndex) return;
    this.activeCellSig.set(cell);
  }

  setSelectionRange(range: ISelectionRange | null): void {
    const prev = this.selectionRangeSig();
    if (rangesEqual(prev, range)) return;
    this.selectionRangeSig.set(range);
  }

  // --- Context menu ---
  setContextMenuPosition(pos: { x: number; y: number } | null): void {
    this.contextMenuPositionSig.set(pos);
  }

  handleCellContextMenu(e: { clientX: number; clientY: number; preventDefault?: () => void }): void {
    e.preventDefault?.();
    this.contextMenuPositionSig.set({ x: e.clientX, y: e.clientY });
  }

  closeContextMenu(): void {
    this.contextMenuPositionSig.set(null);
  }

  // --- Clipboard ---
  handleCopy(
    items: T[],
    visibleCols: IColumnDef<T>[],
    colOffset: number
  ): void {
    const range = this.getEffectiveRange(colOffset);
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const tsv = formatSelectionAsTsv(items, visibleCols, norm);
    this.internalClipboard = tsv;
    this.copyRangeSig.set(norm);
    void navigator.clipboard.writeText(tsv).catch(() => {});
  }

  handleCut(
    items: T[],
    visibleCols: IColumnDef<T>[],
    colOffset: number,
    editable: boolean | undefined,
    wrappedOnCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined
  ): void {
    if (editable === false) return;
    const range = this.getEffectiveRange(colOffset);
    if (range == null || !wrappedOnCellValueChanged) return;
    const norm = normalizeSelectionRange(range);
    this.cutRangeSig.set(norm);
    this.copyRangeSig.set(null);
    this.handleCopy(items, visibleCols, colOffset);
    this.copyRangeSig.set(null);
  }

  async handlePaste(
    items: T[],
    visibleCols: IColumnDef<T>[],
    colOffset: number,
    editable: boolean | undefined,
    wrappedOnCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined
  ): Promise<void> {
    if (editable === false) return;
    if (!wrappedOnCellValueChanged) return;

    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }
    if (!text.trim() && this.internalClipboard != null) {
      text = this.internalClipboard;
    }
    if (!text.trim()) return;

    const norm = this.getEffectiveRange(colOffset);
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const parsedRows = parseTsvClipboard(text);

    this.beginBatch();
    for (let r = 0; r < parsedRows.length; r++) {
      const cells = parsedRows[r];
      for (let c = 0; c < cells.length; c++) {
        const targetRow = anchorRow + r;
        const targetCol = anchorCol + c;
        if (targetRow >= items.length || targetCol >= visibleCols.length) continue;
        const item = items[targetRow];
        const col = visibleCols[targetCol];
        const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
        if (!colEditable) continue;
        const rawValue = cells[c] ?? '';
        const oldValue = getCellValue(item, col);
        const result = parseValue(rawValue, oldValue, item, col);
        if (!result.valid) continue;
        wrappedOnCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex: targetRow });
      }
    }

    const cutRange = this.cutRangeSig();
    if (cutRange) {
      for (let r = cutRange.startRow; r <= cutRange.endRow; r++) {
        for (let c = cutRange.startCol; c <= cutRange.endCol; c++) {
          if (r >= items.length || c >= visibleCols.length) continue;
          const item = items[r];
          const col = visibleCols[c];
          const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
          if (!colEditable) continue;
          const oldValue = getCellValue(item, col);
          const result = parseValue('', oldValue, item, col);
          if (!result.valid) continue;
          wrappedOnCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex: r });
        }
      }
      this.cutRangeSig.set(null);
    }
    this.endBatch();
    this.copyRangeSig.set(null);
  }

  clearClipboardRanges(): void {
    this.copyRangeSig.set(null);
    this.cutRangeSig.set(null);
  }

  // --- Undo/Redo ---
  beginBatch(): void {
    this.undoRedoStack.beginBatch();
  }

  endBatch(): void {
    this.undoRedoStack.endBatch();
    this.undoLengthSig.set(this.undoRedoStack.historyLength);
    this.redoLengthSig.set(this.undoRedoStack.redoLength);
  }

  undo(originalOnCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined): void {
    if (!originalOnCellValueChanged) return;
    const lastBatch = this.undoRedoStack.undo();
    if (!lastBatch) return;
    this.undoLengthSig.set(this.undoRedoStack.historyLength);
    this.redoLengthSig.set(this.undoRedoStack.redoLength);
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      originalOnCellValueChanged({ ...ev, oldValue: ev.newValue, newValue: ev.oldValue });
    }
  }

  redo(originalOnCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined): void {
    if (!originalOnCellValueChanged) return;
    const nextBatch = this.undoRedoStack.redo();
    if (!nextBatch) return;
    this.undoLengthSig.set(this.undoRedoStack.historyLength);
    this.redoLengthSig.set(this.undoRedoStack.redoLength);
    for (const ev of nextBatch) {
      originalOnCellValueChanged(ev);
    }
  }

  // --- Cell selection / mouse handling ---
  handleCellMouseDown(
    e: MouseEvent,
    rowIndex: number,
    globalColIndex: number,
    colOffset: number,
    wrapperEl: HTMLElement | null
  ): void {
    if (e.button !== 0) return;
    wrapperEl?.focus({ preventScroll: true });
    this.clearClipboardRanges();

    if (globalColIndex < colOffset) return;
    e.preventDefault();

    const dataColIndex = globalColIndex - colOffset;
    const currentRange = this.selectionRangeSig();

    if (e.shiftKey && currentRange != null) {
      this.setSelectionRange(
        normalizeSelectionRange({
          startRow: currentRange.startRow,
          startCol: currentRange.startCol,
          endRow: rowIndex,
          endCol: dataColIndex,
        }),
      );
      this.setActiveCell({ rowIndex, columnIndex: globalColIndex });
    } else {
      this.dragStartPos = { row: rowIndex, col: dataColIndex };
      this.dragMoved = false;
      const initial: ISelectionRange = {
        startRow: rowIndex, startCol: dataColIndex,
        endRow: rowIndex, endCol: dataColIndex,
      };
      this.setSelectionRange(initial);
      this.liveDragRange = initial;
      this.setActiveCell({ rowIndex, columnIndex: globalColIndex });
      this.isDraggingRef = true;
    }
  }

  handleSelectAllCells(
    rowCount: number,
    visibleColCount: number,
    colOffset: number
  ): void {
    if (rowCount === 0 || visibleColCount === 0) return;
    this.setSelectionRange({
      startRow: 0, startCol: 0,
      endRow: rowCount - 1, endCol: visibleColCount - 1,
    });
    this.setActiveCell({ rowIndex: 0, columnIndex: colOffset });
  }

  // --- Fill handle ---
  handleFillHandleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const range = this.selectionRangeSig();
    if (!range) return;
    this.fillDragStart = { startRow: range.startRow, startCol: range.startCol };
  }

  // --- Keyboard navigation ---
  handleGridKeyDown(
    e: KeyboardEvent,
    items: T[],
    getRowId: (item: T) => RowId,
    visibleCols: IColumnDef<T>[],
    colOffset: number,
    hasCheckboxCol: boolean,
    visibleColumnCount: number,
    editable: boolean | undefined,
    wrappedOnCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined,
    originalOnCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined,
    rowSelection: string,
    selectedRowIds: Set<RowId>,
    wrapperEl: HTMLElement | null,
    handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void,
    editingCell: { rowId: RowId; columnId: string } | null,
    setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void,
    onKeyDown?: (event: KeyboardEvent) => void,
  ): void {
    // Consumer intercept: call consumer's handler first; skip grid default if preventDefault() was called
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    const activeCell = this.activeCellSig();
    const selectionRange = this.selectionRangeSig();

    const maxRowIndex = items.length - 1;
    const maxColIndex = visibleColumnCount - 1 + colOffset;

    if (items.length === 0) return;

    if (activeCell === null) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) {
        this.setActiveCell({ rowIndex: 0, columnIndex: colOffset });
        e.preventDefault();
      }
      return;
    }

    const { rowIndex, columnIndex } = activeCell;
    const dataColIndex = columnIndex - colOffset;
    const shift = e.shiftKey;
    const ctrl = e.ctrlKey || e.metaKey;

    const isEmptyAt = (r: number, c: number): boolean => {
      if (r < 0 || r >= items.length || c < 0 || c >= visibleCols.length) return true;
      const v = getCellValue(items[r], visibleCols[c]);
      return v == null || v === '';
    };

    const findCtrlTarget = findCtrlArrowTarget;

    switch (e.key) {
      case 'c':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          this.handleCopy(items, visibleCols, colOffset);
        }
        break;
      case 'x':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          this.handleCut(items, visibleCols, colOffset, editable, wrappedOnCellValueChanged);
        }
        break;
      case 'v':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          void this.handlePaste(items, visibleCols, colOffset, editable, wrappedOnCellValueChanged);
        }
        break;
      case 'd':
        if (ctrl) {
          if (editingCell != null) break;
          if (editable !== false && wrappedOnCellValueChanged != null) {
            const fillRange = selectionRange ?? (activeCell != null
              ? { startRow: activeCell.rowIndex, startCol: activeCell.columnIndex - colOffset, endRow: activeCell.rowIndex, endCol: activeCell.columnIndex - colOffset }
              : null);
            if (fillRange != null) {
              e.preventDefault();
              const norm = normalizeSelectionRange(fillRange);
              const fillEvents = applyFillValues(norm, norm.startRow, norm.startCol, items, visibleCols);
              if (fillEvents.length > 0) {
                this.undoRedoStack.beginBatch();
                for (const evt of fillEvents) wrappedOnCellValueChanged(evt);
                this.undoRedoStack.endBatch();
                this.undoLengthSig.set(this.undoRedoStack.historyLength);
                this.redoLengthSig.set(this.undoRedoStack.redoLength);
              }
            }
          }
        }
        break;
      case 'ArrowDown': {
        e.preventDefault();
        const newRow = ctrl
          ? findCtrlTarget(rowIndex, maxRowIndex, 1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.min(rowIndex + 1, maxRowIndex);
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRow,
            endCol: selectionRange?.endCol ?? dataColIndex,
          }));
        } else {
          this.setSelectionRange({ startRow: newRow, startCol: dataColIndex, endRow: newRow, endCol: dataColIndex });
        }
        this.setActiveCell({ rowIndex: newRow, columnIndex });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const newRowUp = ctrl
          ? findCtrlTarget(rowIndex, 0, -1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.max(rowIndex - 1, 0);
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRowUp,
            endCol: selectionRange?.endCol ?? dataColIndex,
          }));
        } else {
          this.setSelectionRange({ startRow: newRowUp, startCol: dataColIndex, endRow: newRowUp, endCol: dataColIndex });
        }
        this.setActiveCell({ rowIndex: newRowUp, columnIndex });
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        let newCol: number;
        if (ctrl && dataColIndex >= 0) {
          newCol = findCtrlTarget(dataColIndex, visibleCols.length - 1, 1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
        } else {
          newCol = Math.min(columnIndex + 1, maxColIndex);
        }
        const newDataCol = newCol - colOffset;
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: selectionRange?.endRow ?? rowIndex,
            endCol: newDataCol,
          }));
        } else {
          this.setSelectionRange({ startRow: rowIndex, startCol: newDataCol, endRow: rowIndex, endCol: newDataCol });
        }
        this.setActiveCell({ rowIndex, columnIndex: newCol });
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        let newColLeft: number;
        if (ctrl && dataColIndex >= 0) {
          newColLeft = findCtrlTarget(dataColIndex, 0, -1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
        } else {
          newColLeft = Math.max(columnIndex - 1, colOffset);
        }
        const newDataColLeft = newColLeft - colOffset;
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: selectionRange?.endRow ?? rowIndex,
            endCol: newDataColLeft,
          }));
        } else {
          this.setSelectionRange({ startRow: rowIndex, startCol: newDataColLeft, endRow: rowIndex, endCol: newDataColLeft });
        }
        this.setActiveCell({ rowIndex, columnIndex: newColLeft });
        break;
      }
      case 'Tab': {
        e.preventDefault();
        const tabResult = computeTabNavigation(rowIndex, columnIndex, maxRowIndex, maxColIndex, colOffset, e.shiftKey);
        const newDataColTab = tabResult.columnIndex - colOffset;
        this.setSelectionRange({ startRow: tabResult.rowIndex, startCol: newDataColTab, endRow: tabResult.rowIndex, endCol: newDataColTab });
        this.setActiveCell({ rowIndex: tabResult.rowIndex, columnIndex: tabResult.columnIndex });
        break;
      }
      case 'Home': {
        e.preventDefault();
        const newRowHome = ctrl ? 0 : rowIndex;
        this.setSelectionRange({ startRow: newRowHome, startCol: 0, endRow: newRowHome, endCol: 0 });
        this.setActiveCell({ rowIndex: newRowHome, columnIndex: colOffset });
        break;
      }
      case 'End': {
        e.preventDefault();
        const newRowEnd = ctrl ? maxRowIndex : rowIndex;
        this.setSelectionRange({ startRow: newRowEnd, startCol: visibleColumnCount - 1, endRow: newRowEnd, endCol: visibleColumnCount - 1 });
        this.setActiveCell({ rowIndex: newRowEnd, columnIndex: maxColIndex });
        break;
      }
      case 'PageDown':
      case 'PageUp': {
        e.preventDefault();
        let pageSize = 10;
        let rowHeight = 36;
        if (wrapperEl) {
          const firstRow = wrapperEl.querySelector('tbody tr') as HTMLElement | null;
          if (firstRow && firstRow.offsetHeight > 0) {
            rowHeight = firstRow.offsetHeight;
            pageSize = Math.max(1, Math.floor(wrapperEl.clientHeight / rowHeight));
          }
        }
        const pgDir = e.key === 'PageDown' ? 1 : -1;
        const newRowPage = Math.max(0, Math.min(rowIndex + pgDir * pageSize, maxRowIndex));
        if (shift) {
          this.setSelectionRange(normalizeSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRowPage,
            endCol: selectionRange?.endCol ?? dataColIndex,
          }));
        } else {
          this.setSelectionRange({ startRow: newRowPage, startCol: dataColIndex, endRow: newRowPage, endCol: dataColIndex });
        }
        this.setActiveCell({ rowIndex: newRowPage, columnIndex });
        // Scroll the new row into view
        if (wrapperEl) {
          wrapperEl.scrollTop = getScrollTopForRow(newRowPage, rowHeight, wrapperEl.clientHeight, 'center');
        }
        break;
      }
      case 'Enter':
      case 'F2': {
        e.preventDefault();
        if (dataColIndex >= 0 && dataColIndex < visibleCols.length) {
          const col = visibleCols[dataColIndex];
          const item = items[rowIndex];
          if (item && col) {
            const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
            if (editable !== false && colEditable && wrappedOnCellValueChanged != null) {
              setEditingCell({ rowId: getRowId(item), columnId: col.columnId });
            }
          }
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        if (editingCell != null) {
          setEditingCell(null);
        } else {
          this.clearClipboardRanges();
          this.setActiveCell(null);
          this.setSelectionRange(null);
        }
        break;
      case ' ':
        if (rowSelection !== 'none' && columnIndex === 0 && hasCheckboxCol) {
          e.preventDefault();
          const item = items[rowIndex];
          if (item) {
            const id = getRowId(item);
            const isSelected = selectedRowIds.has(id);
            handleRowCheckboxChange(id, !isSelected, rowIndex, e.shiftKey);
          }
        }
        break;
      case 'z':
        if (ctrl) {
          if (editingCell == null) {
            if (e.shiftKey) {
              e.preventDefault();
              this.redo(originalOnCellValueChanged);
            } else {
              e.preventDefault();
              this.undo(originalOnCellValueChanged);
            }
          }
        }
        break;
      case 'y':
        if (ctrl && editingCell == null) {
          e.preventDefault();
          this.redo(originalOnCellValueChanged);
        }
        break;
      case 'a':
        if (ctrl) {
          if (editingCell != null) break;
          e.preventDefault();
          if (items.length > 0 && visibleColumnCount > 0) {
            this.setSelectionRange({ startRow: 0, startCol: 0, endRow: items.length - 1, endCol: visibleColumnCount - 1 });
            this.setActiveCell({ rowIndex: 0, columnIndex: colOffset });
          }
        }
        break;
      case 'Delete':
      case 'Backspace': {
        if (editingCell != null) break;
        if (editable === false) break;
        if (wrappedOnCellValueChanged == null) break;
        const range = selectionRange ?? (activeCell != null
          ? { startRow: activeCell.rowIndex, startCol: activeCell.columnIndex - colOffset, endRow: activeCell.rowIndex, endCol: activeCell.columnIndex - colOffset }
          : null);
        if (range == null) break;
        e.preventDefault();
        const deleteEvents = applyCellDeletion(normalizeSelectionRange(range), items, visibleCols);
        for (const evt of deleteEvents) wrappedOnCellValueChanged(evt);
        break;
      }
      case 'F10':
        if (e.shiftKey) {
          e.preventDefault();
          if (activeCell != null && wrapperEl) {
            const sel = `[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.columnIndex}"]`;
            const cell = wrapperEl.querySelector(sel) as HTMLElement | null;
            if (cell) {
              const rect = cell.getBoundingClientRect();
              this.setContextMenuPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            } else {
              this.setContextMenuPosition({ x: 100, y: 100 });
            }
          } else {
            this.setContextMenuPosition({ x: 100, y: 100 });
          }
        }
        break;
      default:
        break;
    }
  }

  // --- Drag helpers ---
  onWindowMouseMove(e: MouseEvent, colOffset: number, wrapperEl: HTMLElement | null): void {
    if (!this.isDraggingRef || !this.dragStartPos) return;

    if (!this.dragMoved) {
      this.dragMoved = true;
      this.isDraggingSig.set(true);
    }

    this.lastMousePos = { cx: e.clientX, cy: e.clientY };

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      const pos = this.lastMousePos;
      if (!pos) return;
      const newRange = this.resolveRangeFromMouse(pos.cx, pos.cy, colOffset);
      if (!newRange) return;

      const prev = this.liveDragRange;
      if (prev && prev.startRow === newRange.startRow && prev.startCol === newRange.startCol &&
          prev.endRow === newRange.endRow && prev.endCol === newRange.endCol) return;

      this.liveDragRange = newRange;
      this.applyDragAttrs(newRange, colOffset, wrapperEl);
    });
  }

  onWindowMouseUp(colOffset: number, wrapperEl: HTMLElement | null): void {
    if (!this.isDraggingRef) return;

    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.isDraggingRef = false;
    const wasDrag = this.dragMoved;

    if (wasDrag) {
      const pos = this.lastMousePos;
      if (pos) {
        const flushed = this.resolveRangeFromMouse(pos.cx, pos.cy, colOffset);
        if (flushed) this.liveDragRange = flushed;
      }

      const finalRange = this.liveDragRange;
      if (finalRange) {
        this.setSelectionRange(finalRange);
        // Keep the active cell at the drag anchor (start), not the endpoint.
        const anchor = this.dragStartPos;
        if (anchor) {
          this.setActiveCell({
            rowIndex: anchor.row,
            columnIndex: anchor.col + colOffset,
          });
        }
      }
    }

    this.clearDragAttrs(wrapperEl);
    this.liveDragRange = null;
    this.lastMousePos = null;
    this.dragStartPos = null;
    if (wasDrag) this.isDraggingSig.set(false);
  }

  resolveRangeFromMouse(cx: number, cy: number, colOffset: number): ISelectionRange | null {
    if (!this.dragStartPos) return null;
    const target = document.elementFromPoint(cx, cy);
    const cell = (target as HTMLElement)?.closest?.('[data-row-index][data-col-index]');
    if (!cell) return null;
    const r = parseInt(cell.getAttribute('data-row-index') ?? '', 10);
    const c = parseInt(cell.getAttribute('data-col-index') ?? '', 10);
    if (Number.isNaN(r) || Number.isNaN(c) || c < colOffset) return null;
    const dataCol = c - colOffset;
    const start = this.dragStartPos;
    return normalizeSelectionRange({
      startRow: start.row, startCol: start.col,
      endRow: r, endCol: dataCol,
    });
  }

  applyDragAttrs(range: ISelectionRange, colOff: number, wrapper: HTMLElement | null): void {
    if (!wrapper) return;
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    const cells = wrapper.querySelectorAll('[data-row-index][data-col-index]');
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      const r = parseInt(el.getAttribute('data-row-index') ?? '', 10);
      const c = parseInt(el.getAttribute('data-col-index') ?? '', 10) - colOff;
      const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      if (inRange) {
        if (!el.hasAttribute('data-drag-range')) el.setAttribute('data-drag-range', '');
      } else {
        if (el.hasAttribute('data-drag-range')) el.removeAttribute('data-drag-range');
      }
    }
  }

  clearDragAttrs(wrapper: HTMLElement | null): void {
    if (!wrapper) return;
    const marked = wrapper.querySelectorAll('[data-drag-range]');
    for (let i = 0; i < marked.length; i++) marked[i].removeAttribute('data-drag-range');
  }

  // --- Private helpers ---
  getEffectiveRange(colOffset: number): ISelectionRange | null {
    const sel = this.selectionRangeSig();
    const ac = this.activeCellSig();
    return sel ?? (ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null);
  }

  destroy(): void {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    if (this.fillRafId) { cancelAnimationFrame(this.fillRafId); this.fillRafId = 0; }
    if (this.autoScrollInterval) { clearInterval(this.autoScrollInterval); this.autoScrollInterval = null; }
    if (this.fillMoveHandler) {
      window.removeEventListener('mousemove', this.fillMoveHandler, true);
      this.fillMoveHandler = null;
    }
    if (this.fillUpHandler) {
      window.removeEventListener('mouseup', this.fillUpHandler, true);
      this.fillUpHandler = null;
    }
    this.undoRedoStack.clear();
  }
}
