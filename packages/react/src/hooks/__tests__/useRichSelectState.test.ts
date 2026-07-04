import { renderHook, act } from '@testing-library/react';
import { useRichSelectState } from '../useRichSelectState';

describe('useRichSelectState', () => {
  const values = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];
  const onCommit = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setup(overrides = {}) {
    return renderHook(() =>
      useRichSelectState({
        values,
        initialValue: 'Apple',
        onCommit,
        onCancel,
        ...overrides,
      })
    );
  }

  it('returns all values when search is empty', () => {
    const { result } = setup();
    expect(result.current.filteredValues).toEqual(values);
  });

  it('filters values by search text (case-insensitive)', () => {
    const { result } = setup();
    act(() => { result.current.setSearchText('an'); });
    expect(result.current.filteredValues).toEqual(['Banana']);
  });

  it('returns empty array when no match', () => {
    const { result } = setup();
    act(() => { result.current.setSearchText('zzz'); });
    expect(result.current.filteredValues).toEqual([]);
  });

  it('uses formatValue for display text', () => {
    const formatValue = (v: unknown) => `Fruit: ${v}`;
    const { result } = setup({ formatValue });
    expect(result.current.getDisplayText('Apple')).toBe('Fruit: Apple');
  });

  it('commits selected value via selectValue', () => {
    const { result } = setup();
    act(() => { result.current.selectValue('Banana'); });
    expect(onCommit).toHaveBeenCalledWith('Banana');
  });

  it('keyboard ArrowDown increments highlighted index', () => {
    const { result } = setup();
    expect(result.current.highlightedIndex).toBe(0);
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.KeyboardEvent);
    });
    expect(result.current.highlightedIndex).toBe(1);
  });

  it('keyboard ArrowUp decrements highlighted index (min 0)', () => {
    const { result } = setup();
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.KeyboardEvent);
    });
    expect(result.current.highlightedIndex).toBe(0);
  });

  it('keyboard Enter commits highlighted value', () => {
    const { result } = setup();
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.KeyboardEvent);
    });
    expect(onCommit).toHaveBeenCalledWith('Banana');
  });

  it('keyboard Escape calls onCancel', () => {
    const { result } = setup();
    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.KeyboardEvent);
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it('formatValue filters correctly', () => {
    const formatValue = (v: unknown) => `item-${v}`;
    const { result } = setup({ formatValue });
    act(() => { result.current.setSearchText('item-ch'); });
    expect(result.current.filteredValues).toEqual(['Cherry']);
  });
});
