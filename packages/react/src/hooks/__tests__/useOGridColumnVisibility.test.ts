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
