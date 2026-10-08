// Cell notes (Excel "Notes", the legacy comments ExcelJS exposes as
// `cell.note`): read into the grid's ICellNote model and written back.
// Row ids are the grid's `__rowIdx`, column ids are column letters.

import type ExcelJS from 'exceljs';
import { cellNoteKey, type ICellNote } from '@alaarab/ogrid-core';
import { indexToColumnLetter, type SheetGridData } from './sheetMapper';

/** Plain text of an ExcelJS note (a string, or rich text runs). */
export function noteText(note: ExcelJS.Cell['note'] | undefined): string {
  if (note == null) return '';
  if (typeof note === 'string') return note;
  const texts = (note as ExcelJS.Comment).texts;
  return Array.isArray(texts) ? texts.map((t) => t.text ?? '').join('') : '';
}

/**
 * Notes on the sheet's loaded data cells. Notes on the promoted header row or
 * outside the loaded area are left alone (they pass through export untouched).
 */
export function readSheetNotes(sheet: ExcelJS.Worksheet, data: SheetGridData): ICellNote[] {
  const offset = data.formatting.headerPromoted ? 1 : 0;
  const colCount = data.columns.length;
  const notes: ICellNote[] = [];
  data.rows.forEach((row, index) => {
    const sheetRow = sheet.findRow(index + 1 + offset);
    if (!sheetRow) return;
    const last = Math.min(sheetRow.cellCount, colCount);
    for (let c = 1; c <= last; c++) {
      const cell = sheetRow.findCell(c);
      const text = noteText(cell?.note);
      if (text) notes.push({ rowId: row.__rowIdx, columnId: indexToColumnLetter(c - 1), text });
    }
  });
  return notes;
}

/**
 * ExcelJS has no API to remove a note (assigning `note` always creates one).
 * A loaded cell keeps it in two places: the cell's comment and the comment
 * its value model carried in from the file.
 */
function removeNote(cell: ExcelJS.Cell): void {
  const internal = cell as unknown as { _comment?: unknown; _value?: { model?: { comment?: unknown } } };
  internal._comment = undefined;
  const model = internal._value?.model;
  if (model?.comment) model.comment = undefined;
}

/**
 * Write note edits into `sheet`: cells whose note was removed lose it, new or
 * changed notes are set. Unchanged notes keep their original formatting.
 * `cellOf` maps a grid cell to its worksheet cell (undefined when the row or
 * column no longer exists).
 */
export function writeSheetNotes(
  initial: readonly ICellNote[],
  current: readonly ICellNote[],
  cellOf: (rowId: ICellNote['rowId'], columnId: string) => ExcelJS.Cell | undefined,
): void {
  const before = new Map(initial.map((n) => [cellNoteKey(n.rowId, n.columnId), n]));
  const after = new Map(current.map((n) => [cellNoteKey(n.rowId, n.columnId), n]));
  for (const [key, note] of before) {
    if (after.has(key)) continue;
    const cell = cellOf(note.rowId, note.columnId);
    if (cell) removeNote(cell);
  }
  for (const [key, note] of after) {
    const old = before.get(key);
    if (old && old.text === note.text) continue;
    const cell = cellOf(note.rowId, note.columnId);
    if (cell) cell.note = note.text;
  }
}
