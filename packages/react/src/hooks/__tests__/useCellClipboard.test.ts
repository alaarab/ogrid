import { renderHook, act } from '@testing-library/react';
import { useCellClipboard } from '../useCellClipboard';
import { useRangeSelection } from '../useRangeSelection';
import type { IColumnDef, ICellValueChangedEvent } from '../../types';

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

describe('useCellClipboard onPaste (native paste event)', () => {
  const makeEvent = (text: string, target?: EventTarget | null, currentTarget?: EventTarget | null) => ({
    clipboardData: { getData: (format: string) => (format === 'text/plain' ? text : '') },
    preventDefault: jest.fn(),
    target,
    currentTarget,
  });

  it('pastes the event text at the anchor, prevents default and never calls clipboard.readText', () => {
    const events: ICellValueChangedEvent<Row>[] = [];
    const readText = jest.fn().mockResolvedValue('FromReadText');
    const { result: rangeResult } = renderHook(() => useRangeSelection({ rowCount: 3, colCount: columns.length }));
    act(() => rangeResult.current.startRange(2, 0));
    const { result } = renderHook(() =>
      useCellClipboard<Row>({
        rangeSelection: rangeResult.current,
        rows: makeRows(),
        columns,
        onCellEdit: (e) => events.push(...e),
        clipboard: { readText, writeText: () => Promise.resolve() },
      }),
    );

    const event = makeEvent('hello\t42');
    act(() => { result.current.onPaste(event); });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(readText).not.toHaveBeenCalled();
    expect(events.map((e) => [e.rowIndex, e.columnId, e.newValue])).toEqual([[2, 'a', 'hello'], [2, 'b', 42]]);
  });

  it('leaves a paste aimed at a text input inside the container to that input', () => {
    const { rangeResult, clipResult, rerender, events } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    const container = document.createElement('div');
    const input = document.createElement('input');
    container.append(input);

    const event = makeEvent('hijacked', input, container);
    act(() => { clipResult.current.onPaste(event); });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('ignores an event without text or without a range, leaving the browser default', () => {
    const { rangeResult, clipResult, rerender, events } = setup();
    const noRange = makeEvent('x');
    act(() => { clipResult.current.onPaste(noRange); });
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    const empty = makeEvent('  \n');
    act(() => { clipResult.current.onPaste(empty); });

    expect(noRange.preventDefault).not.toHaveBeenCalled();
    expect(empty.preventDefault).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('completes a pending cut exactly like pasteRange', async () => {
    const { rangeResult, clipResult, rerender, events, clipboardState } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    await act(async () => { await clipResult.current.cutRange(); });
    act(() => rangeResult.current.startRange(1, 0));
    rerender({ range: rangeResult.current });

    act(() => { clipResult.current.onPaste(makeEvent(clipboardState.text)); });

    expect(events.map((e) => [e.rowIndex, e.columnId, e.newValue])).toEqual([[1, 'a', 'one'], [0, 'a', '']]);
    expect(clipResult.current.activeCutRange).toBeNull();
    expect(clipResult.current.activeCopyRange).toBeNull();
  });
});

describe('useCellClipboard onCopy / onCut (native copy and cut events)', () => {
  const makeEvent = (target?: EventTarget | null, currentTarget?: EventTarget | null) => {
    const data: Record<string, string> = {};
    return {
      data,
      clipboardData: { setData: jest.fn((format: string, value: string) => { data[format] = value; }) },
      preventDefault: jest.fn(),
      target,
      currentTarget,
    };
  };
  const selectA0toB0 = (t: ReturnType<typeof setup>) => {
    act(() => t.rangeResult.current.startRange(0, 0));
    act(() => t.rangeResult.current.extendRange(0, 1));
    t.rerender({ range: t.rangeResult.current });
  };

  it('onCopy puts the TSV on clipboardData, prevents default, marks the copy range and never calls writeText', () => {
    const t = setup('untouched');
    selectA0toB0(t);
    const event = makeEvent();
    act(() => { t.clipResult.current.onCopy(event); });

    expect(event.data['text/plain']).toBe('one\t100');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(t.clipboardState.text).toBe('untouched');
    expect(t.clipResult.current.activeCopyRange).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
    expect(t.clipResult.current.activeCutRange).toBeNull();
  });

  it('onCut marks the cut range, and a paste event of that text moves the values and clears the source', () => {
    const t = setup();
    act(() => t.rangeResult.current.startRange(0, 0));
    t.rerender({ range: t.rangeResult.current });
    const cut = makeEvent();
    act(() => { t.clipResult.current.onCut(cut); });
    expect(cut.data['text/plain']).toBe('one');
    expect(cut.preventDefault).toHaveBeenCalledTimes(1);
    expect(t.clipResult.current.activeCutRange).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    expect(t.clipResult.current.activeCopyRange).toBeNull();
    expect(t.events).toEqual([]);

    act(() => t.rangeResult.current.startRange(2, 0));
    t.rerender({ range: t.rangeResult.current });
    act(() => {
      t.clipResult.current.onPaste({ clipboardData: { getData: () => cut.data['text/plain'] }, preventDefault: jest.fn() });
    });
    expect(t.events.map((e) => [e.rowIndex, e.columnId, e.newValue])).toEqual([[2, 'a', 'one'], [0, 'a', '']]);
    expect(t.clipResult.current.activeCutRange).toBeNull();
  });

  it('leaves copy/cut aimed at a text input inside the container, or with no range, to the browser', () => {
    const t = setup();
    const noRange = makeEvent();
    act(() => { t.clipResult.current.onCopy(noRange); });
    selectA0toB0(t);
    const container = document.createElement('div');
    const input = document.createElement('input');
    container.append(input);
    const copyInInput = makeEvent(input, container);
    const cutInInput = makeEvent(input, container);
    act(() => { t.clipResult.current.onCopy(copyInInput); });
    act(() => { t.clipResult.current.onCut(cutInInput); });

    for (const e of [noRange, copyInInput, cutInInput]) {
      expect(e.clipboardData.setData).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(t.clipResult.current.activeCopyRange).toBeNull();
    expect(t.clipResult.current.activeCutRange).toBeNull();
  });
});

describe('useCellClipboard clipboard failures', () => {
  it('resolves and reports instead of rejecting when the clipboard is denied', async () => {
    const denied = new Error('denied');
    const errors: unknown[] = [];
    const { result: rangeResult } = renderHook(() => useRangeSelection({ rowCount: 3, colCount: 3 }));
    act(() => { rangeResult.current.startRange(0, 0); });
    const { result } = renderHook(() =>
      useCellClipboard<Row>({
        rangeSelection: rangeResult.current,
        rows: makeRows(),
        columns,
        onCellEdit: () => {},
        clipboard: { readText: () => Promise.reject(denied), writeText: () => Promise.reject(denied) },
        onClipboardError: (e) => errors.push(e),
      }),
    );
    await act(async () => {
      await result.current.copyRange();
      await result.current.cutRange();
      await result.current.pasteRange();
    });
    expect(errors).toEqual([denied, denied, denied]);
    expect(result.current.activeCutRange).toBeNull();
  });
});

describe('useCellClipboard  -  cut identity (S03/S02)', () => {
  it('clears the cut row by identity after rows are re-sorted; ignores a foreign clipboard', async () => {
    const rows = makeRows();
    const events: ICellValueChangedEvent<Row>[] = [];
    const clip = { text: '' };
    const clipboard = {
      readText: () => Promise.resolve(clip.text),
      writeText: (t: string) => { clip.text = t; return Promise.resolve(); },
    };
    const state = { rows, range: { range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 } } };
    const { result, rerender } = renderHook(() =>
      useCellClipboard<Row>({
        rangeSelection: state.range as never,
        rows: state.rows,
        columns,
        onCellEdit: (e) => events.push(...e),
        clipboard,
      }),
    );
    await act(async () => { await result.current.cutRange(); }); // cut rows[0] ('one')
    const [r0, r1, r2] = rows as [Row, Row, Row];
    state.rows = [r2, r1, r0]; // sorted: 'one' now at index 2
    state.range = { range: { startRow: 1, startCol: 0, endRow: 1, endCol: 0 } };
    rerender();
    await act(async () => { await result.current.pasteRange(); });
    const cleared = events.filter((e) => e.newValue === '' && e.columnId === 'a');
    expect(cleared.map((e) => e.rowIndex)).toEqual([2]);

    // Cut again, then paste text that did not come from the cut: nothing is cleared.
    events.length = 0;
    state.range = { range: { startRow: 2, startCol: 0, endRow: 2, endCol: 0 } };
    rerender();
    await act(async () => { await result.current.cutRange(); });
    clip.text = 'from elsewhere';
    state.range = { range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 } };
    rerender();
    await act(async () => { await result.current.pasteRange(); });
    expect(events.map((e) => e.newValue)).toEqual(['from elsewhere']);
  });
});
