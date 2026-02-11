import { renderHook, act } from '@testing-library/react';
import { useTextFilterState } from '../useTextFilterState';

describe('useTextFilterState', () => {
  it('initializes with empty tempTextValue when no textValue provided', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
        onTextChange,
      })
    );
    expect(result.current.tempTextValue).toBe('');
  });

  it('initializes tempTextValue from textValue prop', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        textValue: 'Hello World',
        isFilterOpen: false,
        onTextChange,
      })
    );
    expect(result.current.tempTextValue).toBe('Hello World');
  });

  it('syncs temp state when popover opens', () => {
    const onTextChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ isFilterOpen, textValue }) =>
        useTextFilterState({ textValue, isFilterOpen, onTextChange }),
      { initialProps: { isFilterOpen: false, textValue: 'original' } }
    );

    // Modify temp value
    act(() => {
      result.current.setTempTextValue('modified');
    });
    expect(result.current.tempTextValue).toBe('modified');

    // Open popover - should sync from textValue
    rerender({ isFilterOpen: true, textValue: 'original' });
    expect(result.current.tempTextValue).toBe('original');
  });

  it('setTempTextValue updates tempTextValue', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
        onTextChange,
      })
    );
    act(() => {
      result.current.setTempTextValue('new value');
    });
    expect(result.current.tempTextValue).toBe('new value');
  });

  it('handleTextApply calls onTextChange with trimmed value', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
        onTextChange,
      })
    );
    act(() => {
      result.current.setTempTextValue('  test value  ');
    });
    act(() => {
      result.current.handleTextApply();
    });
    expect(onTextChange).toHaveBeenCalledWith('test value');
  });

  it('handleTextApply calls onTextChange with empty string when value is whitespace', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
        onTextChange,
      })
    );
    act(() => {
      result.current.setTempTextValue('   ');
    });
    act(() => {
      result.current.handleTextApply();
    });
    expect(onTextChange).toHaveBeenCalledWith('');
  });

  it('handleTextApply calls onTextChange with empty string when tempTextValue is empty', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
        onTextChange,
      })
    );
    act(() => {
      result.current.handleTextApply();
    });
    expect(onTextChange).toHaveBeenCalledWith('');
  });

  it('handleTextClear clears tempTextValue', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        textValue: 'existing',
        isFilterOpen: false,
        onTextChange,
      })
    );
    expect(result.current.tempTextValue).toBe('existing');
    act(() => {
      result.current.handleTextClear();
    });
    expect(result.current.tempTextValue).toBe('');
  });

  it('does not call onTextChange if not provided', () => {
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
      })
    );
    act(() => {
      result.current.setTempTextValue('test');
    });
    act(() => {
      result.current.handleTextApply();
    });
    // Should not throw
  });

  it('syncs tempTextValue when textValue prop changes and popover is open', () => {
    const onTextChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ textValue }) =>
        useTextFilterState({ textValue, isFilterOpen: true, onTextChange }),
      { initialProps: { textValue: 'first' } }
    );

    expect(result.current.tempTextValue).toBe('first');

    rerender({ textValue: 'second' });
    expect(result.current.tempTextValue).toBe('second');
  });

  it('does not sync tempTextValue when popover is closed', () => {
    const onTextChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ textValue }) =>
        useTextFilterState({ textValue, isFilterOpen: false, onTextChange }),
      { initialProps: { textValue: 'first' } }
    );

    act(() => {
      result.current.setTempTextValue('edited');
    });

    rerender({ textValue: 'second' });
    // Should keep edited value since popover is closed
    expect(result.current.tempTextValue).toBe('edited');
  });

  it('handles undefined textValue as empty string', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        textValue: undefined,
        isFilterOpen: false,
        onTextChange,
      })
    );
    expect(result.current.tempTextValue).toBe('');
  });

  it('preserves multiline text', () => {
    const onTextChange = jest.fn();
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const { result } = renderHook(() =>
      useTextFilterState({
        textValue: multilineText,
        isFilterOpen: false,
        onTextChange,
      })
    );
    expect(result.current.tempTextValue).toBe(multilineText);
    act(() => {
      result.current.handleTextApply();
    });
    expect(onTextChange).toHaveBeenCalledWith(multilineText);
  });

  it('trims leading and trailing whitespace but preserves internal spaces', () => {
    const onTextChange = jest.fn();
    const { result } = renderHook(() =>
      useTextFilterState({
        isFilterOpen: false,
        onTextChange,
      })
    );
    act(() => {
      result.current.setTempTextValue('  multiple   spaces   inside  ');
    });
    act(() => {
      result.current.handleTextApply();
    });
    expect(onTextChange).toHaveBeenCalledWith('multiple   spaces   inside');
  });
});
