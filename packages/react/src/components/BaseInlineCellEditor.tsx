import * as React from 'react';
import type { IColumnDef } from '../types';
import { useInlineCellEditorState, useRichSelectState } from '../hooks';

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
  border: '1px solid var(--ogrid-border, #ccc)',
  zIndex: 10,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
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
  /** Framework-specific select renderer */
  renderSelect: (
    value: unknown,
    values: unknown[],
    onCommit: (value: unknown) => void,
    onCancel: () => void,
  ) => React.ReactNode;
}

/**
 * Base inline cell editor with shared logic for all editor types except checkbox and select
 * (which are framework-specific). Used by all 3 UI packages to avoid duplication.
 *
 * Usage:
 * - Radix: Pass Radix Checkbox/native select via render props
 * - Fluent: Pass Fluent Checkbox/Select via render props
 * - Material: Pass MUI Checkbox/Select via render props
 */
export function BaseInlineCellEditor<T>(props: BaseInlineCellEditorProps<T>): React.ReactElement {
  const { value, column, editorType, onCommit, onCancel, renderCheckbox, renderSelect } = props;
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const { localValue, setLocalValue, handleKeyDown, handleBlur, commit, cancel } =
    useInlineCellEditorState({ value, editorType, onCommit, onCancel });

  const richSelectValues = (column.cellEditorParams?.values as unknown[]) ?? [];
  const richSelectFormatValue = column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined;
  const richSelect = useRichSelectState({
    values: richSelectValues,
    formatValue: richSelectFormatValue,
    initialValue: value,
    onCommit,
    onCancel,
  });

  React.useEffect(() => {
    const input = wrapperRef.current?.querySelector('input');
    input?.focus();
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
        <div style={richSelectDropdownStyle} role="listbox">
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

  // Select (framework-specific)
  if (editorType === 'select') {
    const values = (column.cellEditorParams?.values as unknown[]) ?? [];
    return <>{renderSelect(value, values, commit, cancel)}</>;
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
