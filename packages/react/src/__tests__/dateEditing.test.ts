/**
 * Integration tests for date editing in React.
 * Tests useInlineCellEditorState with date editorType, various formats, and editor types.
 */

import { renderHook, act } from '@testing-library/react';
import { useInlineCellEditorState } from '../hooks/useInlineCellEditorState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(overrides: Partial<Parameters<typeof useInlineCellEditorState>[0]> = {}) {
  return {
    value: null as unknown,
    editorType: 'date' as const,
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
}

function keyEvent(key: string): React.KeyboardEvent {
  return {
    key,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as React.KeyboardEvent;
}

// ---------------------------------------------------------------------------
// 1. Initialization — display formatting
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — date display initialization', () => {
  it('initializes empty string for null value', () => {
    const { result: hookResult } = renderHook(() =>
      useInlineCellEditorState(makeParams({ value: null }))
    );
    expect(hookResult.current.localValue).toBe('');
  });

  it('initializes empty string for undefined value', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(makeParams({ value: undefined }))
    );
    expect(result.current.localValue).toBe('');
  });

  it('formats ISO date as YYYY-MM-DD by default (text editor)', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(makeParams({ value: '2024-03-15T00:00:00.000Z' }))
    );
    expect(result.current.localValue).toBe('2024-03-15');
  });

  it('formats ISO date as MM/DD/YYYY when dateFormat is MM/DD/YYYY', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15T00:00:00.000Z', dateFormat: 'MM/DD/YYYY' })
      )
    );
    expect(result.current.localValue).toBe('03/15/2024');
  });

  it('formats ISO date as DD/MM/YYYY when dateFormat is DD/MM/YYYY', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15T00:00:00.000Z', dateFormat: 'DD/MM/YYYY' })
      )
    );
    expect(result.current.localValue).toBe('15/03/2024');
  });

  it('formats plain YYYY-MM-DD string with custom format', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', dateFormat: 'MM/DD/YYYY' })
      )
    );
    expect(result.current.localValue).toBe('03/15/2024');
  });

  it('formats YYYY-MM-DD correctly for ISO format', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', dateFormat: 'YYYY-MM-DD' })
      )
    );
    expect(result.current.localValue).toBe('2024-03-15');
  });
});

// ---------------------------------------------------------------------------
// 2. Native editor initialization
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — native date editor initialization', () => {
  it('extracts YYYY-MM-DD for native editor from ISO string', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15T00:00:00.000Z', dateEditorType: 'native' })
      )
    );
    expect(result.current.localValue).toBe('2024-03-15');
  });

  it('keeps YYYY-MM-DD string as-is for native editor', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', dateEditorType: 'native' })
      )
    );
    expect(result.current.localValue).toBe('2024-03-15');
  });

  it('passes through raw string for native editor if not ISO format', () => {
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: 'not-a-date', dateEditorType: 'native' })
      )
    );
    expect(result.current.localValue).toBe('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// 3. Commit on Enter — text editor (parses back to YYYY-MM-DD)
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — Enter commits and parses date (text editor)', () => {
  it('commits parsed YYYY-MM-DD on Enter for YYYY-MM-DD format', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'YYYY-MM-DD' })
      )
    );
    act(() => { result.current.setLocalValue('2024-06-01'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2024-06-01');
  });

  it('commits parsed YYYY-MM-DD on Enter for MM/DD/YYYY format', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('06/01/2024'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2024-06-01');
  });

  it('commits parsed YYYY-MM-DD on Enter for DD/MM/YYYY format', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'DD/MM/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('01/06/2024'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2024-06-01');
  });

  it('commits empty string on Enter when field is empty', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('');
  });

  it('commits raw string on Enter for invalid input', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('not-a-date'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    // Invalid dates pass through as raw strings
    expect(onCommit).toHaveBeenCalledWith('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// 4. Commit on Enter — native editor (no parsing, value is already YYYY-MM-DD)
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — Enter commits raw value (native editor)', () => {
  it('commits YYYY-MM-DD directly on Enter for native editor', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', onCommit, dateEditorType: 'native' })
      )
    );
    act(() => { result.current.setLocalValue('2024-06-01'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2024-06-01');
  });
});

// ---------------------------------------------------------------------------
// 5. Commit on blur — text editor
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — blur commits and parses date (text editor)', () => {
  it('commits parsed date on blur for MM/DD/YYYY', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('03/15/2024'); });
    act(() => { result.current.handleBlur(); });
    expect(onCommit).toHaveBeenCalledWith('2024-03-15');
  });

  it('commits parsed date on blur for DD/MM/YYYY', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'DD/MM/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('15/03/2024'); });
    act(() => { result.current.handleBlur(); });
    expect(onCommit).toHaveBeenCalledWith('2024-03-15');
  });

  it('commits empty string on blur when field cleared', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue(''); });
    act(() => { result.current.handleBlur(); });
    expect(onCommit).toHaveBeenCalledWith('');
  });
});

