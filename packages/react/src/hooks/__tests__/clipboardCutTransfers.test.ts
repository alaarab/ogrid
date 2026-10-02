import { act, renderHook } from '@testing-library/react';
import type { IColumnDef, ICellValueChangedEvent, ISelectionRange, IValueParserParams } from '../../types';
import { useClipboard } from '../useClipboard';
import { useCellClipboard } from '../useCellClipboard';
import { useRangeSelection } from '../useRangeSelection';

type Row = { id: number; a: string; b: string };
const range = (row: number, col = 0, endCol = col): ISelectionRange =>
  ({ startRow: row, endRow: row, startCol: col, endCol });

for (const headless of [false, true]) {
  describe(`${headless ? 'headless' : 'component'} clipboard cut transfers`, () => {
    function setup(columns: IColumnDef<Row>[], selection = range(0, 0, 1)) {
      let text = '';
      const clipboard = {
        writeText: async (value: string) => { text = value; },
        readText: async () => text,
      };
      Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
      const events: ICellValueChangedEvent<Row>[] = [];
      const state = {
        rows: [{ id: 1, a: 'first', b: 'second' }, { id: 2, a: 'target', b: 'target' }],
        selection,
      };
      const { result, rerender } = renderHook(() => {
        const rangeSelection = useRangeSelection({ rowCount: state.rows.length, colCount: columns.length });
        const params = { ...rangeSelection, range: state.selection };
        const component = useClipboard({
          items: state.rows, visibleCols: columns, colOffset: 0,
          selectionRange: state.selection, activeCell: null,
          getRowId: (item) => item.id, onCellValueChanged: (event) => events.push(event),
        });
        const custom = useCellClipboard({
          rangeSelection: params, rows: state.rows, columns, clipboard,
          getRowId: (item) => item.id, onCellEdit: (edits) => events.push(...edits),
        });
        return headless
          ? { cut: custom.cutRange, paste: custom.pasteRange }
          : { cut: component.handleCut, paste: component.handlePaste };
      });
      return { events, state, result, rerender };
    }
    const editable: IColumnDef<Row>[] = [
      { columnId: 'a', name: 'A', editable: true },
      { columnId: 'b', name: 'B', editable: true },
    ];

    it('preserves cut sources when every destination is read-only', async () => {
      const columns = editable.map((column) => ({ ...column, editable: (item: Row) => item.id === 1 }));
      const { result, state, rerender, events } = setup(columns);
      await act(async () => { await result.current.cut(); });
      state.selection = range(1);
      rerender();
      await act(async () => { await result.current.paste(); });
      expect(events).toEqual([]);
    });

    it('clears only the corresponding source of a validated destination', async () => {
      const columns = editable.map((column) => ({
        ...column, valueParser: ({ newValue: value, data: item }: IValueParserParams<Row>) =>
          item.id === 2 && value === 'second' ? undefined : value,
      }));
      const { result, state, rerender, events } = setup(columns);
      await act(async () => { await result.current.cut(); });
      state.selection = range(1);
      rerender();
      await act(async () => { await result.current.paste(); });
      expect(events.map((event) => [event.item.id, event.columnId, event.newValue])).toEqual([
        [2, 'a', 'first'], [1, 'a', ''],
      ]);
    });

    it('preserves the source of columns clipped past the grid edge', async () => {
      const { result, state, rerender, events } = setup(editable);
      await act(async () => { await result.current.cut(); });
      state.selection = range(1, 1);
      rerender();
      await act(async () => { await result.current.paste(); });
      expect(events.map((event) => [event.item.id, event.columnId, event.newValue])).toEqual([
        [2, 'b', 'first'], [1, 'a', ''],
      ]);
    });

    it('preserves pasted cells when a clipped move overlaps its source', async () => {
      const { result, state, rerender, events } = setup(editable);
      await act(async () => { await result.current.cut(); });
      state.selection = range(0, 1);
      rerender();
      await act(async () => { await result.current.paste(); });
      expect(events.map((event) => [event.item.id, event.columnId, event.newValue])).toEqual([
        [1, 'b', 'first'], [1, 'a', ''],
      ]);
    });

    it('resolves transferred sources by stable ids after rows are replaced and sorted', async () => {
      const { result, state, rerender, events } = setup(editable, range(0));
      await act(async () => { await result.current.cut(); });
      state.rows = state.rows.map((item) => ({ ...item })).reverse();
      state.selection = range(0);
      rerender();
      await act(async () => { await result.current.paste(); });
      expect(events.map((event) => [event.item.id, event.newValue])).toEqual([[2, 'first'], [1, '']]);
    });
  });
}
