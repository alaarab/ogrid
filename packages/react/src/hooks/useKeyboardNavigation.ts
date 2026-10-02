import { useCallback, useRef } from 'react';
import { getCellValue, computeTabNavigation, computeArrowNavigation, applyCellDeletion, getScrollTopForRow, getOppositeCorner } from '../utils';
import { CELL_EDITOR_ATTR } from '../constants/domHelpers';
import { normalizeSelectionRange } from '../types';
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
    /** Group multi-cell edits (range delete) into one undo step. */
    beginBatch?: () => void;
    endBatch?: () => void;
  };
  features: {
    editable?: boolean;
    onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
    rowSelection: RowSelectionMode;
    wrapperRef: React.RefObject<HTMLElement | null>;
    onKeyDown?: (event: React.KeyboardEvent) => void;
    fillDown?: () => void;
  };
}

export interface UseKeyboardNavigationResult {
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
}

/** Text-entry controls: keystrokes typed into these never belong to the grid. */
const TEXT_ENTRY_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable=""], [contenteditable="true"]';
/** Header, menus and popups that live in the wrapper's DOM rather than a portal. */
const NON_CELL_REGION_SELECTOR = 'thead, [role="columnheader"], [role="menu"], [role="dialog"], [role="listbox"]';
/** In-cell controls that use Space/Enter for their own activation. */
const CELL_CONTROL_SELECTOR = 'button, a[href], input, [role="button"], [role="checkbox"], [role="switch"], [role="link"]';

/**
 * Where a keydown came from:
 * - `grid`: the wrapper or a body cell (or a programmatic call with no DOM target)
 * - `control`: a button/checkbox/link rendered inside a body cell
 * - `editor`: an inline cell editor, including its portaled dropdown
 * - `outside`: anything else (header controls, filter popovers, menus)
 *
 * React synthetic events bubble through portals, so keystrokes typed into a
 * portaled filter popover still reach the wrapper's onKeyDown.
 */
type KeyTargetKind = 'grid' | 'control' | 'editor' | 'outside';

function getKeyTargetKind(e: React.KeyboardEvent): KeyTargetKind {
  const target = e.target as Element | null | undefined;
  const root = e.currentTarget as Element | null | undefined;
  if (target == null || typeof target.closest !== 'function' || target === root) return 'grid';
  if (target.closest(`[${CELL_EDITOR_ATTR}]`)) return 'editor';
  if (root != null && typeof root.contains === 'function' && !root.contains(target)) return 'outside';
  if (target.matches('[data-row-index][data-col-index]')) return 'grid';
  if (target.closest(NON_CELL_REGION_SELECTOR) || target.matches(TEXT_ENTRY_SELECTOR)) return 'outside';
  return target.matches(CELL_CONTROL_SELECTOR) ? 'control' : 'grid';
}

