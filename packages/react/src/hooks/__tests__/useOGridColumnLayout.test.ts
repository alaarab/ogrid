import { renderHook, act } from '@testing-library/react';
import { useOGridColumnLayout } from '../useOGridColumnLayout';
import type { IColumnDef } from '../../types';

type Row = Record<string, unknown>;
type Cols = IColumnDef<Row>[];

function render(initialColumns: Cols) {
  return renderHook(
    ({ columnsProp }: { columnsProp: Cols }) => useOGridColumnLayout<Row>({ columnsProp }),
    { initialProps: { columnsProp: initialColumns } }
  );
}

describe('useOGridColumnLayout pin reconciliation', () => {
  it('applies pinned defs from columns that arrive after an empty first render', () => {
    const { result, rerender } = render([]);
    expect(result.current.pinnedOverrides).toEqual({});

    rerender({ columnsProp: [{ columnId: 'n', name: 'N', pinned: 'left' }, { columnId: 'x', name: 'X' }] as Cols });

    expect(result.current.pinnedOverrides).toEqual({ n: 'left' });
  });

  it('applies the incoming column set\'s pinned defs when the set is swapped', () => {
    const { result, rerender } = render([{ columnId: 'a1', name: 'A1' }] as Cols);
    expect(result.current.pinnedOverrides).toEqual({});

    rerender({ columnsProp: [{ columnId: 'b1', name: 'B1', pinned: 'left' }] as Cols });

    expect(result.current.pinnedOverrides).toEqual({ b1: 'left' });
  });

  it('keeps a pin the user set on a column that survives the swap', () => {
    const { result, rerender } = render([
      { columnId: 'shared', name: 'Shared' },
      { columnId: 'a1', name: 'A1' },
    ] as Cols);
    act(() => result.current.handleColumnPinned('shared', 'right'));
    expect(result.current.pinnedOverrides).toEqual({ shared: 'right' });

    rerender({
      columnsProp: [
        { columnId: 'shared', name: 'Shared' },
        { columnId: 'b1', name: 'B1', pinned: 'left' },
      ] as Cols,
    });

    expect(result.current.pinnedOverrides).toEqual({ shared: 'right', b1: 'left' });
  });

  it('drops pins for columns that are gone', () => {
    const { result, rerender } = render([{ columnId: 'a1', name: 'A1' }] as Cols);
    act(() => result.current.handleColumnPinned('a1', 'left'));
    expect(result.current.pinnedOverrides).toEqual({ a1: 'left' });

    rerender({ columnsProp: [{ columnId: 'b1', name: 'B1' }] as Cols });

    expect(result.current.pinnedOverrides).toEqual({});
  });

  it('does not churn state when columns are re-created with the same ids', () => {
    const seen: Array<Record<string, string>> = [];
    const { rerender } = renderHook(
      ({ columnsProp }: { columnsProp: Cols }) => {
        const state = useOGridColumnLayout<Row>({ columnsProp });
        seen.push(state.pinnedOverrides);
        return state;
      },
      { initialProps: { columnsProp: [{ columnId: 'a1', name: 'A1', pinned: 'left' }] as Cols } }
    );
    const first = seen[seen.length - 1];
    rerender({ columnsProp: [{ columnId: 'a1', name: 'A1', pinned: 'left' }] as Cols });
    expect(seen[seen.length - 1]).toBe(first);
  });
});
