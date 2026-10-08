import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { cellNoteKey, indexCellNotes, setCellNote } from '../utils';
import { useLatestRef } from './useLatestRef';
import type { GridContextMenuNotes } from '../components/GridContextMenu';
import type { UndoableAction } from './useUndoRedo';
import type { ICellNote, IColumnDef, RowId } from '../types';

/** Attribute on a noted cell (`<td>`) holding its note's row id. */
export const CELL_NOTE_ROW_ATTR = 'data-note-row-id';

/** Delay before a hover popover closes once the pointer leaves the cell (ms). */
const HOVER_CLOSE_DELAY = 150;

export interface CellNoteTarget {
  rowId: RowId;
  columnId: string;
  /** The cell element the popover points at. */
  anchor: HTMLElement;
}

interface PopoverTarget extends CellNoteTarget {
  mode: 'view' | 'edit';
}

export interface CellNotePopoverState extends PopoverTarget {
  /** The cell's current note (undefined for a new note). */
  note: ICellNote | undefined;
}

export interface UseCellNotesParams<T> {
  notes: ICellNote[] | undefined;
  onNotesChange: ((notes: ICellNote[]) => void) | undefined;
  /** Context menu items and Shift+F2 (requires `onNotesChange`). */
  editable: boolean;
  author?: string;
  wrapperRef: RefObject<HTMLElement | null>;
  getRowId: (item: T) => RowId;
  /** Displayed rows (sparse for a windowed source). */
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  /** Whether the cell context menu is open (its note section is built then). */
  menuOpen: boolean;
  recordAction: (action: UndoableAction) => void;
}

export interface UseCellNotesResult<T> {
  /** The note on a rendered cell; undefined when notes are off. Identity changes with the notes. */
  getCellNote: ((item: T, columnId: string) => ICellNote | undefined) | undefined;
  /** Note section of the context menu (editable notes only). */
  menu: GridContextMenuNotes | undefined;
  popover: CellNotePopoverState | null;
  closePopover: (restoreFocus?: boolean) => void;
  /** Save the editor's text (empty text deletes the note) and close it. */
  commitNote: (text: string, restoreFocus?: boolean) => void;
  /** Pointer entered / left the view popover (keeps it open while hovered). */
  onPopoverPointerEnter: () => void;
  onPopoverPointerLeave: () => void;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

/**
 * Excel-style cell notes for the shared table body: the note lookup for cell
 * rendering, the hover/focus note popover, the note editor (context menu,
 * Shift+F2) and undoable note edits.
 */
export function useCellNotes<T>(params: UseCellNotesParams<T>): UseCellNotesResult<T> {
  const { notes, onNotesChange, author, wrapperRef, getRowId, items, visibleCols, colOffset, activeCell, menuOpen } = params;
  const editable = params.editable && onNotesChange != null;
  const enabled = notes != null || editable;
  const index = useMemo(() => indexCellNotes(notes), [notes]);
  const latest = useLatestRef({ notes, onNotesChange, index, editable, author, recordAction: params.recordAction, items, visibleCols, colOffset, activeCell, getRowId });
  const [popover, setPopover] = useState<PopoverTarget | null>(null);
  const popoverRef = useLatestRef(popover);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while focus returns to the cell after the editor closes, so that focus doesn't reopen the note.
  const restoringFocus = useRef(false);

  const getCellNote = useMemo(
    () => (enabled ? (item: T, columnId: string) => index.get(cellNoteKey(getRowId(item), columnId)) : undefined),
    [enabled, index, getRowId]
  );

  const cancelClose = useCallback(() => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closePopover = useCallback((restoreFocus = false) => {
    cancelClose();
    const current = popoverRef.current;
    setPopover(null);
    if (restoreFocus && current?.anchor.isConnected) {
      restoringFocus.current = true;
      try {
        current.anchor.focus({ preventScroll: true });
      } finally {
        restoringFocus.current = false;
      }
    }
  }, [cancelClose, popoverRef]);

  const scheduleViewClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setPopover((p) => (p?.mode === 'view' ? null : p));
    }, HOVER_CLOSE_DELAY);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  /** The active cell's row id, column id and element, or null. */
  const resolveActiveTarget = useCallback((): CellNoteTarget | null => {
    const st = latest.current;
    const cell = st.activeCell;
    const wrapper = wrapperRef.current;
    if (!cell || !wrapper) return null;
    const item = st.items[cell.rowIndex];
    const col = st.visibleCols[cell.columnIndex - st.colOffset];
    if (item === undefined || !col) return null;
    const rowId = st.getRowId(item);
    const anchor = wrapper.querySelector<HTMLElement>(
      `tr[data-row-id="${cssEscape(String(rowId))}"] td[data-column-id="${cssEscape(col.columnId)}"]`
    );
    if (!anchor) return null;
    return { rowId, columnId: col.columnId, anchor };
  }, [latest, wrapperRef]);

  const openEditor = useCallback((target: CellNoteTarget) => {
    cancelClose();
    setPopover({ ...target, mode: 'edit' });
  }, [cancelClose]);

  /** Set or clear one cell's note against the latest notes. */
  const applyNote = useCallback((rowId: RowId, columnId: string, note: ICellNote | null) => {
    const st = latest.current;
    st.onNotesChange?.(setCellNote(st.notes, rowId, columnId, note));
  }, [latest]);

