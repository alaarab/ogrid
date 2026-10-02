/**
 * FormulaBar  -  Headless Excel-style formula bar component.
 *
 * Layout: [Name Box] [fx] [Formula Input]
 *
 * Uses --ogrid-* CSS variables for theming.
 */

import * as React from 'react';
import { useRef, useEffect } from 'react';
import { FORMULA_BAR_STYLES, handleFormulaBarKeyDown } from '@alaarab/ogrid-core/formula';

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
  /** External ref for the input element (for cursor position tracking). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function FormulaBar({
  cellRef,
  formulaText,
  isEditing,
  onInputChange,
  onCommit,
  onCancel,
  startEditing,
  inputRef: externalInputRef,
}: FormulaBarProps): React.ReactElement {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, inputRef]);

  return (
    <div style={FORMULA_BAR_STYLES.bar as React.CSSProperties} role="toolbar" aria-label="Formula bar">
      <output style={FORMULA_BAR_STYLES.nameBox as React.CSSProperties} aria-live="off" aria-label="Active cell reference">
        {cellRef ?? '\u2014'}
      </output>
      <div style={FORMULA_BAR_STYLES.fxLabel as React.CSSProperties} aria-hidden="true">fx</div>
      <input
        ref={inputRef}
        type="text"
        style={FORMULA_BAR_STYLES.input as React.CSSProperties}
        value={formulaText}
        readOnly={!isEditing}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (isEditing) {
            handleFormulaBarKeyDown(e.key, () => e.preventDefault(), onCommit, onCancel);
          } else if (e.key === 'F2' || e.key === 'Enter') {
            // Keyboard users enter edit mode the way a click does.
            e.preventDefault();
            startEditing();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Typing a character starts editing with that character appended.
            e.preventDefault();
            startEditing();
            onInputChange(formulaText + e.key);
          }
        }}
        onClick={() => { if (!isEditing) startEditing(); }}
        onDoubleClick={() => { if (!isEditing) startEditing(); }}
        aria-label="Formula input"
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}
