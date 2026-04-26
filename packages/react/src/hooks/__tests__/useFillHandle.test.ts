import { renderHook, act } from '@testing-library/react';
import { useFillHandle } from '../useFillHandle';
import { useRangeSelection } from '../useRangeSelection';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';

type Row = { id: string; a: number; b: number; name: string };

const makeRows = (): Row[] => [
  { id: '1', a: 10, b: 100, name: 'one' },
  { id: '2', a: 20, b: 200, name: 'two' },
  { id: '3', a: 30, b: 300, name: 'three' },
  { id: '4', a: 40, b: 400, name: 'four' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', type: 'numeric', editable: true },
  { columnId: 'b', name: 'B', type: 'numeric', editable: true },
  { columnId: 'name', name: 'Name', type: 'text', editable: true },
];

function setup() {
  const events: ICellValueChangedEvent<Row>[] = [];
  const rows = makeRows();
  const { result: rangeResult } = renderHook(() =>
    useRangeSelection({ rowCount: rows.length, colCount: columns.length }),
  );
  const { result: fillResult, rerender } = renderHook(
    ({ range }) =>
      useFillHandle<Row>({
        rangeSelection: range,
        rows,
        columns,
        onFillCells: (e) => events.push(...e),
      }),
    { initialProps: { range: rangeResult.current } },
  );
  return { rangeResult, fillResult, events, rerender, rows };
}

describe('useFillHandle', () => {
  it('starts inactive', () => {
    const { fillResult } = setup();
    expect(fillResult.current.isFilling).toBe(false);
    expect(fillResult.current.fillTarget).toBeNull();
    expect(fillResult.current.fillRange).toBeNull();
  });

  it('startFill is a no-op without a source range', () => {
    const { fillResult } = setup();
    act(() => fillResult.current.startFill());
    expect(fillResult.current.isFilling).toBe(false);
  });

  it('startFill anchors the fill target at the source range end', () => {
    const { rangeResult, fillResult, rerender } = setup();
    act(() => rangeResult.current.startRange(1, 0));
    rerender({ range: rangeResult.current });

    act(() => fillResult.current.startFill());
    expect(fillResult.current.isFilling).toBe(true);
    expect(fillResult.current.fillTarget).toEqual({ row: 1, col: 0 });
  });

  it('updateFill extends the range as the user drags', () => {
    const { rangeResult, fillResult, rerender } = setup();
    act(() => rangeResult.current.startRange(1, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());

    act(() => fillResult.current.updateFill(3, 0));
    expect(fillResult.current.fillTarget).toEqual({ row: 3, col: 0 });
    expect(fillResult.current.fillRange).toEqual({
      startRow: 1,
      startCol: 0,
      endRow: 3,
      endCol: 0,
    });
  });

  it('isInFillRange highlights cells within the extended range', () => {
    const { rangeResult, fillResult, rerender } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());
    act(() => fillResult.current.updateFill(2, 0));

    expect(fillResult.current.isInFillRange(0, 0)).toBe(true);
    expect(fillResult.current.isInFillRange(1, 0)).toBe(true);
    expect(fillResult.current.isInFillRange(2, 0)).toBe(true);
    expect(fillResult.current.isInFillRange(3, 0)).toBe(false); // beyond
    expect(fillResult.current.isInFillRange(0, 1)).toBe(false); // wrong col
  });

  it('commitFill emits onFillCells events covering filled rows', () => {
    const { rangeResult, fillResult, rerender, events } = setup();
    // Source: row 0 col 0 (value 10). Drag down to row 2.
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());
    act(() => fillResult.current.updateFill(2, 0));
    act(() => fillResult.current.commitFill());

    // Filled rows 1 and 2 with value 10 (the source).
    expect(events.length).toBe(2);
    expect(events[0].rowIndex).toBe(1);
    expect(events[0].columnId).toBe('a');
    expect(events[0].newValue).toBe(10);
    expect(events[1].rowIndex).toBe(2);
    expect(events[1].newValue).toBe(10);
    expect(fillResult.current.isFilling).toBe(false);
  });

  it('commitFill is a no-op when fillRange equals sourceRange', () => {
    const { rangeResult, fillResult, rerender, events } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());
    // No updateFill — release without dragging.
    act(() => fillResult.current.commitFill());

    expect(events.length).toBe(0);
    expect(fillResult.current.isFilling).toBe(false);
  });

  it('cancelFill clears state without firing onFillCells', () => {
    const { rangeResult, fillResult, rerender, events } = setup();
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());
    act(() => fillResult.current.updateFill(2, 0));
    act(() => fillResult.current.cancelFill());

    expect(fillResult.current.isFilling).toBe(false);
    expect(events.length).toBe(0);
  });

  it('fills horizontally across compatible columns', () => {
    const { rangeResult, fillResult, rerender, events } = setup();
    // Source: row 0 col 0 (a=10). Drag right to col 1.
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());
    act(() => fillResult.current.updateFill(0, 1));
    act(() => fillResult.current.commitFill());

    // a (numeric) → b (numeric) = compatible.
    expect(events.length).toBe(1);
    expect(events[0].columnId).toBe('b');
    expect(events[0].newValue).toBe(10);
  });

  it('skips incompatible columns (numeric → text)', () => {
    const { rangeResult, fillResult, rerender, events } = setup();
    // Source: row 0 col 0 (numeric). Drag right to col 2 (text).
    act(() => rangeResult.current.startRange(0, 0));
    rerender({ range: rangeResult.current });
    act(() => fillResult.current.startFill());
    act(() => fillResult.current.updateFill(0, 2));
    act(() => fillResult.current.commitFill());

    // b (numeric) is compatible, name (text) is not.
    expect(events.length).toBe(1);
    expect(events[0].columnId).toBe('b');
    // No event for name column.
    expect(events.find((e) => e.columnId === 'name')).toBeUndefined();
  });
});
