import * as React from 'react';
import { Select, Checkbox } from '@fluentui/react-components';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { useInlineCellEditorState, useRichSelectState } from '@alaarab/ogrid-core';

// Match cell content layout so column width doesn't shift during editing
const editorWrapperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '6px 10px',
  boxSizing: 'border-box',
  overflow: 'hidden',
  minWidth: 0,
};

const editorInputStyle: React.CSSProperties = {
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

export interface InlineCellEditorProps<T> {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export function InlineCellEditor<T>(props: InlineCellEditorProps<T>): React.ReactElement {
  const { value, column, editorType, onCommit, onCancel } = props;
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

  if (editorType === 'richSelect') {
    return (
      <div ref={wrapperRef} style={{ ...editorWrapperStyle, position: 'relative' }}>
        <input
          type="text"
          value={richSelect.searchText}
          onChange={(e) => richSelect.setSearchText(e.target.value)}
          onKeyDown={richSelect.handleKeyDown}
          placeholder="Search..."
          autoFocus
          style={editorInputStyle}
        />
        <div
          style={{
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
          }}
          role="listbox"
        >
          {richSelect.filteredValues.map((v, i) => (
            <div
              key={String(v)}
              role="option"
              aria-selected={i === richSelect.highlightedIndex}
              onClick={() => richSelect.selectValue(v)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                color: 'var(--ogrid-fg, #242424)',
                background: i === richSelect.highlightedIndex ? 'var(--ogrid-bg-hover, #e8f0fe)' : undefined,
              }}
            >
              {richSelect.getDisplayText(v)}
            </div>
          ))}
          {richSelect.filteredValues.length === 0 && (
            <div style={{ padding: '6px 8px', color: 'var(--ogrid-muted, #999)' }}>No matches</div>
          )}
        </div>
      </div>
    );
  }

  if (editorType === 'checkbox') {
    const checked = value === true;
    return (
      <Checkbox
        checked={checked}
        onChange={(_, data) => commit(data.checked)}
        onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
      />
    );
  }

  if (editorType === 'select') {
    const values = (column.cellEditorParams?.values as unknown[]) ?? [];
    return (
      <div style={editorWrapperStyle}>
        <Select
          value={value !== null && value !== undefined ? String(value) : ''}
          onChange={(_, data) => commit(data.value)}
          onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
        >
          {values.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v)}
            </option>
          ))}
        </Select>
      </div>
    );
  }

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
