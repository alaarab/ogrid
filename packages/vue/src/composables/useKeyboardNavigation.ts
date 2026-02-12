import { type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange, getCellValue, parseValue } from '@alaarab/ogrid-core';
import type {
  RowId,
  IActiveCell,
  ISelectionRange,
  IColumnDef,
  ICellValueChangedEvent,
  RowSelectionMode,
} from '../types';
import type { EditingCell } from './useCellEditing';
import type { ContextMenuPosition } from './useContextMenu';

/**
 * Excel-style Ctrl+Arrow: find the target position along a 1D axis.
 */
function findCtrlTarget(
  pos: number,
  edge: number,
  step: number,
  isEmpty: (i: number) => boolean
): number {
  if (pos === edge) return pos;
  const next = pos + step;
  if (!isEmpty(pos) && !isEmpty(next)) {
    let p = next;
    while (p !== edge) {
      if (isEmpty(p + step)) return p;
      p += step;
    }
    return edge;
  }
  let p = next;
  while (p !== edge) {
    if (!isEmpty(p)) return p;
    p += step;
  }
  return edge;
}

export interface UseKeyboardNavigationParams<T> {
  data: {
    items: Ref<T[]>;
    visibleCols: Ref<IColumnDef<T>[]>;
    colOffset: number;
    hasCheckboxCol: Ref<boolean>;
    visibleColumnCount: Ref<number>;
    getRowId: (item: T) => RowId;
  };
  state: {
    activeCell: Ref<IActiveCell | null>;
    selectionRange: Ref<ISelectionRange | null>;
    editingCell: Ref<EditingCell | null>;
    selectedRowIds: Ref<Set<RowId>>;
  };
  handlers: {
    setActiveCell: (cell: IActiveCell | null) => void;
    setSelectionRange: (range: ISelectionRange | null) => void;
    setEditingCell: (cell: EditingCell | null) => void;
    handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
    handleCopy: () => void;
    handleCut: () => void;
    handlePaste: () => Promise<void>;
    setContextMenu: (pos: ContextMenuPosition | null) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    clearClipboardRanges?: () => void;
  };
  features: {
    editable: Ref<boolean | undefined>;
    onCellValueChanged: Ref<((event: ICellValueChangedEvent<T>) => void) | undefined>;
    rowSelection: Ref<RowSelectionMode>;
    wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
  };
}

export interface UseKeyboardNavigationResult {
  handleGridKeyDown: (e: KeyboardEvent) => void;
}

/**
 * Handles all keyboard navigation, shortcuts, and cell editing triggers for the grid.
 */
