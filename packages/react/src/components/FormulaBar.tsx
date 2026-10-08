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
import { cycleReferenceAtCaret } from '@alaarab/ogrid-core';
import { NameBox } from './NameBox';
import { useFormulaAssist } from '../hooks/useFormulaAssist';

export interface FormulaBarProps {
  /** Active cell reference (e.g. "A1"). */
  cellRef: string | null;
  /** Text displayed/edited in the formula input. */
  formulaText: string;
  /** Whether the input is in editing mode. */
  isEditing: boolean;
  /** Show the anchor formula in grey when a read-only spill child is active. */
  spillChild?: boolean;
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
  /**
   * Called after Enter commits or Escape cancels an edit, so the host can move
   * focus back to the grid's active cell. Not called when focus leaves the bar
   * any other way (a click elsewhere keeps its focus).
   */
  onReturnFocus?: () => void;
  /** Jump to a reference typed into the name box (see NameBox). Read-only without it. */
  onNameBoxNavigate?: (text: string) => boolean;
}

export function FormulaBar({
  cellRef,
  formulaText,
  isEditing,
  spillChild,
  onInputChange,
  onCommit,
  onCancel,
  startEditing,
  inputRef: externalInputRef,
  onReturnFocus,
  onNameBoxNavigate,
}: FormulaBarProps): React.ReactElement {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, inputRef]);

  // Function autocomplete + argument hints (active under a FormulaAssistContext).
  const assist = useFormulaAssist({ value: formulaText, onChange: onInputChange, getInput: () => inputRef.current, enabled: isEditing });

  return (
    <div style={FORMULA_BAR_STYLES.bar as React.CSSProperties} role="toolbar" aria-label="Formula bar">
      <NameBox
        cellRef={cellRef}
        onNavigate={onNameBoxNavigate}
        onCancel={onReturnFocus}
        style={FORMULA_BAR_STYLES.nameBox as React.CSSProperties}
      />
      <div style={FORMULA_BAR_STYLES.fxLabel as React.CSSProperties} aria-hidden="true">fx</div>
      <input
        ref={inputRef}
        type="text"
        style={{ ...FORMULA_BAR_STYLES.input as React.CSSProperties, ...(spillChild ? { color: 'var(--ogrid-muted-foreground, #808080)' } : {}) }}
        data-spill-child={spillChild ? '' : undefined}
        value={formulaText}
        readOnly={!isEditing}
        onChange={(e) => { if (!spillChild) onInputChange(e.target.value); }}
        {...assist.inputProps}
        onKeyDown={(e) => {
          if (spillChild) return;
          if (isEditing && assist.handleKeyDown(e)) return;
          if (isEditing && e.key === 'F4' && formulaText.startsWith('=')) {
            // F4 cycles the reference at the caret: A1 -> $A$1 -> A$1 -> $A1 (Excel).
            e.preventDefault();
            const input = e.currentTarget;
            const next = cycleReferenceAtCaret(formulaText, input.selectionStart ?? formulaText.length);
            if (next) {
              // Write the DOM first so React sees an unchanged value and keeps the caret.
              input.value = next.text;
              input.setSelectionRange(next.end, next.end);
              onInputChange(next.text);
            }
          } else if (isEditing) {
            handleFormulaBarKeyDown(e.key, () => e.preventDefault(), onCommit, onCancel);
            if (e.key === 'Enter' || e.key === 'Escape') onReturnFocus?.();
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
      {assist.popup}
    </div>
  );
}
