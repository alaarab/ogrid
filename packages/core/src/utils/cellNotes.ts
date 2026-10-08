import type { ICellNote, RowId } from '../types/dataGridTypes';

/**
 * Lookup key for the cell at (`rowId`, `columnId`). Row ids are compared as
 * strings, the way the grid's DOM (`data-row-id`) carries them.
 */
export function cellNoteKey(rowId: RowId, columnId: string): string {
  return `${String(rowId)}\u0000${columnId}`;
}

/** Index notes by cell. When two notes target the same cell, the later one wins. */
export function indexCellNotes(notes: readonly ICellNote[] | null | undefined): Map<string, ICellNote> {
  const index = new Map<string, ICellNote>();
  if (!notes) return index;
  for (const note of notes) index.set(cellNoteKey(note.rowId, note.columnId), note);
  return index;
}

/**
 * Returns a new notes array with `note` set on its cell: it replaces the
 * cell's existing note in place, or is appended when the cell has none.
 */
export function upsertCellNote(notes: readonly ICellNote[] | null | undefined, note: ICellNote): ICellNote[] {
  const key = cellNoteKey(note.rowId, note.columnId);
  let replaced = false;
  const next: ICellNote[] = [];
  for (const n of notes ?? []) {
    if (cellNoteKey(n.rowId, n.columnId) === key) {
      // Duplicates collapse into one note at the first one's position.
      if (!replaced) next.push(note);
      replaced = true;
    } else {
      next.push(n);
    }
  }
  if (!replaced) next.push(note);
  return next;
}

/** Returns a new notes array without the note on (`rowId`, `columnId`). */
export function removeCellNote(notes: readonly ICellNote[] | null | undefined, rowId: RowId, columnId: string): ICellNote[] {
  const key = cellNoteKey(rowId, columnId);
  return (notes ?? []).filter((n) => cellNoteKey(n.rowId, n.columnId) !== key);
}

/**
 * Sets (`note`) or clears (`null`) the note on (`rowId`, `columnId`). Used to
 * apply and reverse a note edit (undo/redo) against the latest notes.
 */
export function setCellNote(
  notes: readonly ICellNote[] | null | undefined,
  rowId: RowId,
  columnId: string,
  note: ICellNote | null,
): ICellNote[] {
  return note ? upsertCellNote(notes, { ...note, rowId, columnId }) : removeCellNote(notes, rowId, columnId);
}
