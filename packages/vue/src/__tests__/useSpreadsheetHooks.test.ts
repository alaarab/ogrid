import { useInlineEdit } from '../composables/useInlineEdit';
import { useRangeSelection } from '../composables/useRangeSelection';
import { useFillHandle } from '../composables/useFillHandle';
import { useCellClipboard } from '../composables/useCellClipboard';
import { useGridFocus } from '../composables/useGridFocus';
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

describe('Vue spreadsheet hooks', () => {
  describe('useInlineEdit', () => {
    it('starts/commits an edit', () => {
      const events: { columnId: string; newValue: unknown }[] = [];
      const edit = useInlineEdit<Row>({
        columns,
        getRowId,
        onCellEdit: (e) => events.push({ columnId: e.columnId, newValue: e.newValue }),
      });

      expect(edit.editingCell.value).toBeNull();
      edit.startEdit(rows[0], 'a');
      expect(edit.editingCell.value).toEqual({ rowId: '1', columnId: 'a' });
      expect(edit.pendingValue.value).toBe('one');
      edit.setPendingValue('ONE');
      edit.commitEdit();
      expect(events).toEqual([{ columnId: 'a', newValue: 'ONE' }]);
      expect(edit.editingCell.value).toBeNull();
    });

    it('cancels without firing onCellEdit', () => {
      const events: unknown[] = [];
      const edit = useInlineEdit<Row>({
        columns,
        getRowId,
        onCellEdit: (e) => events.push(e),
      });
      edit.startEdit(rows[0], 'a');
      edit.setPendingValue('CHANGED');
      edit.cancelEdit();
      expect(events).toHaveLength(0);
    });
  });

  describe('useRangeSelection', () => {
    it('extends and tests cell membership', () => {
      const r = useRangeSelection({ rowCount: 3, colCount: 2 });
      r.startRange(0, 0);
      r.extendRange(2, 1);
      expect(r.range.value).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 2,
        endCol: 1,
      });
      expect(r.isInRange(1, 0)).toBe(true);
      expect(r.isInRange(2, 1)).toBe(true);
    });

    it('selectAll covers grid', () => {
      const r = useRangeSelection({ rowCount: 3, colCount: 2 });
      r.selectAll();
      expect(r.range.value).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 2,
        endCol: 1,
      });
    });

    it('clearRange resets', () => {
      const r = useRangeSelection({ rowCount: 3, colCount: 2 });
      r.startRange(0, 0);
      r.clearRange();
      expect(r.range.value).toBeNull();
    });
  });

  describe('useFillHandle', () => {
    it('commits a fill and emits events', () => {
      const events: ICellValueChangedEvent<Row>[] = [];
      const range = useRangeSelection({ rowCount: 3, colCount: 2 });
      const fill = useFillHandle<Row>({
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

  describe('useCellClipboard', () => {
    it('copies and pastes a single cell', async () => {
      const cb = { text: '' };
      const events: ICellValueChangedEvent<Row>[] = [];
      const range = useRangeSelection({ rowCount: 3, colCount: 2 });
      const clip = useCellClipboard<Row>({
        rangeSelection: range,
        rows,
        columns,
        onCellEdit: (e) => events.push(...e),
        clipboard: {
          readText: () => Promise.resolve(cb.text),
          writeText: (t: string) => {
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
      expect(events.length).toBe(1);
      expect(events[0].newValue).toBe('one');
    });
  });

  describe('useGridFocus', () => {
    it('moves active cell with handlers', () => {
      const focus = useGridFocus({ rowCount: 3, colCount: 2 });
      focus.setActiveCell({ row: 0, col: 0 });
      focus.moveDown();
      expect(focus.activeCell.value).toEqual({ row: 1, col: 0 });
      focus.moveRight();
      expect(focus.activeCell.value).toEqual({ row: 1, col: 1 });
    });

    it('keyDownHandler responds to ArrowDown', () => {
      const focus = useGridFocus({ rowCount: 3, colCount: 2 });
      focus.setActiveCell({ row: 0, col: 0 });
      focus.getKeyDownHandler()({ key: 'ArrowDown' });
      expect(focus.activeCell.value).toEqual({ row: 1, col: 0 });
    });
  });
});
