import { renderHook, act } from '@testing-library/react';
import { useCellClipboard } from '../useCellClipboard';
import { useRangeSelection } from '../useRangeSelection';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';

type Row = { id: string; a: string; b: number; readonly: string };

const makeRows = (): Row[] => [
  { id: '1', a: 'one', b: 100, readonly: 'r1' },
  { id: '2', a: 'two', b: 200, readonly: 'r2' },
  { id: '3', a: 'three', b: 300, readonly: 'r3' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', type: 'text', editable: true },
  { columnId: 'b', name: 'B', type: 'numeric', editable: true },
  { columnId: 'readonly', name: 'Readonly', type: 'text', editable: false },
];

function setup(initialClipboard = '') {
  const events: ICellValueChangedEvent<Row>[] = [];
  const rows = makeRows();
  const clipboardState = { text: initialClipboard };
  const clipboard = {
    readText: () => Promise.resolve(clipboardState.text),
    writeText: (text: string) => {
      clipboardState.text = text;
      return Promise.resolve();
    },
  };

  const { result: rangeResult } = renderHook(() =>
    useRangeSelection({ rowCount: rows.length, colCount: columns.length }),
  );
  const { result: clipResult, rerender } = renderHook(
    ({ range }) =>
      useCellClipboard<Row>({
        rangeSelection: range,
        rows,
        columns,
        onCellEdit: (e) => events.push(...e),
        clipboard,
      }),
    { initialProps: { range: rangeResult.current } },
  );
  return { rangeResult, clipResult, events, clipboardState, rerender };
}

describe('useCellClipboard', () => {
  it('starts with no active ranges', () => {
    const { clipResult } = setup();
    expect(clipResult.current.activeCutRange).toBeNull();
    expect(clipResult.current.activeCopyRange).toBeNull();
  });

  it('copyRange writes TSV and marks the active copy range', async () => {
    const { rangeResult, clipResult, rerender, clipboardState } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    act(() => rangeResult.current.extendRange(0, 1));
    rerender({ range: rangeResult.current });

    await act(async () => {
      await clipResult.current.copyRange();
    });

    expect(clipboardState.text).toBe('one\t100');
    expect(clipResult.current.activeCopyRange).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 1,
    });
    expect(clipResult.current.activeCutRange).toBeNull();
  });

  it('copyRange is a no-op without a selection', async () => {
    const { clipResult, clipboardState } = setup();
    await act(async () => {
      await clipResult.current.copyRange();
    });
    expect(clipboardState.text).toBe('');
  });

  it('cutRange writes TSV and marks the active cut range', async () => {
    const { rangeResult, clipResult, rerender, clipboardState } = setup();
    act(() => rangeResult.current.startRange(1, 0));
    rerender({ range: rangeResult.current });

    await act(async () => {
      await clipResult.current.cutRange();
    });

    expect(clipboardState.text).toBe('two');
    expect(clipResult.current.activeCutRange).toEqual({
      startRow: 1,
      startCol: 0,
      endRow: 1,
      endCol: 0,
    });
    expect(clipResult.current.activeCopyRange).toBeNull();
  });

  it('pasteRange applies values from clipboard at anchor', async () => {
    const { rangeResult, clipResult, rerender, events } = setup('hello\t42');
    act(() => rangeResult.current.startRange(2, 0));
    rerender({ range: rangeResult.current });

    await act(async () => {
      await clipResult.current.pasteRange();
    });

    // Two cells pasted at row 2: col 0 (text) gets 'hello', col 1 (numeric) gets 42.
    expect(events.length).toBe(2);
    expect(events[0].rowIndex).toBe(2);
    expect(events[0].columnId).toBe('a');
    expect(events[0].newValue).toBe('hello');
    expect(events[1].columnId).toBe('b');
    expect(events[1].newValue).toBe(42);
  });

  it('pasteRange rejects values that fail valueParser (number column)', async () => {
    const { rangeResult, clipResult, rerender, events } = setup('hello\tnotanumber');
    act(() => rangeResult.current.startRange(2, 0));
    rerender({ range: rangeResult.current });

    await act(async () => {
      await clipResult.current.pasteRange();
    });

    // 'hello' goes into text col 0; 'notanumber' rejected by numeric col 1.
    const colA = events.find((e) => e.columnId === 'a');
    const colB = events.find((e) => e.columnId === 'b');
    expect(colA?.newValue).toBe('hello');
    expect(colB).toBeUndefined();
  });

  it('pasteRange respects column editable=false', async () => {
    const { rangeResult, clipResult, rerender, events } = setup('skipme');
    act(() => rangeResult.current.startRange(0, 2)); // col 2 is readonly
    rerender({ range: rangeResult.current });

    await act(async () => {
      await clipResult.current.pasteRange();
    });

    // Should not produce events for readonly columns.
    expect(events.find((e) => e.columnId === 'readonly')).toBeUndefined();
  });

  it('pasteRange clears active cut range after commit', async () => {
    const { rangeResult, clipResult, rerender } = setup('newval');

    // First, cut row 0 col 0.
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    await act(async () => {
      await clipResult.current.cutRange();
    });
    expect(clipResult.current.activeCutRange).not.toBeNull();

    // Now paste at row 1 col 0.
    act(() => rangeResult.current.startRange(1, 0));
    rerender({ range: rangeResult.current });
    await act(async () => {
      await clipResult.current.pasteRange();
    });

    expect(clipResult.current.activeCutRange).toBeNull();
  });

  it('clearClipboard clears both ranges', async () => {
    const { rangeResult, clipResult, rerender } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    await act(async () => {
      await clipResult.current.copyRange();
    });
    expect(clipResult.current.activeCopyRange).not.toBeNull();

    act(() => clipResult.current.clearClipboard());
    expect(clipResult.current.activeCopyRange).toBeNull();
    expect(clipResult.current.activeCutRange).toBeNull();
  });

  it('round-trips a single-cell value through copy + paste', async () => {
    const { rangeResult, clipResult, rerender, events } = setup();
    // Copy row 0 col 0 ('one').
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    await act(async () => {
      await clipResult.current.copyRange();
    });

    // Paste at row 2 col 0.
    act(() => rangeResult.current.startRange(2, 0));
    rerender({ range: rangeResult.current });
    await act(async () => {
      await clipResult.current.pasteRange();
    });

    expect(events.length).toBe(1);
    expect(events[0].rowIndex).toBe(2);
    expect(events[0].newValue).toBe('one');
  });
});
