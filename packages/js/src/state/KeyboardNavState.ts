import type { IActiveCell, ISelectionRange, IColumnDef, ICellValueChangedEvent, RowId } from '@alaarab/ogrid-core';
import { normalizeSelectionRange, getCellValue, findCtrlArrowTarget as findCtrlTarget, computeTabNavigation } from '@alaarab/ogrid-core';
import { parseValue } from '@alaarab/ogrid-core';

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
    const { items, visibleCols, colOffset, editable, onCellValueChanged, onCopy, onCut, onPaste, onUndo, onRedo, onContextMenu, onStartEdit, getRowId, clearClipboardRanges } = this.params;
    const activeCell = this.getActiveCell();
    const selectionRange = this.getSelectionRange();

    const maxRowIndex = items.length - 1;
    const maxColIndex = visibleCols.length - 1 + colOffset;

    if (items.length === 0) return;

    if (activeCell === null) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key)) {
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
      case 'ArrowDown': {
        e.preventDefault();
        const ctrl = e.ctrlKey || e.metaKey;
        const newRow = ctrl
          ? findCtrlTarget(rowIndex, maxRowIndex, 1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.min(rowIndex + 1, maxRowIndex);
        this.setActiveCell({ rowIndex: newRow, columnIndex });
        if (shift) {
          this.setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: newRow,
              endCol: selectionRange?.endCol ?? dataColIndex,
            })
          );
        } else {
          this.setSelectionRange({
            startRow: newRow,
            startCol: dataColIndex,
            endRow: newRow,
            endCol: dataColIndex,
          });
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const ctrl = e.ctrlKey || e.metaKey;
        const newRowUp = ctrl
          ? findCtrlTarget(rowIndex, 0, -1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.max(rowIndex - 1, 0);
        this.setActiveCell({ rowIndex: newRowUp, columnIndex });
        if (shift) {
          this.setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: newRowUp,
              endCol: selectionRange?.endCol ?? dataColIndex,
            })
          );
        } else {
          this.setSelectionRange({
            startRow: newRowUp,
            startCol: dataColIndex,
            endRow: newRowUp,
            endCol: dataColIndex,
          });
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        const ctrl = e.ctrlKey || e.metaKey;
        let newCol: number;
        if (ctrl && dataColIndex >= 0) {
          newCol = findCtrlTarget(dataColIndex, visibleCols.length - 1, 1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
        } else {
          newCol = Math.min(columnIndex + 1, maxColIndex);
        }
        const newDataCol = newCol - colOffset;
        this.setActiveCell({ rowIndex, columnIndex: newCol });
        if (shift) {
          this.setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: selectionRange?.endRow ?? rowIndex,
              endCol: newDataCol,
            })
          );
        } else {
          this.setSelectionRange({
            startRow: rowIndex,
            startCol: newDataCol,
            endRow: rowIndex,
            endCol: newDataCol,
          });
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const ctrl = e.ctrlKey || e.metaKey;
        let newColLeft: number;
        if (ctrl && dataColIndex >= 0) {
          newColLeft = findCtrlTarget(dataColIndex, 0, -1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
        } else {
          newColLeft = Math.max(columnIndex - 1, colOffset);
        }
        const newDataColLeft = newColLeft - colOffset;
        this.setActiveCell({ rowIndex, columnIndex: newColLeft });
        if (shift) {
          this.setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: selectionRange?.endRow ?? rowIndex,
              endCol: newDataColLeft,
            })
          );
        } else {
          this.setSelectionRange({
            startRow: rowIndex,
            startCol: newDataColLeft,
            endRow: rowIndex,
            endCol: newDataColLeft,
          });
        }
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
        const norm = normalizeSelectionRange(range);
        for (let r = norm.startRow; r <= norm.endRow; r++) {
          for (let c = norm.startCol; c <= norm.endCol; c++) {
            if (r >= items.length || c >= visibleCols.length) continue;
            const item = items[r];
            const col = visibleCols[c];
            const colEditable =
              col.editable === true ||
              (typeof col.editable === 'function' && col.editable(item));
            if (!colEditable) continue;
            const oldValue = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
            const result = parseValue('', oldValue, item, col);
            if (!result.valid) continue;
            onCellValueChanged({
              item,
              columnId: col.columnId,
              oldValue,
              newValue: result.value,
              rowIndex: r,
            });
          }
        }
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