/** Scrolls a body cell into view below the sticky header (used for the moving end of Shift+extend). */
function scrollCellIntoView(wrapper: HTMLElement, rowIndex: number, columnIndex: number): void {
  const cell = wrapper.querySelector(`[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`);
  if (!cell) return;
  const thead = wrapper.querySelector('thead');
  const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
  const wrapperRect = wrapper.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const visibleTop = wrapperRect.top + headerHeight;
  if (cellRect.top < visibleTop) wrapper.scrollTop -= visibleTop - cellRect.top;
  else if (cellRect.bottom > wrapperRect.bottom) wrapper.scrollTop += cellRect.bottom - wrapperRect.bottom;
  if (wrapper.scrollWidth > wrapper.clientWidth) {
    if (cellRect.left < wrapperRect.left) wrapper.scrollLeft -= wrapperRect.left - cellRect.left;
    else if (cellRect.right > wrapperRect.right) wrapper.scrollLeft += cellRect.right - wrapperRect.right;
  }
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
      const { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopy, handleCut, handlePaste, setContextMenu, onUndo, onRedo, clearClipboardRanges, beginBatch, endBatch } = handlers;
      const { editable, onCellValueChanged, rowSelection, wrapperRef, onKeyDown, fillDown } = features;

      // Consumer intercept: call consumer's handler first; skip grid default if preventDefault() was called
      if (onKeyDown) {
        onKeyDown(e);
        if (e.defaultPrevented) return;
      }

      const targetKind = getKeyTargetKind(e);
      if (targetKind === 'outside') return;
      // Space/Enter activate the focused in-cell control (row or boolean checkbox).
      if (targetKind === 'control' && (e.key === ' ' || e.key === 'Enter')) return;

      const maxRowIndex = items.length - 1;
      const maxColIndex = visibleColumnCount - 1 + colOffset;

      if (items.length === 0) return;

      // Moves the active cell one step in Tab order. Returns false at the grid's
      // first/last cell so Tab can carry focus out of the grid (no keyboard trap).
      const moveByTab = (from: IActiveCell, backward: boolean): boolean => {
        const next = computeTabNavigation(from.rowIndex, from.columnIndex, maxRowIndex, maxColIndex, colOffset, backward);
        if (next.rowIndex === from.rowIndex && next.columnIndex === from.columnIndex) return false;
        const nextDataCol = next.columnIndex - colOffset;
        setSelectionRange({ startRow: next.rowIndex, startCol: nextDataCol, endRow: next.rowIndex, endCol: nextDataCol });
        setActiveCell(next);
        return true;
      };

      if (targetKind === 'editor') {
        // Editors own their keys. On Tab the editor commits first (its handler
        // runs before this one), then the grid closes it and moves on, Excel-style.
        if (e.key === 'Tab' && editingCell != null && activeCell != null) {
          e.preventDefault();
          setEditingCell(null);
          moveByTab(activeCell, e.shiftKey);
        }
        return;
      }

      if (activeCell === null) {
        if (
          [
            'ArrowDown',
            'ArrowUp',
            'ArrowLeft',
            'ArrowRight',
            'Enter',
            'Home',
            'End',
            'PageDown',
            'PageUp',
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
        const row = items[r];
        const col = visibleCols[c];
        if (row === undefined || col === undefined) return true;
        const v = getCellValue<T>(row, col);
        return v == null || v === '';
      };

      // Letter shortcuts compare lowercase: with Shift or Caps Lock held the
      // browser reports 'Z' not 'z', which broke Ctrl+Shift+Z (redo).
      const key = (e.ctrlKey || e.metaKey) && e.key.length === 1 ? e.key.toLowerCase() : e.key;
      switch (key) {
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
        case 'ArrowDown':
        case 'ArrowUp':
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (editingCell != null) break;
          e.preventDefault();
          // Shift+Arrow: the active cell is the anchor and stays put (Excel);
          // the far corner of the range is the end that moves.
          const extent = shift ? getOppositeCorner(selectionRange, rowIndex, dataColIndex) : null;
          const { newRowIndex, newColumnIndex, newRange } = computeArrowNavigation({
            direction: e.key as 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight',
            rowIndex: extent ? extent.row : rowIndex,
            columnIndex: extent ? extent.col + colOffset : columnIndex,
            dataColIndex: extent ? extent.col : dataColIndex,
            colOffset,
            maxRowIndex, maxColIndex,
            visibleColCount: visibleCols.length,
            isCtrl: e.ctrlKey || e.metaKey,
            isShift: shift,
            selectionRange,
            isEmptyAt,
            anchor: { rowIndex, dataColIndex },
          });
          setSelectionRange(newRange);
          if (shift) {
            if (wrapperRef.current) scrollCellIntoView(wrapperRef.current, newRowIndex, newColumnIndex);
          } else {
            setActiveCell({ rowIndex: newRowIndex, columnIndex: newColumnIndex });
          }
          break;
        }
        case 'Tab': {
          // A popover editor can't be committed from here; leave Tab to the browser.
          if (editingCell != null) break;
          if (moveByTab(activeCell, e.shiftKey)) e.preventDefault();
          break;
        }
        case 'Home': {
          if (editingCell != null) break;
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
          if (editingCell != null) break;
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
        case 'PageDown':
        case 'PageUp': {
          if (editingCell != null) break;
          e.preventDefault();
          const wrapper = wrapperRef.current;
          let pageSize = 10;
          let rowHeight = 36;
          if (wrapper) {
            const firstRow = wrapper.querySelector<HTMLElement>('tbody tr[data-row-id]');
            const configuredHeight = Number.parseFloat(wrapper.style.getPropertyValue('--ogrid-row-height'));
            if (configuredHeight > 0) rowHeight = configuredHeight;
            else if (firstRow && firstRow.offsetHeight > 0) rowHeight = firstRow.offsetHeight;
            const headerHeight = wrapper.querySelector('thead')?.getBoundingClientRect().height ?? 0;
            if (wrapper.clientHeight > 0) {
              pageSize = Math.max(1, Math.floor((wrapper.clientHeight - headerHeight) / rowHeight));
            }
          }
          const pgDirection = e.key === 'PageDown' ? 1 : -1;
          // Shift extends from the active cell (anchor) by moving the range's far row.
          const extent = shift ? getOppositeCorner(selectionRange, rowIndex, dataColIndex) : null;
          const fromRow = extent ? extent.row : rowIndex;
          const newRowPage = Math.max(0, Math.min(fromRow + pgDirection * pageSize, maxRowIndex));
          if (extent) {
            setSelectionRange(normalizeSelectionRange({
              startRow: rowIndex,
              startCol: dataColIndex,
              endRow: newRowPage,
              endCol: extent.col,
            }));
          } else {
            setSelectionRange({
              startRow: newRowPage,
              startCol: dataColIndex,
              endRow: newRowPage,
              endCol: dataColIndex,
            });
            setActiveCell({ rowIndex: newRowPage, columnIndex });
          }
          // Scroll the new row into view
          if (wrapper && !wrapper.hasAttribute('data-virtual-scroll')) {
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
          // Always consumed here (cancel edit or clear the selection); the full
          // screen Escape listener checks defaultPrevented so it doesn't also exit.
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
          // Shift+Space toggles the active row's selection from any column (WAI-ARIA
          // grid); the checkbox column itself isn't a navigation stop.
          if (
            rowSelection !== 'none' &&
            editingCell == null &&
            (e.shiftKey || (columnIndex === 0 && hasCheckboxCol))
          ) {
            e.preventDefault();
            const item = items[rowIndex];
            if (item) {
              const id = getRowId(item);
              const isSelected = selectedRowIds.has(id);
              handleRowCheckboxChange(id, !isSelected, rowIndex, false);
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
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            if (editingCell != null) break;
            if (editable !== false && fillDown) {
              e.preventDefault();
              fillDown();
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
          const deleteEvents = applyCellDeletion(range, items, visibleCols);
          beginBatch?.();
          try {
            for (const evt of deleteEvents) onCellValueChanged(evt);
          } finally {
            endBatch?.();
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
    [] // stable  -  reads latest values from paramsRef
  );

  return { handleGridKeyDown };
}
