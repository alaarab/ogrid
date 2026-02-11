import { renderHook, act } from '@testing-library/react';
import { useMultiSelectFilterState } from '../useMultiSelectFilterState';

describe('useMultiSelectFilterState', () => {
  const mockOptions = ['Option A', 'Option B', 'Option C', 'Option D'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with empty selection when no selectedValues provided', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    expect(result.current.tempSelected.size).toBe(0);
    expect(result.current.searchText).toBe('');
    expect(result.current.filteredOptions).toEqual(mockOptions);
  });

  it('initializes tempSelected from selectedValues', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        selectedValues: ['Option A', 'Option C'],
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    expect(result.current.tempSelected.size).toBe(2);
    expect(result.current.tempSelected.has('Option A')).toBe(true);
    expect(result.current.tempSelected.has('Option C')).toBe(true);
  });

  it('syncs temp state when popover opens', () => {
    const onFilterChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ isFilterOpen, selectedValues }) =>
        useMultiSelectFilterState({
          selectedValues,
          options: mockOptions,
          isFilterOpen,
          onFilterChange,
        }),
      { initialProps: { isFilterOpen: false, selectedValues: ['Option A'] } }
    );

    // Modify temp selection
    act(() => {
      result.current.handleCheckboxChange('Option B', true);
    });
    expect(result.current.tempSelected.has('Option B')).toBe(true);

    // Open popover - should reset from selectedValues
    rerender({ isFilterOpen: true, selectedValues: ['Option A'] });
    expect(result.current.tempSelected.size).toBe(1);
    expect(result.current.tempSelected.has('Option A')).toBe(true);
    expect(result.current.tempSelected.has('Option B')).toBe(false);
    expect(result.current.searchText).toBe('');
  });

  it('setSearchText updates searchText', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    act(() => {
      result.current.setSearchText('Option A');
    });
    expect(result.current.searchText).toBe('Option A');
  });

  it('filters options based on debounced search text', async () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );

    act(() => {
      result.current.setSearchText('A');
    });

    // Wait for debounce (150ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(result.current.filteredOptions).toEqual(['Option A']);
  });

  it('filteredOptions case-insensitive search', async () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );

    act(() => {
      result.current.setSearchText('option b');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(result.current.filteredOptions).toEqual(['Option B']);
  });

  it('returns all options when search text is empty', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    expect(result.current.filteredOptions).toEqual(mockOptions);
  });

  it('returns all options when search text is whitespace', async () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );

    act(() => {
      result.current.setSearchText('   ');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(result.current.filteredOptions).toEqual(mockOptions);
  });

  it('handleCheckboxChange adds option when checked', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    act(() => {
      result.current.handleCheckboxChange('Option A', true);
    });
    expect(result.current.tempSelected.has('Option A')).toBe(true);
  });

  it('handleCheckboxChange removes option when unchecked', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        selectedValues: ['Option A', 'Option B'],
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    act(() => {
      result.current.handleCheckboxChange('Option A', false);
    });
    expect(result.current.tempSelected.has('Option A')).toBe(false);
    expect(result.current.tempSelected.has('Option B')).toBe(true);
  });

  it('handleSelectAll selects all filtered options', async () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );

    act(() => {
      result.current.setSearchText('Option');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    act(() => {
      result.current.handleSelectAll();
    });

    expect(result.current.tempSelected.size).toBe(4);
    mockOptions.forEach((opt) => {
      expect(result.current.tempSelected.has(opt)).toBe(true);
    });
  });

  it('handleSelectAll only selects visible filtered options', async () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );

    act(() => {
      result.current.setSearchText('A');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    act(() => {
      result.current.handleSelectAll();
    });

    expect(result.current.tempSelected.size).toBe(1);
    expect(result.current.tempSelected.has('Option A')).toBe(true);
  });

  it('handleClearSelection clears all selections', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        selectedValues: ['Option A', 'Option B', 'Option C'],
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    expect(result.current.tempSelected.size).toBe(3);
    act(() => {
      result.current.handleClearSelection();
    });
    expect(result.current.tempSelected.size).toBe(0);
  });

  it('handleApplyMultiSelect calls onFilterChange with selected array', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    act(() => {
      result.current.handleCheckboxChange('Option A', true);
      result.current.handleCheckboxChange('Option C', true);
    });
    act(() => {
      result.current.handleApplyMultiSelect();
    });
    expect(onFilterChange).toHaveBeenCalledWith(['Option A', 'Option C']);
  });

  it('handles undefined options gracefully', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        isFilterOpen: false,
        onFilterChange,
      })
    );
    expect(result.current.filteredOptions).toEqual([]);
  });

  it('handles undefined selectedValues gracefully', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    expect(result.current.tempSelected.size).toBe(0);
  });

  it('does not call onFilterChange if not provided', () => {
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
      })
    );
    act(() => {
      result.current.handleCheckboxChange('Option A', true);
    });
    act(() => {
      result.current.handleApplyMultiSelect();
    });
    // Should not throw
  });

  it('tempSelected can be directly modified via setTempSelected', () => {
    const onFilterChange = jest.fn();
    const { result } = renderHook(() =>
      useMultiSelectFilterState({
        options: mockOptions,
        isFilterOpen: false,
        onFilterChange,
      })
    );
    act(() => {
      result.current.setTempSelected(new Set(['Option B', 'Option D']));
    });
    expect(result.current.tempSelected.size).toBe(2);
    expect(result.current.tempSelected.has('Option B')).toBe(true);
    expect(result.current.tempSelected.has('Option D')).toBe(true);
  });
});
