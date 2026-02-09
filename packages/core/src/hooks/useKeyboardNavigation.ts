import { useCallback } from 'react';
import { normalizeSelectionRange } from '../types';
import { getCellValue } from '../utils';
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

export interface UseKeyboardNavigationParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  hasCheckboxCol: boolean;
  visibleColumnCount: number;
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  editable: boolean | undefined;
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  getRowId: (item: T) => RowId;
  editingCell: EditingCell | null;
  setEditingCell: (cell: EditingCell | null) => void;
  rowSelection: RowSelectionMode;
  selectedRowIds: Set<RowId>;
  handleRowCheckboxChange: (
    rowId: RowId,
    checked: boolean,
    rowIndex: number,
    shiftKey: boolean
  ) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  setContextMenu: (pos: ContextMenuPosition | null) => void;
  wrapperRef: React.RefObject<HTMLElement | null>;
  onUndo?: () => void;
  onRedo?: () => void;
}

export interface UseKeyboardNavigationResult {
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
}

export function useKeyboardNavigation<T>(
  params: UseKeyboardNavigationParams<T>
): UseKeyboardNavigationResult {
  const {
    items,
    visibleCols,
    colOffset,
    hasCheckboxCol,
    visibleColumnCount,
    activeCell,
    setActiveCell,
    selectionRange,
    setSelectionRange,
    editable,
    onCellValueChanged,
    getRowId,
    editingCell,
    setEditingCell,
    rowSelection,
    selectedRowIds,
    handleRowCheckboxChange,
    handleCopy,
    handleCut,
    handlePaste,
    setContextMenu,
    wrapperRef,
    onUndo,
    onRedo,
  } = params;

  const maxRowIndex = items.length - 1;
  const maxColIndex = visibleColumnCount - 1 + colOffset;

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return;

      if (activeCell === null) {
        if (
          [
            'ArrowDown',
            'ArrowUp',
            'ArrowLeft',
            'ArrowRight',
            'Tab',
            'Enter',
            'Home',
            'End',
          ].includes(e.key)
        ) {
          setActiveCell({ rowIndex: 0, columnIndex: colOffset });
          e.preventDefault();
        }
        return;
      }

      const { rowIndex, columnIndex } = activeCell;
      const dataColIndex = columnIndex - colOffset;
      const shift = e.shiftKey;

      switch (e.key) {
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleCopy();
          }
          break;
        case 'x':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleCut();
          }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            void handlePaste();
          }
          break;
        case 'ArrowDown': {
          e.preventDefault();
          const newRow = Math.min(rowIndex + 1, maxRowIndex);
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
            setSelectionRange({
              startRow: newRow,
              startCol: dataColIndex,
              endRow: newRow,
              endCol: dataColIndex,
            });
          }
          setActiveCell({ rowIndex: newRow, columnIndex });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const newRowUp = Math.max(rowIndex - 1, 0);
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
            setSelectionRange({
              startRow: newRowUp,
              startCol: dataColIndex,
              endRow: newRowUp,
              endCol: dataColIndex,
            });
          }
          setActiveCell({ rowIndex: newRowUp, columnIndex });
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const newCol = Math.min(columnIndex + 1, maxColIndex);
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
            setSelectionRange({
              startRow: rowIndex,
              startCol: newDataCol,
              endRow: rowIndex,
              endCol: newDataCol,
            });
          }
          setActiveCell({ rowIndex, columnIndex: newCol });
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const newColLeft = Math.max(columnIndex - 1, colOffset);
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
            setSelectionRange({
              startRow: rowIndex,
              startCol: newDataColLeft,
              endRow: rowIndex,
              endCol: newDataColLeft,
            });
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
          setSelectionRange({
            startRow: newRowTab,
            startCol: newDataColTab,
            endRow: newRowTab,
            endCol: newDataColTab,
          });
          setActiveCell({ rowIndex: newRowTab, columnIndex: newColTab });
          break;
        }
        case 'Home': {
          e.preventDefault();
          const newRowHome = e.ctrlKey ? 0 : rowIndex;
          setSelectionRange({
            startRow: newRowHome,
            startCol: 0,
            endRow: newRowHome,
            endCol: 0,
          });
          setActiveCell({ rowIndex: newRowHome, columnIndex: colOffset });
          break;
        }
        case 'End': {
          e.preventDefault();
          const newRowEnd = e.ctrlKey ? maxRowIndex : rowIndex;
          setSelectionRange({
            startRow: newRowEnd,
            startCol: visibleColumnCount - 1,
            endRow: newRowEnd,
            endCol: visibleColumnCount - 1,
          });
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
              if (
                editable !== false &&
                colEditable &&
                onCellValueChanged != null
              ) {
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
            setActiveCell(null);
            setSelectionRange(null);
          }
          break;
        case ' ':
          if (
            rowSelection !== 'none' &&
            columnIndex === 0 &&
            hasCheckboxCol
          ) {
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
            e.preventDefault();
            if (items.length > 0 && visibleColumnCount > 0) {
              setSelectionRange({
                startRow: 0,
                startCol: 0,
                endRow: items.length - 1,
                endCol: visibleColumnCount - 1,
              });
              setActiveCell({ rowIndex: 0, columnIndex: colOffset });
            }
          }
          break;
        case 'Delete':
        case 'Backspace': {
          if (editingCell != null) break;
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
              const oldValue = getCellValue(item, col);
              onCellValueChanged({
                item,
                columnId: col.columnId,
                field: col.columnId,
                oldValue,
                newValue: '',
                rowIndex: r,
              } as ICellValueChangedEvent<T>);
            }
          }
          break;
        }
        case 'F10':
          if (e.shiftKey) {
            e.preventDefault();
            if (activeCell != null && wrapperRef.current) {
              const sel = `[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.columnIndex}"]`;
              const cell = wrapperRef.current.querySelector(sel) as HTMLElement | null;
              if (cell) {
                const rect = cell.getBoundingClientRect();
                setContextMenu({
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                });
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
    },
    [
      items,
      activeCell,
      hasCheckboxCol,
      visibleColumnCount,
      visibleCols,
      colOffset,
      editable,
      onCellValueChanged,
      getRowId,
      editingCell,
      rowSelection,
      selectedRowIds,
      handleRowCheckboxChange,
      handleCopy,
      handleCut,
      handlePaste,
      selectionRange,
      setActiveCell,
      setSelectionRange,
      maxRowIndex,
      maxColIndex,
      setEditingCell,
      setContextMenu,
      wrapperRef,
      onUndo,
      onRedo,
    ]
  );

  return { handleGridKeyDown };
}
