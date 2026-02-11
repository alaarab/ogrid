import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 100));
    expect(result.current).toBe('hello');
  });

  it('updates after delay when value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    );
    expect(result.current).toBe('a');
    rerender({ value: 'b', delay: 100 });
    expect(result.current).toBe('a');
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('b');
  });

  it('cancels previous timer when value changes again before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    );
    rerender({ value: 'b', delay: 100 });
    rerender({ value: 'c', delay: 100 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('invokes callback after delay', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 100));
    act(() => {
      result.current('arg');
    });
    expect(fn).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('arg');
  });

  it('resets timer on each call', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 100));
    act(() => {
      result.current(1);
    });
    act(() => {
      jest.advanceTimersByTime(50);
    });
    act(() => {
      result.current(2);
    });
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(fn).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
  });
});
