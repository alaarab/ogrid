import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useSheetScopedState } from '../useSheetScopedState';

/**
 * Harness: one number of state, scoped to the active sheet. `applied` records
 * every value the hook wrote back, so tests can tell a restore from a default.
 */
function renderScoped(maxRememberedSheets?: number, initialSheet: string | undefined = 'a') {
  const applied: number[] = [];
  const r = renderHook(
    ({ sheet }: { sheet: string | undefined }) => {
      const [value, setValue] = useState(0);
      useSheetScopedState<number>({
        activeSheet: sheet,
        current: value,
        defaults: () => 0,
        apply: (v) => {
          applied.push(v);
          setValue(v);
        },
        maxRememberedSheets,
      });
      return { value, setValue };
    },
    { initialProps: { sheet: initialSheet } }
  );
  return { ...r, applied };
}

describe('useSheetScopedState', () => {
  it('does nothing at mount', () => {
    const { applied } = renderScoped();
    expect(applied).toEqual([]);
  });

  it('restores a sheet\'s value when it comes back', () => {
    const { result, rerender } = renderScoped();
    act(() => result.current.setValue(7));

    rerender({ sheet: 'b' });
    expect(result.current.value).toBe(0);

    rerender({ sheet: 'a' });
    expect(result.current.value).toBe(7);
  });

  it('seeds a first-seen sheet from defaults', () => {
    const { result, rerender, applied } = renderScoped();
    act(() => result.current.setValue(7));

    rerender({ sheet: 'b' });

    expect(applied).toEqual([0]);
    expect(result.current.value).toBe(0);
  });

  it('does nothing for a grid with no sheets', () => {
    // `activeSheet` is undefined on every render, so there is never a switch to
    // react to and the hook never writes state back.
    const { result, rerender, applied } = renderScoped(undefined, undefined);
    act(() => result.current.setValue(7));
    rerender({ sheet: undefined });
    rerender({ sheet: undefined });

    expect(result.current.value).toBe(7);
    expect(applied).toEqual([]);
  });

  it('forgets the least recently visited sheet past the bound', () => {
    const { result, rerender } = renderScoped(2);
    act(() => result.current.setValue(1)); // sheet a

    rerender({ sheet: 'b' });
    act(() => result.current.setValue(2));
    rerender({ sheet: 'c' });
    act(() => result.current.setValue(3));
    rerender({ sheet: 'd' }); // evicts 'a', the least recently visited

    rerender({ sheet: 'a' });
    expect(result.current.value).toBe(0); // re-seeded from defaults
    rerender({ sheet: 'c' });
    expect(result.current.value).toBe(3); // still remembered
  });
});
