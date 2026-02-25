/**
 * FormulaBar — Headless Excel-style formula bar component.
 *
 * Layout: [Name Box] [fx] [Formula Input]
 *
 * Uses --ogrid-* CSS variables for theming.
 */

import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';

export interface FormulaBarProps {
  /** Active cell reference (e.g. "A1"). */
  cellRef: string | null;
  /** Text displayed/edited in the formula input. */
  formulaText: string;
  /** Whether the input is in editing mode. */
  isEditing: boolean;
  /** Called when the user changes the input text. */
  onInputChange: (text: string) => void;
  /** Commit the formula bar value. */
  onCommit: () => void;
  /** Cancel editing. */
  onCancel: () => void;
  /** Start editing the formula bar. */
  startEditing: () => void;
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-bg, #fff)',
  minHeight: 28,
  fontSize: 13,
};

const nameBoxStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  fontWeight: 500,
  padding: '2px 8px',
  borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  minWidth: 52,
  textAlign: 'center',
  lineHeight: '24px',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const fxLabelStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontStyle: 'italic',
  fontWeight: 600,
  color: 'var(--ogrid-muted-fg, #888)',
  userSelect: 'none',
  borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
  lineHeight: '24px',
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  padding: '2px 8px',
  fontFamily: 'monospace',
  fontSize: 12,
  lineHeight: '24px',
  background: 'transparent',
  color: 'var(--ogrid-fg, #242424)',
  minWidth: 0,
};

export function FormulaBar({
  cellRef,
  formulaText,
  isEditing,
  onInputChange,
  onCommit,
  onCancel,
  startEditing,
}: FormulaBarProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [onCommit, onCancel]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e.target.value);
  }, [onInputChange]);

  const handleClick = useCallback(() => {
    if (!isEditing) startEditing();
  }, [isEditing, startEditing]);

  return (
    <div style={barStyle} role="toolbar" aria-label="Formula bar">
      <div style={nameBoxStyle} aria-label="Active cell reference">
        {cellRef ?? '\u2014'}
      </div>
      <div style={fxLabelStyle} aria-hidden="true">fx</div>
      <input
        ref={inputRef}
        type="text"
        style={inputStyle}
        value={formulaText}
        readOnly={!isEditing}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onDoubleClick={handleClick}
        aria-label="Formula input"
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}
