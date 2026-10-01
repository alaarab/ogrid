import { renderHook, act } from '@testing-library/react';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { useColumnPinning } from '../useColumnPinning';

type Row = { id: string };

describe('useColumnPinning', () => {
  it('seeds pins from column defs that arrive after mount', () => {
    const { result, rerender } = renderHook(({ columns }) => useColumnPinning<Row>({ columns }), {
      initialProps: { columns: [] as IColumnDef<Row>[] },
    });
    expect(result.current.pinnedColumns).toEqual({});

    rerender({
      columns: [
        { columnId: 'a', name: 'A', pinned: 'left' },
        { columnId: 'b', name: 'B' },
        { columnId: 'c', name: 'C', pinned: 'right' },
      ],
    });
    expect(result.current.pinnedColumns).toEqual({ a: 'left', c: 'right' });
  });

  it('keeps user pins for columns already shown when new defs arrive', () => {
    const initial: IColumnDef<Row>[] = [
      { columnId: 'a', name: 'A', pinned: 'left' },
      { columnId: 'b', name: 'B' },
    ];
    const { result, rerender } = renderHook(({ columns }) => useColumnPinning<Row>({ columns }), {
      initialProps: { columns: initial },
    });
    act(() => result.current.unpinColumn('a'));
    rerender({ columns: [...initial, { columnId: 'c', name: 'C', pinned: 'right' }] });
    expect(result.current.pinnedColumns).toEqual({ c: 'right' });
  });

  it('keeps every pin change made in one tick', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'a', name: 'A' },
      { columnId: 'b', name: 'B' },
      { columnId: 'c', name: 'C', pinned: 'left' },
    ];
    const { result } = renderHook(() => useColumnPinning<Row>({ columns }));
    act(() => {
      result.current.pinColumn('a', 'left');
      result.current.pinColumn('b', 'right');
      result.current.unpinColumn('c');
    });
    expect(result.current.pinnedColumns).toEqual({ a: 'left', b: 'right' });
  });
});