export function useKeyboardNavigation<T>(
  params: UseKeyboardNavigationParams<T>
): UseKeyboardNavigationResult {
  // Read latest values from refs on each call — no memoization needed in Vue
  const handleGridKeyDown = (e: KeyboardEvent) => {
    const { data, state, handlers, features } = params;
    const items = data.items.value;
    const visibleCols = data.visibleCols.value;
    const { colOffset, getRowId } = data;
    const hasCheckboxCol = data.hasCheckboxCol.value;
    const visibleColumnCount = data.visibleColumnCount.value;
    const activeCell = state.activeCell.value;
    const selectionRange = state.selectionRange.value;
    const editingCell = state.editingCell.value;
    const selectedRowIds = state.selectedRowIds.value;
    const { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopy, handleCut, handlePaste, setContextMenu, onUndo, onRedo, clearClipboardRanges } = handlers;
    const editable = features.editable.value;
    const onCellValueChanged = features.onCellValueChanged.value;
    const rowSelection = features.rowSelection.value;
    const wrapperRef = features.wrapperRef;

    const maxRowIndex = items.length - 1;
    const maxColIndex = visibleColumnCount - 1 + colOffset;

    if (items.length === 0) return;

    if (activeCell === null) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key)) {
        setActiveCell({ rowIndex: 0, columnIndex: colOffset });
        e.preventDefault();
      }
      return;
    }

    const { rowIndex, columnIndex } = activeCell;
    const dataColIndex = columnIndex - colOffset;
    const shift = e.shiftKey;
    const isEmptyAt = (r: number, c: number): boolean => {
      if (r < 0 || r >= items.length || c < 0 || c >= visibleCols.length) return true;
      const v = getCellValue(items[r], visibleCols[c]);
      return v == null || v === '';
    };

    switch (e.key) {
      case 'c':
        if (e.ctrlKey || e.metaKey) {
          if (editingCell != null) break;
          e.preventDefault();
          handleCopy();
        }
        break;
      case 'x':
        if (e.ctrlKey || e.metaKey) {
          if (editingCell != null) break;
          e.preventDefault();
          handleCut();
        }
        break;
      case 'v':
        if (e.ctrlKey || e.metaKey) {
          if (editingCell != null) break;
          e.preventDefault();
          void handlePaste();
        }
        break;
      case 'ArrowDown': {
        e.preventDefault();
        const ctrl = e.ctrlKey || e.metaKey;
        const newRow = ctrl
          ? findCtrlTarget(rowIndex, maxRowIndex, 1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.min(rowIndex + 1, maxRowIndex);
        if (shift) {
          setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: newRow,
              endCol: selectionRange?.endCol ?? dataColIndex,
            })
          );
        } else {
          setSelectionRange({ startRow: newRow, startCol: dataColIndex, endRow: newRow, endCol: dataColIndex });
        }
        setActiveCell({ rowIndex: newRow, columnIndex });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const ctrl = e.ctrlKey || e.metaKey;
        const newRowUp = ctrl
          ? findCtrlTarget(rowIndex, 0, -1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
          : Math.max(rowIndex - 1, 0);
        if (shift) {
          setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: newRowUp,
              endCol: selectionRange?.endCol ?? dataColIndex,
            })
          );
        } else {
          setSelectionRange({ startRow: newRowUp, startCol: dataColIndex, endRow: newRowUp, endCol: dataColIndex });
        }
        setActiveCell({ rowIndex: newRowUp, columnIndex });
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
        if (shift) {
          setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: selectionRange?.endRow ?? rowIndex,
              endCol: newDataCol,
            })
          );
        } else {
          setSelectionRange({ startRow: rowIndex, startCol: newDataCol, endRow: rowIndex, endCol: newDataCol });
        }
        setActiveCell({ rowIndex, columnIndex: newCol });
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
        if (shift) {
          setSelectionRange(
            normalizeSelectionRange({
              startRow: selectionRange?.startRow ?? rowIndex,
              startCol: selectionRange?.startCol ?? dataColIndex,
              endRow: selectionRange?.endRow ?? rowIndex,
              endCol: newDataColLeft,
            })
          );
        } else {
          setSelectionRange({ startRow: rowIndex, startCol: newDataColLeft, endRow: rowIndex, endCol: newDataColLeft });
        }
        setActiveCell({ rowIndex, columnIndex: newColLeft });
        break;
      }
      case 'Tab': {
        e.preventDefault();
        let newRowTab = rowIndex;
        let newColTab = columnIndex;
        if (e.shiftKey) {
          if (columnIndex > colOffset) {
            newColTab = columnIndex - 1;
          } else if (rowIndex > 0) {
            newRowTab = rowIndex - 1;
            newColTab = maxColIndex;
          }
        } else {
          if (columnIndex < maxColIndex) {
            newColTab = columnIndex + 1;
          } else if (rowIndex < maxRowIndex) {
            newRowTab = rowIndex + 1;
            newColTab = colOffset;
          }
        }
        const newDataColTab = newColTab - colOffset;
        setSelectionRange({ startRow: newRowTab, startCol: newDataColTab, endRow: newRowTab, endCol: newDataColTab });
        setActiveCell({ rowIndex: newRowTab, columnIndex: newColTab });
        break;
      }
      case 'Home': {
        e.preventDefault();
        const newRowHome = e.ctrlKey ? 0 : rowIndex;
        setSelectionRange({ startRow: newRowHome, startCol: 0, endRow: newRowHome, endCol: 0 });
        setActiveCell({ rowIndex: newRowHome, columnIndex: colOffset });
        break;
      }
      case 'End': {
        e.preventDefault();
        const newRowEnd = e.ctrlKey ? maxRowIndex : rowIndex;
        setSelectionRange({ startRow: newRowEnd, startCol: visibleColumnCount - 1, endRow: newRowEnd, endCol: visibleColumnCount - 1 });
        setActiveCell({ rowIndex: newRowEnd, columnIndex: maxColIndex });
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
            if (editable !== false && colEditable && onCellValueChanged != null) {
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
          clearClipboardRanges?.();
          setActiveCell(null);
          setSelectionRange(null);
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
        if (e.ctrlKey || e.metaKey) {
          if (editingCell == null) {
            if (e.shiftKey && onRedo) {
              e.preventDefault();
              onRedo();
            } else if (!e.shiftKey && onUndo) {
              e.preventDefault();
              onUndo();
            }
          }
        }
        break;
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          if (editingCell == null && onRedo) {
            e.preventDefault();
            onRedo();
          }
        }
        break;
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          if (editingCell != null) break;
          e.preventDefault();
          if (items.length > 0 && visibleColumnCount > 0) {
            setSelectionRange({ startRow: 0, startCol: 0, endRow: items.length - 1, endCol: visibleColumnCount - 1 });
            setActiveCell({ rowIndex: 0, columnIndex: colOffset });
          }
        }
        break;
      case 'Delete':
      case 'Backspace': {
        if (editingCell != null) break;
        if (editable === false) break;
        if (onCellValueChanged == null) break;
        const range =
          selectionRange ??
          (activeCell != null
            ? { startRow: activeCell.rowIndex, startCol: activeCell.columnIndex - colOffset, endRow: activeCell.rowIndex, endCol: activeCell.columnIndex - colOffset }
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
            const oldValue = getCellValue(item, col);
            const result = parseValue('', oldValue, item, col);
            if (!result.valid) continue;
            onCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex: r });
          }
        }
        break;
      }
      case 'F10':
        if (e.shiftKey) {
          e.preventDefault();
          if (activeCell != null && wrapperRef.value) {
            const sel = `[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.columnIndex}"]`;
            const cell = wrapperRef.value.querySelector(sel) as HTMLElement | null;
            if (cell) {
              const rect = cell.getBoundingClientRect();
              setContextMenu({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            } else {
              setContextMenu({ x: 100, y: 100 });
            }
          } else {
            setContextMenu({ x: 100, y: 100 });
          }
        }
        break;
      default:
        break;
    }
  };

  return { handleGridKeyDown };
}
