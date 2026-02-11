import { useCallback, useRef } from 'react';
import { normalizeSelectionRange } from '../types';
import { getCellValue } from '../utils';
import { parseValue } from '../utils/valueParsers';
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
 * - Non-empty current + non-empty next → scan through non-empties, stop at last before empty/edge.
 * - Otherwise → skip empties, land on next non-empty or edge.
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
    items: T[];
    visibleCols: IColumnDef<T>[];
    colOffset: number;
    hasCheckboxCol: boolean;
    visibleColumnCount: number;
    getRowId: (item: T) => RowId;
  };
  state: {
    activeCell: IActiveCell | null;
    selectionRange: ISelectionRange | null;
    editingCell: EditingCell | null;
    selectedRowIds: Set<RowId>;
  };
  handlers: {
    setActiveCell: (cell: IActiveCell | null) => void;
    setSelectionRange: (range: ISelectionRange | null) => void;
    setEditingCell: (cell: EditingCell | null) => void;
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
    onUndo?: () => void;
    onRedo?: () => void;
    clearClipboardRanges?: () => void;
  };
  features: {
    editable?: boolean;
    onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
    rowSelection: RowSelectionMode;
    wrapperRef: React.RefObject<HTMLElement | null>;
  };
}

export interface UseKeyboardNavigationResult {
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Handles all keyboard navigation, shortcuts, and cell editing triggers for the grid.
 * @param params - Grouped data, state, handlers, and feature flags for keyboard interactions.
 * @returns Keyboard event handler for the grid wrapper.
 */
export function useKeyboardNavigation<T>(
  params: UseKeyboardNavigationParams<T>
): UseKeyboardNavigationResult {
  // Store latest params in a ref so handleGridKeyDown is a stable callback
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { data, state, handlers, features } = paramsRef.current;
      const { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId } = data;
      const { activeCell, selectionRange, editingCell, selectedRowIds } = state;
      const { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopy, handleCut, handlePaste, setContextMenu, onUndo, onRedo, clearClipboardRanges } = handlers;
      const { editable, onCellValueChanged, rowSelection, wrapperRef } = features;

      const maxRowIndex = items.length - 1;
      const maxColIndex = visibleColumnCount - 1 + colOffset;

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
      const isEmptyAt = (r: number, c: number): boolean => {
        if (r < 0 || r >= items.length || c < 0 || c >= visibleCols.length) return true;
        const v = getCellValue(items[r], visibleCols[c]);
        return v == null || v === '';
      };

      switch (e.key) {
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            if (editingCell != null) break; // let the input handle copy
            e.preventDefault();
            handleCopy();
          }
          break;
        case 'x':
          if (e.ctrlKey || e.metaKey) {
            if (editingCell != null) break; // let the input handle cut
            e.preventDefault();
            handleCut();
          }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            if (editingCell != null) break; // let the input handle paste
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
            clearClipboardRanges?.();
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
            if (editingCell != null) break; // let the input handle select-all
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
              const oldValue = getCellValue(item, col);
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
    [] // stable — reads latest values from paramsRef
  );

  return { handleGridKeyDown };
}
