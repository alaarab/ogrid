import { describe, it, expect, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useOGridCallbacks, useStableOptionalCallback } from '../useOGridCallbacks';
import type { UseOGridCallbacksParams } from '../useOGridCallbacks';

type Row = { id: string };

describe('useStableOptionalCallback', () => {
  it('keeps one identity across new inline callbacks and calls the latest one', () => {
    const first = mock((x: number) => x + 1);
    const second = mock((x: number) => x + 2);
    const { result, rerender } = renderHook(({ fn }) => useStableOptionalCallback(fn), { initialProps: { fn: first } });
    const stable = result.current;
    rerender({ fn: second });
    expect(result.current).toBe(stable);
    expect(result.current?.(1)).toBe(3);
    expect(first).not.toHaveBeenCalled();
  });

  it('is undefined while absent and changes identity only when presence flips', () => {
    const { result, rerender } = renderHook(
      ({ fn }: { fn?: () => void }) => useStableOptionalCallback(fn),
      { initialProps: {} as { fn?: () => void } },
    );
    expect(result.current).toBeUndefined();
    rerender({ fn: () => {} });
    const present = result.current;
    expect(present).toBeDefined();
    rerender({ fn: undefined });
    expect(result.current).toBeUndefined();
  });

  it('bumps the counter before each call', () => {
    const counter = { current: 0 };
    let seen = -1;
    const { result } = renderHook(() => useStableOptionalCallback(() => { seen = counter.current; }, counter));
    result.current?.();
    expect(counter.current).toBe(1);
    expect(seen).toBe(1);
  });
});

describe('useOGridCallbacks', () => {
  const render = (initial: UseOGridCallbacksParams<Row>) =>
    renderHook((p: UseOGridCallbacksParams<Row>) => useOGridCallbacks(p), { initialProps: initial });

  it('bumps the edit version for edits, undo and redo only', () => {
    const { result } = render({
      getRowId: (r) => r.id,
      onCellValueChanged: () => {},
      onUndo: () => {},
      onRedo: () => {},
      onColumnOrderChange: () => {},
      onClipboardError: () => {},
    });
    const s = result.current;
    s.onColumnOrderChange?.(['a']);
    s.onClipboardError?.(new Error('x'));
    expect(s.editVersionRef.current).toBe(0);
    s.onCellValueChanged?.({ item: { id: '1' }, columnId: 'a', oldValue: 1, newValue: 2, rowIndex: 0 });
    s.onUndo?.();
    s.onRedo?.();
    expect(s.editVersionRef.current).toBe(3);
  });

  it('keeps every callback stable across inline props', () => {
    const props = (): UseOGridCallbacksParams<Row> => ({
      getRowId: (r) => r.id, onCellValueChanged: () => {}, onUndo: () => {}, onRedo: () => {},
    });
    const { result, rerender } = render(props());
    const before = result.current;
    rerender(props());
    expect(result.current.getRowId).toBe(before.getRowId);
    expect(result.current.onCellValueChanged).toBe(before.onCellValueChanged);
    expect(result.current.onUndo).toBe(before.onUndo);
    expect(result.current.onRedo).toBe(before.onRedo);
    expect(result.current.editVersionRef).toBe(before.editVersionRef);
  });

  it('getRowId reads the latest prop', () => {
    const { result, rerender } = render({ getRowId: (r) => r.id });
    const stable = result.current.getRowId;
    rerender({ getRowId: (r) => `x-${r.id}` });
    expect(stable({ id: '1' })).toBe('x-1');
  });

  it('drops a callback the host stops passing', () => {
    const { result, rerender } = render({ getRowId: (r) => r.id, onUndo: () => {} });
    expect(result.current.onUndo).toBeDefined();
    rerender({ getRowId: (r) => r.id });
    expect(result.current.onUndo).toBeUndefined();
  });
});
