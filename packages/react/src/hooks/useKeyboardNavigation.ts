import { useCallback, useRef } from 'react';
import { getSelectAllRange, isColumnEditable, expandRangeToMerges, isCoveredCell, rangesEqual } from '@alaarab/ogrid-core';
import type { IMergeLayout } from '@alaarab/ogrid-core';
import { getCellValue, computeTabNavigation, computeArrowNavigation, applyCellDeletion, getScrollTopForRow, getOppositeCorner, booleanParser, parseValue } from '../utils';
import { CELL_EDITOR_ATTR } from '../constants/domHelpers';
import { scrollCellIntoView, type ScrollToRowIndex } from '../utils/scrollCellIntoView';
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
import type { ClipboardCopyEventLike, ClipboardPasteEventLike } from './useClipboard';
import type { ContextMenuPosition } from './useContextMenu';
import { TEXT_ENTRY_SELECTOR } from './useClipboardMarks';

export interface UseKeyboardNavigationParams<T> {
  data: {
    items: T[];
    visibleCols: IColumnDef<T>[];
    colOffset: number;
    hasCheckboxCol: boolean;
    visibleColumnCount: number;
    getRowId: (item: T) => RowId;
    /** Merged cells: arrows and Tab step over a merge as one cell. */
    mergeLayout?: IMergeLayout | null;
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
    /** @deprecated Unused: Ctrl/Cmd+C now goes through the native `copy` event (`handleCopyEvent`). */
    handleCopy?: () => void;
    /** @deprecated Unused: Ctrl/Cmd+X now goes through the native `cut` event (`handleCutEvent`). */
    handleCut?: () => void;
    /** Copy from a native `copy` event; see `handleGridCopy`. */
    handleCopyEvent: (event: ClipboardCopyEventLike) => void;
    /** Cut from a native `cut` event; see `handleGridCut`. */
    handleCutEvent: (event: ClipboardCopyEventLike) => void;
    /** Paste from a native `paste` event; see `handleGridPaste`. */
    handlePasteEvent: (event: ClipboardPasteEventLike) => void;
    /** Ctrl/Cmd+Shift+V: make the paste event that follows paste values only. */
    armPasteValues?: () => void;
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
    /** Virtual grids: scrolls a row into view by index (rows off screen aren't rendered). */
    scrollToIndexRef?: React.RefObject<ScrollToRowIndex | null>;
    onKeyDown?: (event: React.KeyboardEvent) => void;
    fillDown?: () => void;
  };
}

export interface UseKeyboardNavigationResult {
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
  /**
   * `paste` handler for the grid wrapper. Ctrl/Cmd+V and Shift+Insert are left
   * to the browser in `handleGridKeyDown`, so the native event arrives here
   * with the clipboard text and is the one place the shortcut pastes from.
   * Pastes aimed at an open cell editor or any other text input stay with it.
   */
  handleGridPaste: (e: React.ClipboardEvent) => void;
  /**
   * `copy` handler for the grid wrapper. Ctrl/Cmd+C is left to the browser in
   * `handleGridKeyDown`; the native event that follows lets the grid put the
   * TSV on `clipboardData`, which works without `navigator.clipboard` (plain
   * http). Same target filtering as `handleGridPaste`.
   */
  handleGridCopy: (e: React.ClipboardEvent) => void;
  /** `cut` handler for the grid wrapper (Ctrl/Cmd+X); see `handleGridCopy`. */
  handleGridCut: (e: React.ClipboardEvent) => void;
}

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