  const changeNote = useCallback((rowId: RowId, columnId: string, next: ICellNote | null) => {
    const prev = latest.current.index.get(cellNoteKey(rowId, columnId)) ?? null;
    if (prev === next) return;
    applyNote(rowId, columnId, next);
    latest.current.recordAction({
      undo: () => applyNote(rowId, columnId, prev),
      redo: () => applyNote(rowId, columnId, next),
    });
  }, [applyNote, latest]);

  const commitNote = useCallback((text: string, restoreFocus = true) => {
    const p = popoverRef.current;
    if (p?.mode !== 'edit') return;
    const st = latest.current;
    const prev = st.index.get(cellNoteKey(p.rowId, p.columnId));
    let next: ICellNote | null;
    if (text.trim() === '') next = null;
    else if (prev) next = prev.text === text ? prev : { ...prev, text };
    else {
      next = { rowId: p.rowId, columnId: p.columnId, text, createdAt: new Date().toISOString() };
      if (st.author) next.author = st.author;
    }
    closePopover(restoreFocus);
    changeNote(p.rowId, p.columnId, next);
  }, [popoverRef, latest, closePopover, changeNote]);

  // Hover and focus open the note; Shift+F2 opens the editor (Excel). Native
  // listeners on the wrapper see the key before the grid's React key handling.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !enabled) return;
    const notedCell = (target: EventTarget | null): HTMLElement | null => {
      const el = target instanceof Element ? target.closest<HTMLElement>(`td[${CELL_NOTE_ROW_ATTR}]`) : null;
      return el && wrapper.contains(el) ? el : null;
    };
    const showView = (cell: HTMLElement) => {
      const columnId = cell.getAttribute('data-column-id');
      const rowAttr = cell.getAttribute(CELL_NOTE_ROW_ATTR);
      if (columnId == null || rowAttr == null) return;
      const note = latest.current.index.get(cellNoteKey(rowAttr, columnId));
      if (!note) return;
      cancelClose();
      setPopover((p) => {
        if (p?.mode === 'edit') return p;
        if (p && p.anchor === cell) return p;
        return { rowId: note.rowId, columnId, anchor: cell, mode: 'view' };
      });
    };
    const onMouseOver = (e: MouseEvent) => {
      const cell = notedCell(e.target);
      if (cell) showView(cell);
    };
    const onMouseOut = (e: MouseEvent) => {
      const cell = notedCell(e.target);
      if (!cell || (e.relatedTarget instanceof Node && cell.contains(e.relatedTarget))) return;
      // Keyboard focus keeps the note open.
      if (cell.contains(document.activeElement)) return;
      if (popoverRef.current?.mode === 'view') scheduleViewClose();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (restoringFocus.current) return;
      const cell = notedCell(e.target);
      if (cell) showView(cell);
      else setPopover((p) => (p?.mode === 'view' ? null : p));
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && wrapper.contains(e.relatedTarget)) return;
      setPopover((p) => (p?.mode === 'view' ? null : p));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!latest.current.editable) return;
        const target = resolveActiveTarget();
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        openEditor(target);
      } else if (e.key === 'Escape' && popoverRef.current?.mode === 'view') {
        setPopover(null);
      }
    };
    wrapper.addEventListener('mouseover', onMouseOver);
    wrapper.addEventListener('mouseout', onMouseOut);
    wrapper.addEventListener('focusin', onFocusIn);
    wrapper.addEventListener('focusout', onFocusOut);
    wrapper.addEventListener('keydown', onKeyDown);
    return () => {
      wrapper.removeEventListener('mouseover', onMouseOver);
      wrapper.removeEventListener('mouseout', onMouseOut);
      wrapper.removeEventListener('focusin', onFocusIn);
      wrapper.removeEventListener('focusout', onFocusOut);
      wrapper.removeEventListener('keydown', onKeyDown);
    };
  }, [wrapperRef, enabled, latest, popoverRef, cancelClose, scheduleViewClose, resolveActiveTarget, openEditor]);

  // Close when the cell leaves the view (filtered out, paged or scrolled away)
  // or a viewed note is deleted.
  useEffect(() => {
    if (!popover) return;
    if (!popover.anchor.isConnected || (popover.mode === 'view' && !index.has(cellNoteKey(popover.rowId, popover.columnId)))) {
      setPopover(null);
    }
  });

  const menuTarget = editable && menuOpen && activeCell ? resolveActiveTarget() : null;
  const menuRowId = menuTarget?.rowId;
  const menuColumnId = menuTarget?.columnId;
  const menu = useMemo<GridContextMenuNotes | undefined>(() => {
    if (menuRowId === undefined || menuColumnId === undefined) return undefined;
    return {
      hasNote: index.has(cellNoteKey(menuRowId, menuColumnId)),
      onAction: (id: string) => {
        if (id === 'deleteNote') {
          setPopover(null);
          changeNote(menuRowId, menuColumnId, null);
          return;
        }
        // Resolve the cell again: the menu may have re-rendered rows since it opened.
        const target = resolveActiveTarget();
        if (target) openEditor(target);
      },
    };
  }, [menuRowId, menuColumnId, index, changeNote, resolveActiveTarget, openEditor]);

  const popoverState = useMemo<CellNotePopoverState | null>(
    () => (popover ? { ...popover, note: index.get(cellNoteKey(popover.rowId, popover.columnId)) } : null),
    [popover, index]
  );

  return {
    getCellNote,
    menu,
    popover: popoverState,
    closePopover,
    commitNote,
    onPopoverPointerEnter: cancelClose,
    onPopoverPointerLeave: scheduleViewClose,
  };
}
