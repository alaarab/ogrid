import type { IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent, RowId } from '@alaarab/ogrid-core';
import { getCellValue, computeTabNavigation, computeArrowNavigation, applyCellDeletion, getScrollTopForRow } from '@alaarab/ogrid-core';

export interface KeyboardNavParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  getRowId: (item: T) => RowId;
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => Promise<void>;
  onUndo?: () => void;
  onRedo?: () => void;
  onContextMenu?: (x: number, y: number) => void;
  onStartEdit?: (rowId: RowId, columnId: string) => void;
  clearClipboardRanges?: () => void;
  /** Custom keydown handler. Called before grid default. preventDefault() suppresses grid handling. */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** Fill-down callback (Ctrl+D). Provided by FillHandleState. */
  onFillDown?: () => void;
}

export class KeyboardNavState<T> {
  private params: KeyboardNavParams<T>;
  private getActiveCell: () => IActiveCell | null;
  private getSelectionRange: () => ISelectionRange | null;
  private setActiveCell: (cell: IActiveCell | null) => void;
  private setSelectionRange: (range: ISelectionRange | null) => void;
  private wrapperRef: HTMLElement | null = null;

  constructor(
    params: KeyboardNavParams<T>,
    getActiveCell: () => IActiveCell | null,
    getSelectionRange: () => ISelectionRange | null,
    setActiveCell: (cell: IActiveCell | null) => void,
    setSelectionRange: (range: ISelectionRange | null) => void
  ) {
    this.params = params;
    this.getActiveCell = getActiveCell;
    this.getSelectionRange = getSelectionRange;
    this.setActiveCell = setActiveCell;
    this.setSelectionRange = setSelectionRange;
  }

  setWrapperRef(ref: HTMLElement | null): void {
    this.wrapperRef = ref;
  }

  updateParams(params: KeyboardNavParams<T>): void {
    this.params = params;
  }

