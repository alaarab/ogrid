/**
 * FormulaBarComponent -- Standalone Angular formula bar component.
 *
 * Layout: [Name Box] [fx] [Formula Input]
 *
 * Uses --ogrid-* CSS variables for theming.
 * Port of React's FormulaBar component.
 */

import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  input,
  output,
  viewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { handleFormulaBarKeyDown } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-formula-bar',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .ogrid-formula-bar {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
      background: var(--ogrid-bg, #fff);
      min-height: 28px;
      font-size: 13px;
    }
    .ogrid-formula-bar__name-box {
      font-family: monospace;
      font-size: 12px;
      font-weight: 500;
      padding: 2px 8px;
      border-right: 1px solid var(--ogrid-border, #e0e0e0);
      background: var(--ogrid-bg, #fff);
      color: var(--ogrid-fg, #242424);
      min-width: 52px;
      text-align: center;
      line-height: 24px;
      user-select: none;
      white-space: nowrap;
    }
    .ogrid-formula-bar__fx {
      padding: 2px 8px;
      font-style: italic;
      font-weight: 600;
      color: var(--ogrid-muted-fg, #888);
      user-select: none;
      border-right: 1px solid var(--ogrid-border, #e0e0e0);
      line-height: 24px;
      font-size: 12px;
    }
    .ogrid-formula-bar__input {
      flex: 1;
      border: none;
      outline: none;
      padding: 2px 8px;
      font-family: monospace;
      font-size: 12px;
      line-height: 24px;
      background: transparent;
      color: var(--ogrid-fg, #242424);
      min-width: 0;
    }
  `],
  template: `
    <div class="ogrid-formula-bar" role="toolbar" aria-label="Formula bar">
      <div class="ogrid-formula-bar__name-box" aria-label="Active cell reference">
        {{ cellRef() ?? '\u2014' }}
      </div>
      <div class="ogrid-formula-bar__fx" aria-hidden="true">fx</div>
      <input
        #formulaInput
        type="text"
        class="ogrid-formula-bar__input"
        [value]="formulaText()"
        [readOnly]="!isEditing()"
        (input)="onInput($event)"
        (keydown)="onKeyDown($event)"
        (click)="onClick()"
        (dblclick)="onClick()"
        aria-label="Formula input"
        [attr.spellcheck]="false"
        autocomplete="off"
      />
    </div>
  `,
})
export class FormulaBarComponent {
  /** Active cell reference (e.g. "A1"). */
  readonly cellRef = input<string | null>(null);

  /** Text displayed/edited in the formula input. */
  readonly formulaText = input<string>('');

  /** Whether the input is in editing mode. */
  readonly isEditing = input<boolean>(false);

  /** Called when the user changes the input text. */
  readonly inputChange = output<string>();

  /** Commit the formula bar value. */
  readonly commit = output<void>();

  /** Cancel editing. */
  readonly cancel = output<void>();

  /** Start editing the formula bar. */
  readonly startEditing = output<void>();

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('formulaInput');

  constructor() {
    // Focus input when entering edit mode
    effect(() => {
      if (this.isEditing()) {
        const el = this.inputEl()?.nativeElement;
        if (el) el.focus();
      }
    });
  }

  onInput(event: Event): void {
    this.inputChange.emit((event.target as HTMLInputElement).value);
  }

  onKeyDown(event: KeyboardEvent): void {
    handleFormulaBarKeyDown(
      event.key,
      () => event.preventDefault(),
      () => this.commit.emit(),
      () => this.cancel.emit(),
    );
  }

  onClick(): void {
    if (!this.isEditing()) {
      this.startEditing.emit();
    }
  }
}
