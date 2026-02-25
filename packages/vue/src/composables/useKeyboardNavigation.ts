import { isRef, type Ref } from 'vue';
import { getCellValue, computeTabNavigation, computeArrowNavigation, applyCellDeletion } from '@alaarab/ogrid-core';
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
import { useLatestRef, type MaybeShallowRef } from './useLatestRef';


export interface UseKeyboardNavigationParams<T> {
  data: {
    items: Ref<T[]>;
    visibleCols: Ref<IColumnDef<T>[]>;
    colOffset: Ref<number> | number;
    hasCheckboxCol: Ref<boolean>;
    visibleColumnCount: Ref<number>;
    getRowId: (item: T) => RowId;
  };
  state: {
    activeCell: MaybeShallowRef<IActiveCell | null>;
    selectionRange: MaybeShallowRef<ISelectionRange | null>;
    editingCell: MaybeShallowRef<EditingCell | null>;
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
    wrapperRef: MaybeShallowRef<HTMLElement | null>;
    scrollToRow?: (index: number, align?: 'start' | 'center' | 'end') => void;
    fillDown?: () => void;
    onKeyDown?: Ref<((event: KeyboardEvent) => void) | undefined>;
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
  // Store latest params in a ref so handleGridKeyDown is a stable callback
  const paramsRef = useLatestRef(params);

  const handleGridKeyDown = (e: KeyboardEvent) => {
    const { data, state, handlers, features } = paramsRef.value;
    const items = data.items.value;
    const visibleCols = data.visibleCols.value;
    const { getRowId } = data;
    const colOffset = isRef(data.colOffset) ? data.colOffset.value : data.colOffset;
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
    const scrollToRow = features.scrollToRow;
    const { fillDown } = features;
    const onKeyDown = features.onKeyDown?.value;

    // Consumer intercept: call consumer's handler first; skip grid default if preventDefault() was called
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    const maxRowIndex = items.length - 1;
    const maxColIndex = visibleColumnCount - 1 + colOffset;

    if (items.length === 0) return;

    if (activeCell === null) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) {
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
      case 'd':
        if (e.ctrlKey || e.metaKey) {
          if (editingCell != null) break;
          if (editable !== false && fillDown) {
            e.preventDefault();
            fillDown();
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
        setSelectionRange(newRange);
        setActiveCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          scrollToRow?.(newRowIndex, 'center');
        }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        const { rowIndex: newRowTab, columnIndex: newColTab } = computeTabNavigation(
          rowIndex, columnIndex, maxRowIndex, maxColIndex, colOffset, e.shiftKey
        );
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
      case 'PageDown':
      case 'PageUp': {
        e.preventDefault();
        const wrapperEl = wrapperRef.value;
        let pageSize = 10;
        if (wrapperEl) {
          const row = wrapperEl.querySelector('tbody tr') as HTMLElement | null;
          if (row && row.offsetHeight > 0) pageSize = Math.max(1, Math.floor(wrapperEl.clientHeight / row.offsetHeight));
        }
        const pgDirection = e.key === 'PageDown' ? 1 : -1;
        const newRowPage = Math.max(0, Math.min(rowIndex + pgDirection * pageSize, maxRowIndex));
        if (shift) {
          setSelectionRange({
            startRow: selectionRange?.startRow ?? rowIndex,
            startCol: selectionRange?.startCol ?? dataColIndex,
            endRow: newRowPage,
            endCol: selectionRange?.endCol ?? dataColIndex,
          });
        } else {
          setSelectionRange({
            startRow: newRowPage,
            startCol: dataColIndex,
            endRow: newRowPage,
            endCol: dataColIndex,
          });
        }
        setActiveCell({ rowIndex: newRowPage, columnIndex });
        scrollToRow?.(newRowPage, 'center');
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
        const deleteEvents = applyCellDeletion(range, items, visibleCols);
        for (const evt of deleteEvents) onCellValueChanged(evt);
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
