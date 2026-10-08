/**
 * Excel-style name box: shows the active cell reference and, when `onNavigate`
 * is given, takes a reference to jump to. Typing `B3`, `A1:C5`, `B:D`, `2:4`
 * or a defined name and pressing Enter selects it; Escape reverts.
 */
import * as React from 'react';

export interface NameBoxProps {
  /** Active cell reference (e.g. "B3"), or null when no cell is active. */
  cellRef: string | null;
  /**
   * Select what the user typed. Returns false when it isn't a reference the
   * grid can show (the text stays, marked invalid, for the user to fix).
   * Without it the name box is read-only.
   */
  onNavigate?: (text: string) => boolean;
  /** Called after Escape, so the host can return focus to the grid. */
  onCancel?: () => void;
  style?: React.CSSProperties;
}

const INPUT_RESET: React.CSSProperties = {
  boxSizing: 'border-box',
  width: 88,
  outline: 'none',
  userSelect: 'text',
  font: 'inherit',
  fontFamily: 'monospace',
};

export function NameBox({ cellRef, onNavigate, onCancel, style }: NameBoxProps): React.ReactElement {
  const [draft, setDraft] = React.useState<string | null>(null);
  const [invalid, setInvalid] = React.useState(false);
  const shown = cellRef ?? '';
  const readOnly = onNavigate == null;

  const reset = () => {
    setDraft(null);
    setInvalid(false);
  };

  return (
    <input
      type="text"
      style={{ border: 'none', ...style, ...INPUT_RESET }}
      aria-label="Active cell reference"
      aria-invalid={invalid || undefined}
      title={readOnly ? undefined : 'Name box: type a cell or range (A1, A1:C5) and press Enter'}
      placeholder={'—'}
      value={draft ?? shown}
      readOnly={readOnly}
      spellCheck={false}
      autoComplete="off"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={reset}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          const text = (draft ?? shown).trim();
          if (text !== '' && onNavigate(text)) {
            reset();
          } else {
            setInvalid(true);
            e.currentTarget.select();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          reset();
          onCancel?.();
        }
      }}
    />
  );
}
