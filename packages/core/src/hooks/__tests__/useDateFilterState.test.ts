import { renderHook, act } from '@testing-library/react';
import { useDateFilterState } from '../useDateFilterState';
import type { IDateFilterValue } from '../../types/columnTypes';

describe('useDateFilterState', () => {
  it('initializes with empty temp values when no dateValue provided', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    expect(result.current.tempDateFrom).toBe('');
    expect(result.current.tempDateTo).toBe('');
  });

  it('initializes with dateValue when provided', () => {
    const onDateChange = jest.fn();
    const dateValue: IDateFilterValue = { from: '2024-01-15', to: '2024-02-20' };
    const { result } = renderHook(() =>
      useDateFilterState({
        dateValue,
        isFilterOpen: false,
        onDateChange,
      })
    );
    expect(result.current.tempDateFrom).toBe('2024-01-15');
    expect(result.current.tempDateTo).toBe('2024-02-20');
  });

  it('syncs temp state when popover opens', () => {
    const onDateChange = jest.fn();
    const dateValue: IDateFilterValue = { from: '2024-03-01', to: '2024-03-31' };
    const { result, rerender } = renderHook(
      ({ isFilterOpen, dateValue }) =>
        useDateFilterState({ dateValue, isFilterOpen, onDateChange }),
      { initialProps: { isFilterOpen: false, dateValue } }
    );

    // Change temp values
    act(() => {
      result.current.setTempDateFrom('2024-01-01');
      result.current.setTempDateTo('2024-01-31');
    });
    expect(result.current.tempDateFrom).toBe('2024-01-01');
    expect(result.current.tempDateTo).toBe('2024-01-31');

    // Open popover - should sync from dateValue
    rerender({ isFilterOpen: true, dateValue });
    expect(result.current.tempDateFrom).toBe('2024-03-01');
    expect(result.current.tempDateTo).toBe('2024-03-31');
  });

  it('setTempDateFrom updates tempDateFrom', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    act(() => {
      result.current.setTempDateFrom('2024-06-15');
    });
    expect(result.current.tempDateFrom).toBe('2024-06-15');
  });

  it('setTempDateTo updates tempDateTo', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    act(() => {
      result.current.setTempDateTo('2024-12-31');
    });
    expect(result.current.tempDateTo).toBe('2024-12-31');
  });

  it('handleDateApply calls onDateChange with both dates', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    act(() => {
      result.current.setTempDateFrom('2024-05-01');
      result.current.setTempDateTo('2024-05-31');
    });
    act(() => {
      result.current.handleDateApply();
    });
    expect(onDateChange).toHaveBeenCalledWith({
      from: '2024-05-01',
      to: '2024-05-31',
    });
  });

  it('handleDateApply calls onDateChange with only from date', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    act(() => {
      result.current.setTempDateFrom('2024-07-01');
    });
    act(() => {
      result.current.handleDateApply();
    });
    expect(onDateChange).toHaveBeenCalledWith({
      from: '2024-07-01',
      to: undefined,
    });
  });

  it('handleDateApply calls onDateChange with only to date', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    act(() => {
      result.current.setTempDateTo('2024-08-31');
    });
    act(() => {
      result.current.handleDateApply();
    });
    expect(onDateChange).toHaveBeenCalledWith({
      from: undefined,
      to: '2024-08-31',
    });
  });

  it('handleDateApply calls onDateChange with undefined when both dates empty', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
        onDateChange,
      })
    );
    act(() => {
      result.current.handleDateApply();
    });
    expect(onDateChange).toHaveBeenCalledWith(undefined);
  });

  it('handleDateClear clears both temp dates', () => {
    const onDateChange = jest.fn();
    const { result } = renderHook(() =>
      useDateFilterState({
        dateValue: { from: '2024-01-01', to: '2024-12-31' },
        isFilterOpen: false,
        onDateChange,
      })
    );
    expect(result.current.tempDateFrom).toBe('2024-01-01');
    expect(result.current.tempDateTo).toBe('2024-12-31');
    act(() => {
      result.current.handleDateClear();
    });
    expect(result.current.tempDateFrom).toBe('');
    expect(result.current.tempDateTo).toBe('');
  });

  it('handles partial dateValue with only from', () => {
    const onDateChange = jest.fn();
    const dateValue: IDateFilterValue = { from: '2024-09-01' };
    const { result } = renderHook(() =>
      useDateFilterState({
        dateValue,
        isFilterOpen: false,
        onDateChange,
      })
    );
    expect(result.current.tempDateFrom).toBe('2024-09-01');
    expect(result.current.tempDateTo).toBe('');
  });

  it('handles partial dateValue with only to', () => {
    const onDateChange = jest.fn();
    const dateValue: IDateFilterValue = { to: '2024-10-31' };
    const { result } = renderHook(() =>
      useDateFilterState({
        dateValue,
        isFilterOpen: false,
        onDateChange,
      })
    );
    expect(result.current.tempDateFrom).toBe('');
    expect(result.current.tempDateTo).toBe('2024-10-31');
  });

  it('does not call onDateChange if not provided', () => {
    const { result } = renderHook(() =>
      useDateFilterState({
        isFilterOpen: false,
      })
    );
    act(() => {
      result.current.setTempDateFrom('2024-01-01');
    });
    act(() => {
      result.current.handleDateApply();
    });
    // Should not throw
  });
});
