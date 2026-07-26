import { renderHook, act } from '@testing-library/react';
import { useOGridColumnVisibility } from '../useOGridColumnVisibility';

type Col = { columnId: string; defaultVisible?: boolean };

describe('useOGridColumnVisibility', () => {
  it('seeds the visible set from defaultVisible, excluding defaultVisible=false', () => {
    const columns: Col[] = [
      { columnId: 'a' },
      { columnId: 'b', defaultVisible: false },
      { columnId: 'c', defaultVisible: true },
    ];
    const { result } = renderHook(() => useOGridColumnVisibility({ columns }));
    expect(result.current.visibleColumns).toEqual(new Set(['a', 'c']));
  });

  it('falls back to all columns when every column is defaultVisible=false', () => {
    const columns: Col[] = [
      { columnId: 'a', defaultVisible: false },
      { columnId: 'b', defaultVisible: false },
    ];
    const { result } = renderHook(() => useOGridColumnVisibility({ columns }));
    expect(result.current.visibleColumns).toEqual(new Set(['a', 'b']));
  });

  it('re-initializes once when columns arrive after an empty initial render', () => {
    const { result, rerender } = renderHook(
      ({ columns }) => useOGridColumnVisibility({ columns }),
      { initialProps: { columns: [] as Col[] } }
    );
    expect(result.current.visibleColumns.size).toBe(0);

    rerender({ columns: [{ columnId: 'a' }, { columnId: 'b', defaultVisible: false }] });
    expect(result.current.visibleColumns).toEqual(new Set(['a']));
  });

  it('reseeds when the column set is swapped wholesale (sheet switch)', () => {
    const { result, rerender } = renderHook(
      ({ columns }) => useOGridColumnVisibility({ columns }),
      { initialProps: { columns: [{ columnId: 'a1' }, { columnId: 'a2' }, { columnId: 'a3' }] as Col[] } }
    );
    expect(result.current.visibleColumns).toEqual(new Set(['a1', 'a2', 'a3']));

    rerender({ columns: [{ columnId: 'b1' }, { columnId: 'b2' }] });
    // No ids from the old sheet survive, and the new columns are visible.
    expect(result.current.visibleColumns).toEqual(new Set(['b1', 'b2']));
  });

  it('keeps deliberate hides for columns that survive a column-set change', () => {
    const { result, rerender } = renderHook(
      ({ columns }) => useOGridColumnVisibility({ columns }),
      { initialProps: { columns: [{ columnId: 'shared' }, { columnId: 'a1' }] as Col[] } }
    );
    act(() => result.current.handleVisibilityChange('shared', false));
    expect(result.current.visibleColumns).toEqual(new Set(['a1']));

    rerender({ columns: [{ columnId: 'shared' }, { columnId: 'b1' }] });
    // 'shared' stays hidden (user's choice), 'b1' is new so it defaults to visible.
    expect(result.current.visibleColumns).toEqual(new Set(['b1']));
  });

  it('honours defaultVisible=false on the incoming column set', () => {
    const { result, rerender } = renderHook(
      ({ columns }) => useOGridColumnVisibility({ columns }),
      { initialProps: { columns: [{ columnId: 'a1' }] as Col[] } }
    );
    rerender({ columns: [{ columnId: 'b1' }, { columnId: 'b2', defaultVisible: false }] });
    expect(result.current.visibleColumns).toEqual(new Set(['b1']));
  });

  it('falls back to the new defaults when the remap would hide everything', () => {
    const { result, rerender } = renderHook(
      ({ columns }) => useOGridColumnVisibility({ columns }),
      { initialProps: { columns: [{ columnId: 'a1' }, { columnId: 'a2' }] as Col[] } }
    );
    act(() => result.current.setVisibleColumns(new Set(['a1'])));

    // Every incoming column is already known and hidden  -  don't render a
    // column-less (and therefore row-less) grid.
    rerender({ columns: [{ columnId: 'a2' }] });
    expect(result.current.visibleColumns).toEqual(new Set(['a2']));
  });

  it('does not churn state when columns are re-created with the same ids', () => {
    const seen: Array<Set<string>> = [];
    const { rerender } = renderHook(
      ({ columns }) => {
        const state = useOGridColumnVisibility({ columns });
        seen.push(state.visibleColumns);
        return state;
      },
      { initialProps: { columns: [{ columnId: 'a' }, { columnId: 'b' }] as Col[] } }
    );
    const first = seen[seen.length - 1];
    rerender({ columns: [{ columnId: 'a' }, { columnId: 'b' }] });
    expect(seen[seen.length - 1]).toBe(first);
  });

  it('does NOT remap internal state when controlled', () => {
    const controlled = new Set(['a']);
    const { result, rerender } = renderHook(
      ({ columns }) =>
        useOGridColumnVisibility({ columns, controlledVisibleColumns: controlled }),
      { initialProps: { columns: [{ columnId: 'a' }] as Col[] } }
    );
    rerender({ columns: [{ columnId: 'b1' }, { columnId: 'b2' }] });
    expect(result.current.visibleColumns).toBe(controlled);
  });

  it('does NOT re-initialize from late columns when controlled', () => {
    const controlled = new Set(['x']);
    const { result, rerender } = renderHook(
      ({ columns }) =>
        useOGridColumnVisibility({ columns, controlledVisibleColumns: controlled }),
      { initialProps: { columns: [] as Col[] } }
    );
    expect(result.current.visibleColumns).toBe(controlled);

    rerender({ columns: [{ columnId: 'a' }, { columnId: 'b' }] });
    // Controlled value wins; the internal re-init effect is skipped.
    expect(result.current.visibleColumns).toBe(controlled);
  });

  it('setVisibleColumns updates internal state and notifies (uncontrolled)', () => {
    const onVisibleColumnsChange = jest.fn();
    const columns: Col[] = [{ columnId: 'a' }, { columnId: 'b' }];
    const { result } = renderHook(() =>
      useOGridColumnVisibility({ columns, onVisibleColumnsChange })
    );
    act(() => result.current.setVisibleColumns(new Set(['a'])));
    expect(result.current.visibleColumns).toEqual(new Set(['a']));
    expect(onVisibleColumnsChange).toHaveBeenCalledWith(new Set(['a']));
  });

  it('setVisibleColumns notifies but does not mutate the controlled value', () => {
    const onVisibleColumnsChange = jest.fn();
    const controlled = new Set(['a', 'b']);
    const columns: Col[] = [{ columnId: 'a' }, { columnId: 'b' }];
    const { result } = renderHook(() =>
      useOGridColumnVisibility({
        columns,
        controlledVisibleColumns: controlled,
        onVisibleColumnsChange,
      })
    );
    act(() => result.current.setVisibleColumns(new Set(['a'])));
    expect(onVisibleColumnsChange).toHaveBeenCalledWith(new Set(['a']));
    // Still reflects the controlled prop.
    expect(result.current.visibleColumns).toBe(controlled);
  });

  it('handleVisibilityChange toggles a single column', () => {
    const columns: Col[] = [{ columnId: 'a' }, { columnId: 'b' }];
    const { result } = renderHook(() => useOGridColumnVisibility({ columns }));
    act(() => result.current.handleVisibilityChange('b', false));
    expect(result.current.visibleColumns).toEqual(new Set(['a']));
    act(() => result.current.handleVisibilityChange('b', true));
    expect(result.current.visibleColumns).toEqual(new Set(['a', 'b']));
  });
});