function getKeyTargetKind(e: Pick<React.SyntheticEvent, 'target' | 'currentTarget'>): KeyTargetKind {
  const target = e.target as Element | null | undefined;
  const root = e.currentTarget as Element | null | undefined;
  if (target == null || typeof target.closest !== 'function' || target === root) return 'grid';
  if (target.closest(`[${CELL_EDITOR_ATTR}]`)) return 'editor';
  if (root != null && typeof root.contains === 'function' && !root.contains(target)) return 'outside';
  if (target.matches('[data-row-index][data-col-index]')) return 'grid';
  if (target.closest(NON_CELL_REGION_SELECTOR) || target.matches(TEXT_ENTRY_SELECTOR)) return 'outside';
  return target.matches(CELL_CONTROL_SELECTOR) ? 'control' : 'grid';
}

/** True when a native clipboard event belongs to the grid rather than a cell editor or other input. */
function isGridClipboardEvent(e: React.ClipboardEvent, editingCell: EditingCell | null): boolean {
  const targetKind = getKeyTargetKind(e);
  // Editors and other text inputs (header filters, popovers) own their clipboard.
  if (targetKind === 'editor' || targetKind === 'outside') return false;
  return editingCell == null;
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
      const { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId, mergeLayout } = data;
      const { activeCell, selectionRange, editingCell, selectedRowIds } = state;
      const { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, setContextMenu, onUndo, onRedo, clearClipboardRanges, beginBatch, endBatch } = handlers;
      const { editable, onCellValueChanged, rowSelection, wrapperRef, scrollToIndexRef, onKeyDown, fillDown } = features;

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
        let next = computeTabNavigation(from.rowIndex, from.columnIndex, maxRowIndex, maxColIndex, colOffset, backward);
        // Cells covered by a merge are not tab stops; the merge's anchor is.
        while (mergeLayout && isCoveredCell(mergeLayout, next.rowIndex, next.columnIndex - colOffset)) {
          const after = computeTabNavigation(next.rowIndex, next.columnIndex, maxRowIndex, maxColIndex, colOffset, backward);
          if (after.rowIndex === next.rowIndex && after.columnIndex === next.columnIndex) return false;
          next = after;
        }
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
        } else if ((e.ctrlKey || e.metaKey) && editingCell == null) {
          // Undo/redo apply to the whole grid (e.g. a row deleted from the
          // menu cleared the selection), so they work without an active cell.
          const k = e.key.toLowerCase();
          const redoKey = k === 'y' || (k === 'z' && e.shiftKey);
          if (redoKey && onRedo) {
            e.preventDefault();
            onRedo();
          } else if (k === 'z' && !e.shiftKey && onUndo) {
            e.preventDefault();
            onUndo();
          }
        }
        return;
      }

      const { rowIndex, columnIndex } = activeCell;
      const dataColIndex = columnIndex - colOffset;
      const shift = e.shiftKey;
      // The row-selection checkbox column (index 0) is a navigable cell: ArrowLeft
      // from the first data column reaches it. It holds no cell data, so it has no
      // selection range, and copy, paste, Delete and editing don't apply there.
      const onCheckboxCol = hasCheckboxCol && columnIndex === 0;
      const moveToCheckboxCell = (row: number) => {
        setSelectionRange(null);
        setActiveCell({ rowIndex: row, columnIndex: 0 });
      };
      const moveToDataCell = (row: number, col: number) => {
        setSelectionRange({ startRow: row, startCol: col, endRow: row, endCol: col });
        setActiveCell({ rowIndex: row, columnIndex: col + colOffset });
      };
      if (onCheckboxCol && editingCell == null) {
        const ctrl = e.ctrlKey || e.metaKey;
        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowDown': {
            e.preventDefault();
            const down = e.key === 'ArrowDown';
            const next = ctrl ? (down ? maxRowIndex : 0) : Math.max(0, Math.min(rowIndex + (down ? 1 : -1), maxRowIndex));
            moveToCheckboxCell(next);
            return;
          }
          case 'ArrowLeft':
            e.preventDefault();
            return;
          case 'ArrowRight':
            e.preventDefault();
            moveToDataCell(rowIndex, ctrl ? visibleColumnCount - 1 : 0);
            return;
          case 'Tab':
            // Tab order runs over the data cells; the checkbox cell sits just
            // before the row's first data cell.
            if (!shift) {
              e.preventDefault();
              moveToDataCell(rowIndex, 0);
            } else if (moveByTab({ rowIndex, columnIndex: colOffset }, true)) {
              e.preventDefault();
            }
            return;
          default:
            break;
        }
      }
      const isEmptyAt = (r: number, c: number): boolean => {
        // A merged cell's covered cells read as empty (Excel).
        if (mergeLayout && isCoveredCell(mergeLayout, r, c)) return true;
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
        case 'x':
          // Ctrl/Cmd+C and Ctrl/Cmd+X are deliberately not handled (and not
          // prevented) here: the browser follows them with a native `copy` /
          // `cut` event, and handleGridCopy / handleGridCut put the TSV on its
          // clipboardData. Copying here as well would copy twice, and
          // preventing the keydown would suppress the event, leaving only
          // navigator.clipboard.writeText, which is missing on plain http.
          break;
        case 'v':
          // Ctrl/Cmd+V is deliberately not handled (and not prevented) here:
          // the browser follows it with a native `paste` event that carries the
          // clipboard text, and handleGridPaste pastes from that. Reading the
          // clipboard here as well would paste twice, and
          // navigator.clipboard.readText is unavailable on plain http and
          // denied by default in Firefox/Safari anyway.
          // Ctrl/Cmd+Shift+V marks that paste event as values only.
          if (shift && (e.ctrlKey || e.metaKey) && editingCell == null) handlers.armPasteValues?.();
          break;
        case 'ArrowDown':
        case 'ArrowUp':
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (editingCell != null) break;
          e.preventDefault();
          if (e.key === 'ArrowLeft' && hasCheckboxCol && !shift && !(e.ctrlKey || e.metaKey) && columnIndex === colOffset) {
            moveToCheckboxCell(rowIndex);
            break;
          }
          // Shift+Arrow: the active cell is the anchor and stays put (Excel);
          // the far corner of the range is the end that moves.
          const extent = shift ? getOppositeCorner(selectionRange, rowIndex, dataColIndex) : null;
          const step = (fromRow: number, fromCol: number) => computeArrowNavigation({
            direction: e.key as 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight',
            rowIndex: fromRow,
            columnIndex: fromCol + colOffset,
            dataColIndex: fromCol,
            colOffset,
            maxRowIndex, maxColIndex,
            visibleColCount: visibleCols.length,
            isCtrl: e.ctrlKey || e.metaKey,
            isShift: shift,
            selectionRange,
            isEmptyAt,
            anchor: { rowIndex, dataColIndex },
          });
          let nav = step(extent ? extent.row : rowIndex, extent ? extent.col : dataColIndex);
          if (mergeLayout) {
            // A merge is one cell: a step that lands back in the same merge (the
            // active cell's, or one the range already holds) keeps going.
            const current = selectionRange ? expandRangeToMerges(selectionRange, mergeLayout) : null;
            const progressed = (n: typeof nav): boolean => {
              if (shift) return current == null || !rangesEqual(expandRangeToMerges(n.newRange, mergeLayout), current);
              const m = mergeLayout.mergeAt(n.newRowIndex, n.newDataColIndex);
              const row = m ? m.startRow : n.newRowIndex;
              const col = m ? m.startCol : n.newDataColIndex;
              return row !== rowIndex || col !== dataColIndex;
            };
            const maxSteps = items.length + visibleCols.length;
            for (let i = 0; i < maxSteps && !progressed(nav); i++) {
              const next = step(nav.newRowIndex, nav.newDataColIndex);
              if (next.newRowIndex === nav.newRowIndex && next.newDataColIndex === nav.newDataColIndex) break;
              nav = next;
            }
          }
          const { newRowIndex, newColumnIndex, newRange } = nav;
          setSelectionRange(newRange);
          if (shift) {
            if (wrapperRef.current) scrollCellIntoView(wrapperRef.current, newRowIndex, newColumnIndex, scrollToIndexRef?.current);
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
          const extent = shift && !onCheckboxCol ? getOppositeCorner(selectionRange, rowIndex, dataColIndex) : null;
          const fromRow = extent ? extent.row : rowIndex;
          const newRowPage = Math.max(0, Math.min(fromRow + pgDirection * pageSize, maxRowIndex));
          if (extent) {
            setSelectionRange(normalizeSelectionRange({
              startRow: rowIndex,
              startCol: dataColIndex,
              endRow: newRowPage,
              endCol: extent.col,
            }));
          } else if (onCheckboxCol) {
            moveToCheckboxCell(newRowPage);
          } else {
            setSelectionRange({
              startRow: newRowPage,
              startCol: dataColIndex,
              endRow: newRowPage,
              endCol: dataColIndex,
            });
            setActiveCell({ rowIndex: newRowPage, columnIndex });
          }
          // Scroll the new row into view. A virtual grid scrolls by index: a plain
          // PageUp/PageDown through the active cell change, a Shift-extend here,
          // since the active cell (the anchor) doesn't move.
          const scrollToIndex = scrollToIndexRef?.current;
          if (wrapper && scrollToIndex) {
            if (extent) scrollCellIntoView(wrapper, newRowPage, extent.col + colOffset, scrollToIndex);
          } else if (wrapper && !wrapper.hasAttribute('data-virtual-scroll')) {
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
        case ' ': {
          if (editingCell != null) break;
          // Space on the checkbox cell toggles its row, and Shift+Space there
          // selects the range from the last toggled row, like Shift+click on the
          // checkbox. Shift+Space in a data cell toggles the active row (WAI-ARIA grid).
          if (rowSelection !== 'none' && (e.shiftKey || onCheckboxCol)) {
            e.preventDefault();
            const item = items[rowIndex];
            if (item) {
              const id = getRowId(item);
              const isSelected = selectedRowIds.has(id);
              handleRowCheckboxChange(id, !isSelected, rowIndex, onCheckboxCol && e.shiftKey);
            }
            break;
          }
          // Space toggles an editable boolean (checkbox) cell.
          const col = visibleCols[dataColIndex];
          const item = items[rowIndex];
          if (e.shiftKey || !col || !item || col.type !== 'boolean') break;
          if (editable === false || onCellValueChanged == null || !isColumnEditable<T>(col, item)) break;
          e.preventDefault();
          const oldValue = getCellValue<T>(item, col);
          const checked = !!(booleanParser<T>({ newValue: oldValue, oldValue, data: item, column: col }) ?? oldValue);
          const result = parseValue<T>(!checked, oldValue, item, col);
          if (result.valid) onCellValueChanged({ item, columnId: col.columnId, oldValue, newValue: result.value, rowIndex });
          break;
        }
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
            const all = getSelectAllRange(items.length, visibleColumnCount);
            if (all) {
              setSelectionRange(all);
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
          if (onCheckboxCol && selectionRange == null) break;
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

  const handleGridPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (isGridClipboardEvent(e, paramsRef.current.state.editingCell)) paramsRef.current.handlers.handlePasteEvent(e);
    },
    [] // stable  -  reads latest values from paramsRef
  );

  const handleGridCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (isGridClipboardEvent(e, paramsRef.current.state.editingCell)) paramsRef.current.handlers.handleCopyEvent(e);
    },
    [] // stable  -  reads latest values from paramsRef
  );

  const handleGridCut = useCallback(
    (e: React.ClipboardEvent) => {
      if (isGridClipboardEvent(e, paramsRef.current.state.editingCell)) paramsRef.current.handlers.handleCutEvent(e);
    },
    [] // stable  -  reads latest values from paramsRef
  );

  return { handleGridKeyDown, handleGridPaste, handleGridCopy, handleGridCut };
}
