import { useInlineCellEditorState } from '../composables/useInlineCellEditorState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(overrides: Partial<Parameters<typeof useInlineCellEditorState>[0]> = {}) {
  const onCommit = jest.fn();
  const onCancel = jest.fn();
  return {
    params: {
      value: null as unknown,
      editorType: 'date' as const,
      onCommit,
      onCancel,
      ...overrides,
    },
    onCommit,
    onCancel,
  };
}

// ---------------------------------------------------------------------------
// 1. Initial value formatting
// ---------------------------------------------------------------------------

describe('dateEditing  -  initial value formatting', () => {
  it('formats ISO date to YYYY-MM-DD (default format) for text editor', () => {
    const { params } = makeParams({ value: '2024-03-15T00:00:00.000Z' });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('2024-03-15');
  });

  it('formats YYYY-MM-DD value to MM/DD/YYYY when dateFormat is MM/DD/YYYY', () => {
    const { params } = makeParams({ value: '2024-03-15', dateFormat: 'MM/DD/YYYY' });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('03/15/2024');
  });

  it('formats YYYY-MM-DD value to DD/MM/YYYY when dateFormat is DD/MM/YYYY', () => {
    const { params } = makeParams({ value: '2024-03-15', dateFormat: 'DD/MM/YYYY' });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('15/03/2024');
  });

  it('formats YYYY-MM-DD value to YYYY-MM-DD when dateFormat is YYYY-MM-DD', () => {
    const { params } = makeParams({ value: '2024-03-15', dateFormat: 'YYYY-MM-DD' });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('2024-03-15');
  });

  it('returns empty string for null value', () => {
    const { params } = makeParams({ value: null });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('');
  });

  it('returns empty string for undefined value', () => {
    const { params } = makeParams({ value: undefined });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('');
  });

  it('returns empty string for empty string value', () => {
    const { params } = makeParams({ value: '' });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. Native editor type initial value
// ---------------------------------------------------------------------------

describe('dateEditing  -  native editor initial value', () => {
  it('extracts YYYY-MM-DD from ISO string for native editor', () => {
    const { params } = makeParams({
      value: '2024-03-15T00:00:00.000Z',
      dateEditorType: 'native',
    });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('2024-03-15');
  });

  it('keeps YYYY-MM-DD unchanged for native editor', () => {
    const { params } = makeParams({
      value: '2024-03-15',
      dateEditorType: 'native',
    });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('2024-03-15');
  });

  it('returns non-ISO string as-is for native editor', () => {
    const { params } = makeParams({
      value: 'not-a-date',
      dateEditorType: 'native',
    });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// 3. Commit with text editor (parses user input back to ISO)
// ---------------------------------------------------------------------------

describe('dateEditing  -  commit with text editor', () => {
  it('commits MM/DD/YYYY input as YYYY-MM-DD to onCommit', () => {
    const { params, onCommit } = makeParams({ dateFormat: 'MM/DD/YYYY', value: '2024-03-15' });
    const { handleKeyDown, localValue, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('06/25/2025');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('2025-06-25');
  });

  it('commits DD/MM/YYYY input as YYYY-MM-DD to onCommit', () => {
    const { params, onCommit } = makeParams({ dateFormat: 'DD/MM/YYYY', value: '2024-03-15' });
    const { handleKeyDown, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('25/06/2025');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('2025-06-25');
  });

  it('commits YYYY-MM-DD input unchanged to onCommit', () => {
    const { params, onCommit } = makeParams({ dateFormat: 'YYYY-MM-DD', value: '2024-03-15' });
    const { handleKeyDown, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('2025-06-25');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('2025-06-25');
  });

  it('commits on blur', () => {
    const { params, onCommit } = makeParams({ dateFormat: 'MM/DD/YYYY', value: null });
    const { handleBlur, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('12/31/2023');
    handleBlur();
    expect(onCommit).toHaveBeenCalledWith('2023-12-31');
  });

  it('passes through invalid input as null (parseUserInputDate returns null for invalid)', () => {
    const { params, onCommit } = makeParams({ dateFormat: 'MM/DD/YYYY', value: null });
    const { handleKeyDown, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('not-a-date');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // parseUserInputDate returns null for unparseable input → we commit null
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('commits null for empty date', () => {
    const { params, onCommit } = makeParams({ dateFormat: 'MM/DD/YYYY', value: '2024-03-15' });
    const { handleKeyDown, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Empty string → parseUserInputDate returns null → we commit null
    expect(onCommit).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// 4. Commit with native editor (passes through as-is)
// ---------------------------------------------------------------------------

describe('dateEditing  -  commit with native editor', () => {
  it('commits YYYY-MM-DD value as-is for native editor', () => {
    const { params, onCommit } = makeParams({
      value: '2024-03-15',
      dateEditorType: 'native',
    });
    const { handleKeyDown, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('2025-06-25');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('2025-06-25');
  });

  it('commits on blur for native editor', () => {
    const { params, onCommit } = makeParams({
      value: '2024-03-15',
      dateEditorType: 'native',
    });
    const { handleBlur, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('2025-06-25');
    handleBlur();
    expect(onCommit).toHaveBeenCalledWith('2025-06-25');
  });
});

// ---------------------------------------------------------------------------
// 5. Cancel
// ---------------------------------------------------------------------------

describe('dateEditing  -  cancel', () => {
  it('calls onCancel on Escape key', () => {
    const { params, onCancel } = makeParams({ value: '2024-03-15', dateFormat: 'MM/DD/YYYY' });
    const { handleKeyDown } = useInlineCellEditorState(params);
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not commit on Escape', () => {
    const { params, onCommit, onCancel } = makeParams({ value: '2024-03-15' });
    const { handleKeyDown } = useInlineCellEditorState(params);
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. setLocalValue and reactivity
// ---------------------------------------------------------------------------

describe('dateEditing  -  setLocalValue', () => {
  it('updates localValue ref', () => {
    const { params } = makeParams({ value: '2024-03-15', dateFormat: 'MM/DD/YYYY' });
    const { localValue, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('99/99/9999');
    expect(localValue.value).toBe('99/99/9999');
  });
});

// ---------------------------------------------------------------------------
// 7. Format switching (different dateFormat per column)
// ---------------------------------------------------------------------------

describe('dateEditing  -  format switching', () => {
  it('handles MM/DD/YYYY and DD/MM/YYYY independently', () => {
    const isoDate = '2024-07-04';

    const { params: paramsUs } = makeParams({ value: isoDate, dateFormat: 'MM/DD/YYYY' });
    const usEditor = useInlineCellEditorState(paramsUs);
    expect(usEditor.localValue.value).toBe('07/04/2024');

    const { params: paramsEu } = makeParams({ value: isoDate, dateFormat: 'DD/MM/YYYY' });
    const euEditor = useInlineCellEditorState(paramsEu);
    expect(euEditor.localValue.value).toBe('04/07/2024');
  });

  it('round-trips MM/DD/YYYY: format then parse', () => {
    const { params, onCommit } = makeParams({ value: '2024-12-31', dateFormat: 'MM/DD/YYYY' });
    const { localValue, handleKeyDown } = useInlineCellEditorState(params);

    // localValue should be formatted
    expect(localValue.value).toBe('12/31/2024');

    // Simulate user keeping the same value and committing
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('2024-12-31');
  });

  it('round-trips DD/MM/YYYY: format then parse', () => {
    const { params, onCommit } = makeParams({ value: '2024-12-31', dateFormat: 'DD/MM/YYYY' });
    const { localValue, handleKeyDown } = useInlineCellEditorState(params);

    expect(localValue.value).toBe('31/12/2024');

    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('2024-12-31');
  });
});

// ---------------------------------------------------------------------------
// 8. Non-date editor types are unaffected
// ---------------------------------------------------------------------------

describe('dateEditing  -  non-date editor types', () => {
  it('text editor initializes with raw string', () => {
    const { params } = makeParams({ value: 'hello', editorType: 'text' });
    const { localValue } = useInlineCellEditorState(params);
    expect(localValue.value).toBe('hello');
  });

  it('text editor commits raw string on Enter', () => {
    const { params, onCommit } = makeParams({ value: 'hello', editorType: 'text' });
    const { handleKeyDown, setLocalValue } = useInlineCellEditorState(params);
    setLocalValue('world');
    handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // text editor does not go through parseUserInputDate
    expect(onCommit).toHaveBeenCalledWith('world');
  });
});
