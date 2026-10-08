/**
 * Cell notes: ExcelJS notes load into the sheet state as ICellNote, edits are
 * undoable, and export writes them back through a real .xlsx round trip.
 */
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { noteText } from '../cellNotes';

async function roundTrip(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buf = await wb.xlsx.writeBuffer();
  return workbookFromBlob(new Blob([buf]));
}

async function sourceWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRows([['Item', 'Qty'], ['Apple', 3], ['Banana', 1], ['Cherry', 2]]);
  ws.getCell('A2').note = 'Check supplier';
  ws.getCell('B3').note = { texts: [{ text: 'Low ' }, { font: { bold: true }, text: 'stock' }] } as ExcelJS.Comment;
  // A note on the promoted header row is not a data cell: it passes through.
  ws.getCell('A1').note = 'Header note';
  return roundTrip(wb);
}

describe('xlsx cell notes', () => {
  test('noteText reads plain and rich-text notes', () => {
    expect(noteText('plain')).toBe('plain');
    expect(noteText({ texts: [{ text: 'a' }, { text: 'b' }] } as ExcelJS.Comment)).toBe('ab');
    expect(noteText(undefined)).toBe('');
  });

  test('loads notes on data cells, keyed by row id and column letter', async () => {
    const doc = new XlsxWorkbookDocument(await sourceWorkbook());
    expect(doc.sheet('Data')?.notes).toEqual([
      { rowId: 0, columnId: 'A', text: 'Check supplier' },
      { rowId: 1, columnId: 'B', text: 'Low stock' },
    ]);
  });

  test('edits are undoable and export writes added, changed and deleted notes', async () => {
    const doc = new XlsxWorkbookDocument(await sourceWorkbook());
    const before = doc.sheet('Data')?.notes ?? [];
    doc.setNotes('Data', [
      { rowId: 0, columnId: 'A', text: 'Supplier confirmed' },
      { rowId: 2, columnId: 'A', text: 'New note' },
    ]);
    await Promise.resolve();
    expect(doc.canUndo('Data')).toBe(true);
    doc.undo('Data');
    expect(doc.sheet('Data')?.notes).toBe(before);
    doc.redo('Data');
    expect(doc.sheet('Data')?.notes.map((n) => n.text)).toEqual(['Supplier confirmed', 'New note']);

    const out = await roundTrip(await doc.toWorkbook());
    const ws = out.getWorksheet('Data');
    expect(noteText(ws?.getCell('A2').note)).toBe('Supplier confirmed');
    expect(noteText(ws?.getCell('A4').note)).toBe('New note');
    expect(ws?.getCell('B3').note).toBeUndefined();
    expect(noteText(ws?.getCell('A1').note)).toBe('Header note');

    // Reopened, the exported file shows the same notes.
    expect(new XlsxWorkbookDocument(out).sheet('Data')?.notes).toEqual([
      { rowId: 0, columnId: 'A', text: 'Supplier confirmed' },
      { rowId: 2, columnId: 'A', text: 'New note' },
    ]);
  });

  test('unchanged notes keep their rich-text formatting on export', async () => {
    const doc = new XlsxWorkbookDocument(await sourceWorkbook());
    const notes = doc.sheet('Data')?.notes ?? [];
    doc.setNotes('Data', notes.filter((n) => n.columnId === 'B'));
    const ws = (await roundTrip(await doc.toWorkbook())).getWorksheet('Data');
    const note = ws?.getCell('B3').note as ExcelJS.Comment;
    expect(note.texts?.[1]?.font?.bold).toBe(true);
    expect(ws?.getCell('A2').note).toBeUndefined();
  });
});
