import * as React from 'react';
import type { IColumnDef } from '../types';
import { useInlineCellEditorState, useRichSelectState, useSelectState } from '../hooks';

// ── Shared editor style constants (used across all 3 UI packages) ──

export const editorWrapperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '6px 10px',
  boxSizing: 'border-box',
  overflow: 'hidden',
  minWidth: 0,
};

export const editorInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '13px',
  outline: 'none',
  minWidth: 0,
};

export const richSelectWrapperStyle: React.CSSProperties = {
  ...editorWrapperStyle,
  position: 'relative',
};

export const richSelectDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  maxHeight: 200,
  overflowY: 'auto',
  background: 'var(--ogrid-bg, #fff)',
  border: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
  zIndex: 10,
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.2))',
  textAlign: 'left',
};

export const richSelectOptionStyle: React.CSSProperties = {
  padding: '6px 8px',
  cursor: 'pointer',
  color: 'var(--ogrid-fg, #242424)',
};

export const richSelectOptionHighlightedStyle: React.CSSProperties = {
  ...richSelectOptionStyle,
  background: 'var(--ogrid-bg-hover, #e8f0fe)',
};

export const richSelectNoMatchesStyle: React.CSSProperties = {
  padding: '6px 8px',
  color: 'var(--ogrid-muted, #999)',
};

export const selectEditorStyle: React.CSSProperties = {
  width: '100%',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
  outline: 'none',
};

export const selectDisplayStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'inherit',
};

export const selectChevronStyle: React.CSSProperties = {
  marginLeft: 4,
  fontSize: '10px',
  opacity: 0.5,
};

// ── BaseInlineCellEditor component ──

export interface BaseInlineCellEditorProps<T> {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  /** Framework-specific checkbox renderer */
  renderCheckbox: (checked: boolean, onCommit: (value: boolean) => void, onCancel: () => void) => React.ReactNode;
  /** @deprecated Built-in custom dropdown is now used. Kept for backward compatibility. */
  renderSelect?: (
    value: unknown,
    values: unknown[],
    onCommit: (value: unknown) => void,
    onCancel: () => void,
  ) => React.ReactNode;
}

/**
 * Base inline cell editor with shared logic for all editor types except checkbox
 * (which is framework-specific). Used by all 3 UI packages to avoid duplication.
 *
 * Text, date, select, and richSelect editors are fully shared.
 * Checkbox is delegated via renderCheckbox render prop.
 */
export function BaseInlineCellEditor<T>(props: BaseInlineCellEditorProps<T>): React.ReactElement {
  const { value, column, editorType, onCommit, onCancel, renderCheckbox } = props;
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const { localValue, setLocalValue, handleKeyDown, handleBlur, commit, cancel } =
    useInlineCellEditorState({ value, editorType, onCommit, onCancel });

  const editorValues = (column.cellEditorParams?.values as unknown[]) ?? [];
  const editorFormatValue = column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined;
  const richSelect = useRichSelectState({
    values: editorValues,
    formatValue: editorFormatValue,
    initialValue: value,
    onCommit,
    onCancel,
  });
  const selectState = useSelectState({
    values: editorValues,
    formatValue: editorFormatValue,
    initialValue: value,
    onCommit,
    onCancel,
  });

  // Fixed dropdown positioning to escape ancestor overflow clipping (.tableWrapper)
  const [fixedDropdownStyle, setFixedDropdownStyle] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (editorType !== 'select' && editorType !== 'richSelect') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const maxH = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < maxH && rect.top > spaceBelow;
    setFixedDropdownStyle({
      position: 'fixed',
      ...(flipUp ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom }),
      left: rect.left,
      width: rect.width,
      maxHeight: maxH,
      overflowY: 'auto',
      background: 'var(--ogrid-bg, #fff)',
      border: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
      zIndex: 9999,
      boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.2))',
      textAlign: 'left',
    });
  }, [editorType]);

  const computedDropdownStyle = fixedDropdownStyle ?? richSelectDropdownStyle;

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const input = wrapper.querySelector('input');
    if (input) {
      input.focus();
      if (editorType === 'date') {
        // Auto-open the native date picker (like Excel)
        try { input.showPicker(); } catch { /* older browsers */ }
      } else {
        // Select all text for easy replacement (like Excel)
        input.select();
      }
    } else {
      // Focus the wrapper for keyboard events (select editor has no input)
      wrapper.focus();
    }
  }, []);

  // Rich select (shared across all frameworks)
  if (editorType === 'richSelect') {
    return (
      <div ref={wrapperRef} style={richSelectWrapperStyle}>
        <input
          type="text"
          value={richSelect.searchText}
          onChange={(e) => richSelect.setSearchText(e.target.value)}
          onKeyDown={richSelect.handleKeyDown}
          placeholder="Search..."
          autoFocus
          style={editorInputStyle}
        />
        <div style={computedDropdownStyle} role="listbox">
          {richSelect.filteredValues.map((v, i) => (
            <div
              key={String(v)}
              role="option"
              aria-selected={i === richSelect.highlightedIndex}
              onClick={() => richSelect.selectValue(v)}
              style={i === richSelect.highlightedIndex ? richSelectOptionHighlightedStyle : richSelectOptionStyle}
            >
              {richSelect.getDisplayText(v)}
            </div>
          ))}
          {richSelect.filteredValues.length === 0 && (
            <div style={richSelectNoMatchesStyle}>No matches</div>
          )}
        </div>
      </div>
    );
  }

  // Checkbox (framework-specific)
  if (editorType === 'checkbox') {
    const checked = value === true;
    return <>{renderCheckbox(checked, (val) => commit(val), cancel)}</>;
  }

  // Select (custom dropdown, shared across all frameworks)
  if (editorType === 'select') {
    return (
      <div ref={wrapperRef} style={richSelectWrapperStyle} onKeyDown={selectState.handleKeyDown} tabIndex={0}>
        <div style={selectDisplayStyle}>
          <span>{selectState.getDisplayText(value)}</span>
          <span style={selectChevronStyle}>&#9662;</span>
        </div>
        <div style={computedDropdownStyle} ref={selectState.dropdownRef} role="listbox">
          {editorValues.map((v, i) => (
            <div
              key={String(v)}
              role="option"
              aria-selected={i === selectState.highlightedIndex}
              onClick={() => selectState.selectValue(v)}
              style={i === selectState.highlightedIndex ? richSelectOptionHighlightedStyle : richSelectOptionStyle}
            >
              {selectState.getDisplayText(v)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Date editor (shared across all frameworks)
  if (editorType === 'date') {
    return (
      <div ref={wrapperRef} style={editorWrapperStyle}>
        <input
          type="date"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={editorInputStyle}
          autoFocus
        />
      </div>
    );
  }

  // Text editor (default, shared across all frameworks)
  return (
    <div ref={wrapperRef} style={editorWrapperStyle}>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={editorInputStyle}
        autoFocus
      />
    </div>
  );
}