  handleKeyDown = (e: KeyboardEvent): void => {
    const { items, visibleCols, colOffset, editable, onCellValueChanged, onCopy, onCut, onPaste, onUndo, onRedo, onContextMenu, onStartEdit, getRowId, clearClipboardRanges, onKeyDown, onFillDown } = this.params;

    // Consumer intercept: call consumer's handler first; skip grid default if preventDefault() was called
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    const activeCell = this.getActiveCell();
    const selectionRange = this.getSelectionRange();

    const maxRowIndex = items.length - 1;
    const maxColIndex = visibleCols.length - 1 + colOffset;

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
    const isEmptyAt = (r: number, c: number): boolean => {
      if (r < 0 || r >= items.length || c < 0 || c >= visibleCols.length) return true;
      const v = getCellValue(items[r], visibleCols[c] as unknown as Parameters<typeof getCellValue>[1]);
      return v == null || v === '';
    };

    switch (e.key) {
      case 'c':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onCopy?.();
        }
        break;
      case 'x':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onCut?.();
        }
        break;
      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          void onPaste?.();
        }
        break;
      case 'd':
        if (e.ctrlKey || e.metaKey) {
          if (editable !== false && onFillDown) {
            e.preventDefault();
            onFillDown();
          }
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'ArrowRight':
      case 'ArrowLeft': {
        e.preventDefault();
        const { newRowIndex, newColumnIndex, newRange } = computeArrowNavigation({
          direction: e.key as 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight',
          rowIndex, columnIndex, dataColIndex, colOffset,
          maxRowIndex, maxColIndex,
          visibleColCount: visibleCols.length,
          isCtrl: e.ctrlKey || e.metaKey,
          isShift: shift,
          selectionRange,
          isEmptyAt,
        });
        this.setActiveCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
        this.setSelectionRange(newRange);
        break;
      }
      case 'Tab': {
        e.preventDefault();
        const tabResult = computeTabNavigation(rowIndex, columnIndex, maxRowIndex, maxColIndex, colOffset, e.shiftKey);
        const newDataColTab = tabResult.columnIndex - colOffset;
        this.setActiveCell({ rowIndex: tabResult.rowIndex, columnIndex: tabResult.columnIndex });
        this.setSelectionRange({
          startRow: tabResult.rowIndex,
          startCol: newDataColTab,
          endRow: tabResult.rowIndex,
          endCol: newDataColTab,
        });
        break;
      }
      case 'Home': {
        e.preventDefault();
        const newRowHome = e.ctrlKey ? 0 : rowIndex;
        this.setActiveCell({ rowIndex: newRowHome, columnIndex: colOffset });
        this.setSelectionRange({
          startRow: newRowHome,
          startCol: 0,
          endRow: newRowHome,
          endCol: 0,
        });
        break;
      }
      case 'End': {
        e.preventDefault();
        const newRowEnd = e.ctrlKey ? maxRowIndex : rowIndex;
        this.setActiveCell({ rowIndex: newRowEnd, columnIndex: maxColIndex });
        this.setSelectionRange({
          startRow: newRowEnd,
          startCol: visibleCols.length - 1,
          endRow: newRowEnd,
          endCol: visibleCols.length - 1,
        });
        break;
      }
      case 'PageDown':
      case 'PageUp': {
        e.preventDefault();
        const wrapper = this.wrapperRef;
        let pageSize = 10;
        let rowHeight = 36;
        if (wrapper) {
          const firstRow = wrapper.querySelector('tbody tr') as HTMLElement | null;
          if (firstRow && firstRow.offsetHeight > 0) {
            rowHeight = firstRow.offsetHeight;
            pageSize = Math.max(1, Math.floor(wrapper.clientHeight / rowHeight));
          }
        }
        const pgDirection = e.key === 'PageDown' ? 1 : -1;
        const newRowPage = Math.max(0, Math.min(rowIndex + pgDirection * pageSize, maxRowIndex));
        const pgShift = e.shiftKey;
        if (pgShift) {
          this.setSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRowPage,
            endCol: selectionRange?.endCol ?? dataColIndex,
          });
        } else {
          this.setSelectionRange({
            startRow: newRowPage,
            startCol: dataColIndex,
            endRow: newRowPage,
            endCol: dataColIndex,
          });
        }
        this.setActiveCell({ rowIndex: newRowPage, columnIndex });
        // Scroll the new row into view
        if (wrapper) {
          wrapper.scrollTop = getScrollTopForRow(newRowPage, rowHeight, wrapper.clientHeight, 'center');
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
            const colEditable =
              col.editable === true ||
              (typeof col.editable === 'function' && col.editable(item));
            if (editable !== false && colEditable) {
              onStartEdit?.(getRowId(item), col.columnId);
            }
          }
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        clearClipboardRanges?.();
        this.setActiveCell(null);
        this.setSelectionRange(null);
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey && onRedo) {
            e.preventDefault();
            onRedo();
          } else if (!e.shiftKey && onUndo) {
            e.preventDefault();
            onUndo();
          }
        }
        break;
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onRedo?.();
        }
        break;
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (items.length > 0 && visibleCols.length > 0) {
            this.setActiveCell({ rowIndex: 0, columnIndex: colOffset });
            this.setSelectionRange({
              startRow: 0,
              startCol: 0,
              endRow: items.length - 1,
              endCol: visibleCols.length - 1,
            });
          }
        }
        break;
      case 'Delete':
      case 'Backspace': {
        if (editable === false) break;
        if (onCellValueChanged == null) break;
        const range =
          selectionRange ??
          (activeCell != null
            ? {
                startRow: activeCell.rowIndex,
                startCol: activeCell.columnIndex - colOffset,
                endRow: activeCell.rowIndex,
                endCol: activeCell.columnIndex - colOffset,
              }
            : null);
        if (range == null) break;
        e.preventDefault();
        const deleteEvents = applyCellDeletion(range, items, visibleCols);
        for (const evt of deleteEvents) onCellValueChanged(evt);
        break;
      }
      case 'F10':
        if (e.shiftKey) {
          e.preventDefault();
          if (activeCell != null && this.wrapperRef) {
            const sel = `[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.columnIndex}"]`;
            const cell = this.wrapperRef.querySelector(sel) as HTMLElement | null;
            if (cell) {
              const rect = cell.getBoundingClientRect();
              onContextMenu?.(rect.left + rect.width / 2, rect.top + rect.height / 2);
            } else {
              onContextMenu?.(100, 100);
            }
          } else {
            onContextMenu?.(100, 100);
          }
        }
        break;
      default:
        break;
    }
  };
}
