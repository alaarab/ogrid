import { cellNoteKey, indexCellNotes, upsertCellNote, removeCellNote, setCellNote } from '../cellNotes';
import { getCellNoteMenuItems } from '../gridContextMenuHelpers';
import type { ICellNote } from '../../types/dataGridTypes';

const a: ICellNote = { rowId: 1, columnId: 'name', text: 'A' };
const b: ICellNote = { rowId: 'x', columnId: 'qty', text: 'B', author: 'Ala' };

describe('cell note helpers', () => {
  it('keys row ids as strings, like the DOM carries them', () => {
    expect(cellNoteKey(1, 'name')).toBe(cellNoteKey('1', 'name'));
    expect(cellNoteKey(1, 'name')).not.toBe(cellNoteKey(1, 'qty'));
  });

  it('indexes notes by cell, the later duplicate winning', () => {
    const dup = { ...a, text: 'A2' };
    const index = indexCellNotes([a, b, dup]);
    expect(index.size).toBe(2);
    expect(index.get(cellNoteKey(1, 'name'))).toBe(dup);
    expect(indexCellNotes(undefined).size).toBe(0);
  });

  it('upsert replaces a cell note in place or appends a new one, without mutating', () => {
    const list = [a, b];
    const edited = upsertCellNote(list, { ...a, text: 'edited' });
    expect(edited.map((n) => n.text)).toEqual(['edited', 'B']);
    expect(list[0]).toBe(a);
    const added = upsertCellNote(list, { rowId: 2, columnId: 'name', text: 'C' });
    expect(added.map((n) => n.text)).toEqual(['A', 'B', 'C']);
    expect(upsertCellNote(undefined, a)).toEqual([a]);
  });

  it('upsert collapses duplicate notes on the cell into one', () => {
    expect(upsertCellNote([a, b, { ...a, text: 'dup' }], { ...a, text: 'one' }).map((n) => n.text)).toEqual(['one', 'B']);
  });

  it('remove drops the cell note and leaves the others', () => {
    expect(removeCellNote([a, b], 'x', 'qty')).toEqual([a]);
    expect(removeCellNote([a, b], 9, 'qty')).toEqual([a, b]);
  });

  it('setCellNote sets or clears, pinning the note to the given cell', () => {
    expect(setCellNote([a], 1, 'name', null)).toEqual([]);
    expect(setCellNote([a], 5, 'qty', b)).toEqual([a, { ...b, rowId: 5, columnId: 'qty' }]);
  });

  it('menu offers New note without a note, Edit/Delete note with one', () => {
    expect(getCellNoteMenuItems(false).map((i) => i.id)).toEqual(['newNote']);
    expect(getCellNoteMenuItems(true).map((i) => i.id)).toEqual(['editNote', 'deleteNote']);
    expect(getCellNoteMenuItems(true)[0]?.dividerBefore).toBe(true);
  });
});
