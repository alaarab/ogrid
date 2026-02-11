import { renderHook, act } from '@testing-library/react';
import { usePeopleFilterState } from '../usePeopleFilterState';
import type { UserLike } from '../../types/dataGridTypes';

describe('usePeopleFilterState', () => {
  const mockUser1: UserLike = {
    displayName: 'John Doe',
    email: 'john.doe@example.com',
  };
  const mockUser2: UserLike = {
    displayName: 'Jane Smith',
    email: 'jane.smith@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with empty suggestions and search text', () => {
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: false,
        filterType: 'people',
        onUserChange,
      })
    );
    expect(result.current.peopleSuggestions).toEqual([]);
    expect(result.current.isPeopleLoading).toBe(false);
    expect(result.current.peopleSearchText).toBe('');
  });

  it('provides peopleInputRef', () => {
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: false,
        filterType: 'people',
        onUserChange,
      })
    );
    expect(result.current.peopleInputRef).toBeDefined();
    expect(result.current.peopleInputRef.current).toBeNull();
  });

  it('syncs state when popover opens', () => {
    const onUserChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ isFilterOpen }) =>
        usePeopleFilterState({
          selectedUser: mockUser1,
          isFilterOpen,
          filterType: 'people',
          onUserChange,
        }),
      { initialProps: { isFilterOpen: false } }
    );

    act(() => {
      result.current.setPeopleSearchText('test');
    });
    expect(result.current.peopleSearchText).toBe('test');

    rerender({ isFilterOpen: true });
    expect(result.current.peopleSearchText).toBe('');
    expect(result.current.peopleSuggestions).toEqual([]);
  });

  it('setPeopleSearchText updates peopleSearchText', () => {
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: false,
        filterType: 'people',
        onUserChange,
      })
    );
    act(() => {
      result.current.setPeopleSearchText('John');
    });
    expect(result.current.peopleSearchText).toBe('John');
  });

  it('debounced people search calls peopleSearch after 300ms', async () => {
    const mockPeopleSearch = jest.fn().mockResolvedValue([mockUser1, mockUser2]);
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('John');
    });

    expect(result.current.isPeopleLoading).toBe(true);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(mockPeopleSearch).toHaveBeenCalledWith('John');
    expect(result.current.peopleSuggestions).toEqual([mockUser1, mockUser2]);
    expect(result.current.isPeopleLoading).toBe(false);
  });

  it('does not search when peopleSearchText is empty', async () => {
    const mockPeopleSearch = jest.fn();
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(mockPeopleSearch).not.toHaveBeenCalled();
    expect(result.current.peopleSuggestions).toEqual([]);
  });

  it('does not search when peopleSearchText is whitespace', async () => {
    const mockPeopleSearch = jest.fn();
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('   ');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(mockPeopleSearch).not.toHaveBeenCalled();
    expect(result.current.peopleSuggestions).toEqual([]);
  });

  it('does not search when filterType is not people', async () => {
    const mockPeopleSearch = jest.fn();
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'text',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('John');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(mockPeopleSearch).not.toHaveBeenCalled();
  });

  it('does not search when popover is closed', async () => {
    const mockPeopleSearch = jest.fn();
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: false,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('John');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(mockPeopleSearch).not.toHaveBeenCalled();
  });

  it('limits suggestions to 10 results', async () => {
    const manyUsers: UserLike[] = Array.from({ length: 20 }, (_, i) => ({
      displayName: `User ${i}`,
      email: `user${i}@example.com`,
    }));
    const mockPeopleSearch = jest.fn().mockResolvedValue(manyUsers);
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('User');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(result.current.peopleSuggestions).toHaveLength(10);
  });

  it('handles search error gracefully', async () => {
    const mockPeopleSearch = jest.fn().mockRejectedValue(new Error('Network error'));
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('John');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(result.current.peopleSuggestions).toEqual([]);
    expect(result.current.isPeopleLoading).toBe(false);
  });

  it('handleUserSelect calls onUserChange with user', () => {
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: false,
        filterType: 'people',
        onUserChange,
      })
    );
    act(() => {
      result.current.handleUserSelect(mockUser1);
    });
    expect(onUserChange).toHaveBeenCalledWith(mockUser1);
  });

  it('handleClearUser calls onUserChange with undefined', () => {
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        selectedUser: mockUser1,
        isFilterOpen: false,
        filterType: 'people',
        onUserChange,
      })
    );
    act(() => {
      result.current.handleClearUser();
    });
    expect(onUserChange).toHaveBeenCalledWith(undefined);
  });

  it('does not call onUserChange if not provided', () => {
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: false,
        filterType: 'people',
      })
    );
    act(() => {
      result.current.handleUserSelect(mockUser1);
    });
    act(() => {
      result.current.handleClearUser();
    });
    // Should not throw
  });

  it('cancels pending search when new search starts', async () => {
    const mockPeopleSearch = jest.fn().mockImplementation(
      (query: string) =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ displayName: query, email: `${query}@example.com` }]), 100);
        })
    );
    const onUserChange = jest.fn();
    const { result } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('John');
    });

    // Start another search before first completes
    act(() => {
      result.current.setPeopleSearchText('Jane');
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    // The debounce timer is cancelled when new search starts, so only the last search executes
    expect(mockPeopleSearch).toHaveBeenCalledTimes(1);
    expect(mockPeopleSearch).toHaveBeenCalledWith('Jane');
  });

  it('cleans up timeout on unmount', () => {
    const mockPeopleSearch = jest.fn().mockResolvedValue([]);
    const onUserChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      usePeopleFilterState({
        isFilterOpen: true,
        filterType: 'people',
        peopleSearch: mockPeopleSearch,
        onUserChange,
      })
    );

    act(() => {
      result.current.setPeopleSearchText('John');
    });

    unmount();
    // Should not throw and should clean up timeout
  });
});
