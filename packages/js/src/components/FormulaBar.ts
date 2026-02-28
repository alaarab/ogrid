/**
 * FormulaBar — DOM-based Excel-style formula bar for the vanilla JS grid.
 *
 * Layout: [Name Box] [fx] [Formula Input]
 *
 * Uses --ogrid-* CSS variables for theming. Matches the React FormulaBar
 * component behavior exactly.
 */

import { FORMULA_BAR_CSS, handleFormulaBarKeyDown } from '@alaarab/ogrid-core/formula';

export interface FormulaBarCallbacks {
  /** Called when the user presses Enter to commit the formula/value. */
  onCommit: () => void;
  /** Called when the user presses Escape to cancel editing. */
  onCancel: () => void;
  /** Called when the input text changes. */
  onInputChange: (text: string) => void;
  /** Called when the user clicks the input to start editing. */
  onStartEditing: () => void;
}

export class FormulaBar {
  private el: HTMLElement | null = null;
  private nameBoxEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private isEditing = false;
  private callbacks: FormulaBarCallbacks;

  constructor(callbacks: FormulaBarCallbacks) {
    this.callbacks = callbacks;
  }

  /** Create the formula bar DOM and append it to the given container. */
  mount(container: HTMLElement): void {
    if (this.el) return;

    this.el = document.createElement('div');
    this.el.className = 'ogrid-formula-bar';
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Formula bar');
    this.el.style.cssText = FORMULA_BAR_CSS.bar;

    // Name box
    this.nameBoxEl = document.createElement('div');
    this.nameBoxEl.className = 'ogrid-formula-bar-name';
    this.nameBoxEl.setAttribute('aria-label', 'Active cell reference');
    this.nameBoxEl.style.cssText = FORMULA_BAR_CSS.nameBox;
    this.nameBoxEl.textContent = '\u2014';
    this.el.appendChild(this.nameBoxEl);

    // fx label
    const fxLabel = document.createElement('div');
    fxLabel.className = 'ogrid-formula-bar-fx';
    fxLabel.setAttribute('aria-hidden', 'true');
    fxLabel.style.cssText = FORMULA_BAR_CSS.fxLabel;
    fxLabel.textContent = 'fx';
    this.el.appendChild(fxLabel);

    // Formula input
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.className = 'ogrid-formula-bar-input';
    this.inputEl.setAttribute('aria-label', 'Formula input');
    this.inputEl.spellcheck = false;
    this.inputEl.autocomplete = 'off';
    this.inputEl.readOnly = true;
    this.inputEl.style.cssText = FORMULA_BAR_CSS.input;

    this.inputEl.addEventListener('keydown', this.handleKeyDown);
    this.inputEl.addEventListener('input', this.handleInput);
    this.inputEl.addEventListener('click', this.handleClick);
    this.inputEl.addEventListener('dblclick', this.handleClick);

    this.el.appendChild(this.inputEl);
    container.appendChild(this.el);
  }

  /** Update the formula bar display with the current active cell ref and formula text. */
  update(cellRef: string | null, formulaText: string): void {
    if (this.nameBoxEl) {
      this.nameBoxEl.textContent = cellRef ?? '\u2014';
    }
    if (this.inputEl) {
      this.inputEl.value = formulaText;
    }
  }

  /** Set editing state. When true, the input becomes editable and receives focus. */
  setEditing(editing: boolean): void {
    this.isEditing = editing;
    if (this.inputEl) {
      this.inputEl.readOnly = !editing;
      if (editing) {
        this.inputEl.focus();
      }
    }
  }

  /** Remove the formula bar from the DOM and clean up event listeners. */
  destroy(): void {
    if (this.inputEl) {
      this.inputEl.removeEventListener('keydown', this.handleKeyDown);
      this.inputEl.removeEventListener('input', this.handleInput);
      this.inputEl.removeEventListener('click', this.handleClick);
      this.inputEl.removeEventListener('dblclick', this.handleClick);
    }
    this.el?.remove();
    this.el = null;
    this.nameBoxEl = null;
    this.inputEl = null;
  }

  // --- Private event handlers (arrow functions for stable `this`) ---

  private handleKeyDown = (e: KeyboardEvent): void => {
    handleFormulaBarKeyDown(e.key, () => e.preventDefault(), this.callbacks.onCommit, this.callbacks.onCancel);
  };

  private handleInput = (): void => {
    if (this.inputEl) {
      this.callbacks.onInputChange(this.inputEl.value);
    }
  };

  private handleClick = (): void => {
    if (!this.isEditing) {
      this.callbacks.onStartEditing();
    }
  };
}
