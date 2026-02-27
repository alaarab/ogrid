import { renderHook, act } from '@testing-library/react';
import { useInlineCellEditorState } from '../useInlineCellEditorState';

describe('useInlineCellEditorState', () => {
  it('initializes localValue from value prop', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'Hello',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    expect(result.current.localValue).toBe('Hello');
  });

  it('initializes localValue as empty string when value is null', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: null,
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    expect(result.current.localValue).toBe('');
  });

  it('initializes localValue as empty string when value is undefined', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: undefined,
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    expect(result.current.localValue).toBe('');
  });

  it('converts numeric value to string', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 42,
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    expect(result.current.localValue).toBe('42');
  });

  it('setLocalValue updates localValue', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'initial',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.setLocalValue('updated');
    });
    expect(result.current.localValue).toBe('updated');
  });

  it('commit calls onCommit with value', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'test',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.commit('new value');
    });
    expect(onCommit).toHaveBeenCalledWith('new value');
  });

  it('cancel calls onCancel', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'test',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.cancel();
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it('handleKeyDown Escape calls cancel', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'test',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    const mockEvent = {
      key: 'Escape',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });
    expect(onCancel).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('handleKeyDown Enter for text editor commits localValue', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'original',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.setLocalValue('edited');
    });
    const mockEvent = {
      key: 'Enter',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });
    expect(onCommit).toHaveBeenCalledWith('edited');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('handleKeyDown Enter for select editor does not commit', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'option1',
        editorType: 'select',
        onCommit,
        onCancel,
      })
    );
    const mockEvent = {
      key: 'Enter',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('handleKeyDown Enter for checkbox editor does not commit', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: true,
        editorType: 'checkbox',
        onCommit,
        onCancel,
      })
    );
    const mockEvent = {
      key: 'Enter',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('handleBlur for text editor commits localValue', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'initial',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.setLocalValue('blurred');
    });
    act(() => {
      result.current.handleBlur();
    });
    expect(onCommit).toHaveBeenCalledWith('blurred');
  });

  it('handleBlur for select editor does not commit', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'option1',
        editorType: 'select',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.handleBlur();
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('handleBlur for checkbox editor does not commit', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: false,
        editorType: 'checkbox',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.handleBlur();
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('handleBlur for richSelect editor does not commit', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'value1',
        editorType: 'richSelect',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.handleBlur();
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('handleBlur for date editor commits localValue', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: '2024-01-15',
        editorType: 'date',
        onCommit,
        onCancel,
      })
    );
    act(() => {
      result.current.handleBlur();
    });
    expect(onCommit).toHaveBeenCalledWith('2024-01-15');
  });

  // --- Date editor initial value ---
  it('extracts YYYY-MM-DD from full ISO string for date editor (prevents empty date input)', () => {
    // Regression: <input type="date"> requires "YYYY-MM-DD", not a full ISO string.
    // Passing "2024-03-15T00:00:00.000Z" left the date picker empty.
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: '2024-03-15T00:00:00.000Z',
        editorType: 'date',
        onCommit: jest.fn(),
        onCancel: jest.fn(),
      })
    );
    expect(result.current.localValue).toBe('2024-03-15');
  });

  it('keeps plain YYYY-MM-DD value as-is for date editor', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: '2024-03-15',
        editorType: 'date',
        onCommit: jest.fn(),
        onCancel: jest.fn(),
      })
    );
    expect(result.current.localValue).toBe('2024-03-15');
  });

  it('returns empty string for null date value', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: null,
        editorType: 'date',
        onCommit: jest.fn(),
        onCancel: jest.fn(),
      })
    );
    expect(result.current.localValue).toBe('');
  });

  it('handleKeyDown ignores other keys', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'test',
        editorType: 'text',
        onCommit,
        onCancel,
      })
    );
    const mockEvent = {
      key: 'a',
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });
});
