import { createInlineEdit } from '../services/inline-edit';
import { createRangeSelection } from '../services/range-selection';
import { createFillHandle } from '../services/fill-handle';
import { createCellClipboard } from '../services/cell-clipboard';
import { createGridFocus } from '../services/grid-focus';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';

type Row = { id: string; a: string; b: number };

const rows: Row[] = [
  { id: '1', a: 'one', b: 1 },
  { id: '2', a: 'two', b: 2 },
  { id: '3', a: 'three', b: 3 },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', type: 'text', editable: true },
  { columnId: 'b', name: 'B', type: 'numeric', editable: true },
];

const getRowId = (r: Row) => r.id;

describe('Angular spreadsheet hooks', () => {
  describe('createInlineEdit', () => {
    it('starts/commits an edit', () => {
      const events: { columnId: string; newValue: unknown }[] = [];
      const edit = createInlineEdit<Row>({
        columns,
        getRowId,
        onCellEdit: (e) => events.push({ columnId: e.columnId, newValue: e.newValue }),
      });

      expect(edit.editingCell()).toBeNull();
      edit.startEdit(rows[0], 'a');
      expect(edit.editingCell()).toEqual({ rowId: '1', columnId: 'a' });
      edit.setPendingValue('ONE');
      edit.commitEdit();
      expect(events).toEqual([{ columnId: 'a', newValue: 'ONE' }]);
    });
  });

  describe('createRangeSelection', () => {
    it('extends and tests cell membership', () => {
      const r = createRangeSelection({ rowCount: 3, colCount: 2 });
      r.startRange(0, 0);
      r.extendRange(2, 1);
      expect(r.range()).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 1 });
      expect(r.isInRange(1, 0)).toBe(true);
    });

    it('selectAll covers grid', () => {
      const r = createRangeSelection({ rowCount: 3, colCount: 2 });
      r.selectAll();
      expect(r.range()).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 1 });
    });
  });

  describe('createFillHandle', () => {
    it('commits a fill and emits events', () => {
      const events: ICellValueChangedEvent<Row>[] = [];
      const range = createRangeSelection({ rowCount: 3, colCount: 2 });
      const fill = createFillHandle<Row>({
        rangeSelection: range,
        rows,
        columns,
        onFillCells: (e) => events.push(...e),
      });
      range.startRange(0, 0);
      fill.startFill();
      fill.updateFill(2, 0);
      fill.commitFill();
      expect(events.length).toBe(2);
      expect(events[0].newValue).toBe('one');
    });
  });

  describe('createCellClipboard', () => {
    it('round-trips a single-cell value', async () => {
      const cb = { text: '' };
      const events: ICellValueChangedEvent<Row>[] = [];
      const range = createRangeSelection({ rowCount: 3, colCount: 2 });
      const clip = createCellClipboard<Row>({
        rangeSelection: range,
        rows,
        columns,
        onCellEdit: (e) => events.push(...e),
        clipboard: {
          readText: () => Promise.resolve(cb.text),
          writeText: (t) => {
            cb.text = t;
            return Promise.resolve();
          },
        },
      });
      range.startRange(0, 0);
      await clip.copyRange();
      expect(cb.text).toBe('one');
      range.startRange(2, 0);
      await clip.pasteRange();
      expect(events[0].newValue).toBe('one');
    });
  });

  describe('createGridFocus', () => {
    it('moves active cell with arrow handlers', () => {
      const focus = createGridFocus({ rowCount: 3, colCount: 2 });
      focus.setActiveCell({ row: 0, col: 0 });
      focus.moveDown();
      expect(focus.activeCell()).toEqual({ row: 1, col: 0 });
      focus.getKeyDownHandler()({ key: 'ArrowRight' });
      expect(focus.activeCell()).toEqual({ row: 1, col: 1 });
    });
  });
});
