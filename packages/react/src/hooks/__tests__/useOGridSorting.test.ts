import { renderHook, act } from '@testing-library/react';
import { useOGridSorting } from '../useOGridSorting';

type Col = { columnId: string };

const noop = () => {};

function render(initial: { columns: Col[]; defaultSortField: string; controlledSort?: { field: string; direction: 'asc' | 'desc' } }) {
  return renderHook(
    ({ columns, defaultSortField, controlledSort }: typeof initial) =>
      useOGridSorting({
        columns,
        defaultSortField,
        defaultSortDirection: 'asc',
        controlledSort,
        setPage: noop,
      }),
    { initialProps: initial }
  );
}

describe('useOGridSorting', () => {
  it('seeds the sort field from the columns that arrive after an empty first render', () => {
    const { result, rerender } = render({ columns: [], defaultSortField: '' });
    expect(result.current.sort.field).toBe('');

    rerender({ columns: [{ columnId: 'name' }, { columnId: 'age' }], defaultSortField: 'name' });

    expect(result.current.sort.field).toBe('name');
  });

  it('re-seeds when the column set is swapped for one the sort field is not in', () => {
    const { result, rerender } = render({ columns: [{ columnId: 'a1' }], defaultSortField: 'a1' });
    expect(result.current.sort.field).toBe('a1');

    rerender({ columns: [{ columnId: 'b1' }, { columnId: 'b2' }], defaultSortField: 'b1' });

    expect(result.current.sort.field).toBe('b1');
  });

  it('leaves the field alone when it still exists in the new column set', () => {
    const { result, rerender } = render({
      columns: [{ columnId: 'a1' }, { columnId: 'a2' }],
      defaultSortField: 'a1',
    });
    act(() => result.current.setSort({ field: 'a2', direction: 'desc' }));

    rerender({ columns: [{ columnId: 'a2' }, { columnId: 'a3' }], defaultSortField: 'a2' });

    expect(result.current.sort).toEqual({ field: 'a2', direction: 'desc' });
  });

  it('does not overrule a sort the user chose explicitly', () => {
    const { result, rerender } = render({
      columns: [{ columnId: 'a1' }, { columnId: 'a2' }],
      defaultSortField: 'a1',
    });
    act(() => result.current.setSort({ field: 'a2', direction: 'desc' }));

    rerender({ columns: [{ columnId: 'b1' }], defaultSortField: 'b1' });

    expect(result.current.sort).toEqual({ field: 'a2', direction: 'desc' });
  });

  it('does not touch internal state when controlled', () => {
    const controlledSort = { field: 'a1', direction: 'asc' as const };
    const { result, rerender } = render({
      columns: [{ columnId: 'a1' }],
      defaultSortField: 'a1',
      controlledSort,
    });

    rerender({ columns: [{ columnId: 'b1' }], defaultSortField: 'b1', controlledSort });

    expect(result.current.sort).toBe(controlledSort);
  });

  it('does not churn state when columns are re-created with the same ids', () => {
    const seen: Array<{ field: string }> = [];
    const { rerender } = renderHook(
      ({ columns }: { columns: Col[] }) => {
        const state = useOGridSorting({
          columns,
          defaultSortField: 'a1',
          defaultSortDirection: 'asc',
          setPage: noop,
        });
        seen.push(state.sort);
        return state;
      },
      { initialProps: { columns: [{ columnId: 'a1' }] } }
    );
    const first = seen[seen.length - 1];
    rerender({ columns: [{ columnId: 'a1' }] });
    expect(seen[seen.length - 1]).toBe(first);
  });
});