// ---------------------------------------------------------------------------
// 6. Commit on blur — native editor
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — blur commits raw value (native editor)', () => {
  it('commits YYYY-MM-DD directly on blur for native editor', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', onCommit, dateEditorType: 'native' })
      )
    );
    act(() => { result.current.setLocalValue('2025-01-20'); });
    act(() => { result.current.handleBlur(); });
    expect(onCommit).toHaveBeenCalledWith('2025-01-20');
  });
});

// ---------------------------------------------------------------------------
// 7. Cancel on Escape
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — Escape cancels edit', () => {
  it('calls onCancel on Escape', () => {
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(makeParams({ value: '2024-03-15', onCancel }))
    );
    act(() => { result.current.handleKeyDown(keyEvent('Escape')); });
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onCommit on Escape', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(makeParams({ value: '2024-03-15', onCommit, onCancel }))
    );
    act(() => { result.current.handleKeyDown(keyEvent('Escape')); });
    expect(onCommit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. Format switching (reactive to prop changes)
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — reactive format', () => {
  it('formats correctly when dateFormat changes between renders', () => {
    let format = 'MM/DD/YYYY';
    const { result, rerender } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: '2024-03-15', dateFormat: format })
      )
    );
    expect(result.current.localValue).toBe('03/15/2024');

    // Change format — note: useState initializes once, so localValue won't change;
    // but blur/Enter will use the new format from effectiveDateFormat closure
    format = 'DD/MM/YYYY';
    rerender();
    // localValue stays at initial value (controlled by useState)
    expect(result.current.localValue).toBe('03/15/2024');
  });
});

// ---------------------------------------------------------------------------
// 9. Edge cases
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — date edge cases', () => {
  it('handles leap year date Feb 29', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('02/29/2024'); }); // 2024 is a leap year
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2024-02-29');
  });

  it('passes through invalid date Feb 29 in non-leap year', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('02/29/2023'); }); // 2023 is NOT a leap year
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    // parseUserInputDate returns null for invalid dates; commitDateValue returns raw string
    expect(onCommit).toHaveBeenCalledWith('02/29/2023');
  });

  it('handles year-end date Dec 31', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'MM/DD/YYYY' })
      )
    );
    act(() => { result.current.setLocalValue('12/31/2024'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2024-12-31');
  });

  it('handles year-start date Jan 01', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(
        makeParams({ value: null, onCommit, dateFormat: 'YYYY-MM-DD' })
      )
    );
    act(() => { result.current.setLocalValue('2025-01-01'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('2025-01-01');
  });

  it('does not commit on unrecognized key', () => {
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState(makeParams({ value: '2024-03-15', onCommit, onCancel }))
    );
    act(() => { result.current.handleKeyDown(keyEvent('Tab')); });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 10. Non-date editor — not affected by date params
// ---------------------------------------------------------------------------

describe('useInlineCellEditorState — text editor unaffected by dateFormat', () => {
  it('text editor commits raw value, ignoring dateFormat', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useInlineCellEditorState({
        value: 'hello',
        editorType: 'text',
        onCommit,
        onCancel: jest.fn(),
        dateFormat: 'MM/DD/YYYY',
      })
    );
    act(() => { result.current.setLocalValue('world'); });
    act(() => { result.current.handleKeyDown(keyEvent('Enter')); });
    expect(onCommit).toHaveBeenCalledWith('world');
  });
});
