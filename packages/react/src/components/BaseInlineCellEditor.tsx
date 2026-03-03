import * as React from 'react';
import { createPortal } from 'react-dom';
import { getDateInputPlaceholder, DEFAULT_DATE_FORMAT } from '@alaarab/ogrid-core';
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
  // Use at least 16px so iOS Safari does not auto-zoom when the input is focused.
  // On desktop this is overridden to 13px via CSS (see _data-grid-table.scss).
  fontSize: '16px',
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
  fontSize: '13px',
  fontFamily: 'inherit',
};

export const richSelectOptionStyle: React.CSSProperties = {
  padding: '6px 8px',
  cursor: 'pointer',
  color: 'var(--ogrid-fg, #242424)',
  fontSize: '13px',
};

export const richSelectOptionHighlightedStyle: React.CSSProperties = {
  ...richSelectOptionStyle,
  background: 'var(--ogrid-bg-hover, #e8f0fe)',
  fontSize: '13px',
};

export const richSelectNoMatchesStyle: React.CSSProperties = {
  padding: '6px 8px',
  color: 'var(--ogrid-muted, #999)',
  fontSize: '13px',
};

export const richSelectFooterStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderTop: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
  fontSize: '11px',
  color: 'var(--ogrid-muted, #999)',
  textAlign: 'right',
  position: 'sticky',
  bottom: 0,
  background: 'var(--ogrid-bg, #fff)',
};

export const richSelectSearchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  borderBottom: '1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12))',
  background: 'var(--ogrid-bg, #fff)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  position: 'sticky',
  top: 0,
  zIndex: 1,
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
  const onCancelRef = React.useRef(onCancel);
  onCancelRef.current = onCancel;

  // Date editor configuration from cellEditorParams or column-level dateFormat
  const dateFormat = column.cellEditorParams?.dateFormat ?? column.dateFormat ?? DEFAULT_DATE_FORMAT;
  const dateEditorType = column.cellEditorParams?.editorType ?? 'text';

  const { localValue, setLocalValue, handleKeyDown, handleBlur, commit, cancel } =
    useInlineCellEditorState({ value, editorType, onCommit, onCancel, dateFormat, dateEditorType });

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
    const computedStyle = wrapper.closest('table') ? getComputedStyle(wrapper) : null;
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
      fontSize: '13px',
      fontFamily: computedStyle?.fontFamily ?? 'inherit',
    });

    // Close editor on scroll so the fixed dropdown doesn't drift away from the cell.
    // Delay attachment via RAF to skip spurious scroll events fired during mount
    // (e.g. focus-triggered scroll, layout-shift scroll from DOM changes).
    const scrollParent = wrapper.closest('[data-ogrid-scroll-container]') ?? wrapper.closest('[style*="overflow"]');
    const handleScroll = () => onCancelRef.current();
    const raf = requestAnimationFrame(() => {
      if (scrollParent) {
        scrollParent.addEventListener('scroll', handleScroll, { passive: true });
      }
      window.addEventListener('scroll', handleScroll, { passive: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (scrollParent) scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [editorType]);

  const computedDropdownStyle = fixedDropdownStyle ?? richSelectDropdownStyle;

  React.useEffect(() => {
    // richSelect search input lives inside the (possibly portaled) dropdown,
    // so autoFocus on the <input> handles focus. Skip the wrapper query here.
    if (editorType === 'richSelect') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const input = wrapper.querySelector('input');
    if (input) {
      input.focus({ preventScroll: true });
      // Select all text for easy replacement (like Excel)
      input.select();
    } else {
      // Focus the wrapper for keyboard events (select editor has no input)
      wrapper.focus({ preventScroll: true });
    }
  }, [editorType]); // Run when editorType changes to focus appropriate element

  // Helper: portal dropdown to document.body when using fixed positioning
  // to escape ancestor `contain: content` which clips even fixed elements
  const usePortal = fixedDropdownStyle != null;

  // Rich select (shared across all frameworks)
  if (editorType === 'richSelect') {
    const dropdownContent = (
      <div style={computedDropdownStyle} role="listbox">
        <input
          type="text"
          value={richSelect.searchText}
          onChange={(e) => richSelect.setSearchText(e.target.value)}
          onKeyDown={richSelect.handleKeyDown}
          placeholder="Search..."
          autoFocus
          style={richSelectSearchInputStyle}
        />
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
    );
    return (
      <div ref={wrapperRef} style={richSelectWrapperStyle}>
        <div style={selectDisplayStyle}>
          <span>{richSelect.getDisplayText(value)}</span>
          <span style={selectChevronStyle}>&#9662;</span>
        </div>
        {usePortal ? createPortal(dropdownContent, document.body) : dropdownContent}
      </div>
    );
  }

  // Checkbox (framework-specific)
  if (editorType === 'checkbox') {
    const checked = value === true;
    return (
      <div style={{ ...editorWrapperStyle, justifyContent: 'center' }}>
        {renderCheckbox(checked, (val) => commit(val), cancel)}
      </div>
    );
  }

  // Select (custom dropdown, shared across all frameworks)
  if (editorType === 'select') {
    const dropdownContent = (
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
    );
    return (
      <div ref={wrapperRef} style={richSelectWrapperStyle} onKeyDown={selectState.handleKeyDown} tabIndex={0}>
        <div style={selectDisplayStyle}>
          <span>{selectState.getDisplayText(value)}</span>
          <span style={selectChevronStyle}>&#9662;</span>
        </div>
        {usePortal ? createPortal(dropdownContent, document.body) : dropdownContent}
      </div>
    );
  }

  // Date editor — native browser picker or plain text input (Excel-style)
  if (editorType === 'date') {
    const placeholder = getDateInputPlaceholder(dateFormat);
    if (dateEditorType === 'native') {
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
          placeholder={placeholder}
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
