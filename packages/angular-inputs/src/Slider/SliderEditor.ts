/**
 * SliderEditorComponent — Premium range slider cell editor for OGrid (Angular).
 *
 * Usage:
 *   import { SliderEditorComponent } from '@alaarab/ogrid-angular-inputs';
 *
 *   // In your column definitions:
 *   const columns = [{
 *     columnId: 'volume',
 *     cellEditor: SliderEditorComponent,
 *     cellEditorPopup: true,
 *     cellEditorParams: { min: 0, max: 100, step: 1 },
 *   }];
 *
 * Implements ICellEditorProps<T> via @Input() decorators — works with cellEditorPopup: true.
 */
import { Component, Input, signal, computed, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import type { IColumnDef, CellEditorParams } from '@alaarab/ogrid-core';
import {
  clampValue,
  snapToStep,
  getPercentage,
  getValueFromOffset,
  DEFAULT_MIN,
  DEFAULT_MAX,
  DEFAULT_STEP,
} from '@alaarab/ogrid-inputs';

// ── Styles (inline objects to avoid CSS file dependency — keeps package sideEffects: false) ──

const rootStyleObj: Record<string, string> = {
  'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'font-size': '13px',
  'background': 'var(--ogrid-bg, #fff)',
  'color': 'var(--ogrid-fg, #242424)',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  'border-radius': '8px',
  'box-shadow': 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  'padding': '12px',
  'user-select': 'none',
  'width': '240px',
};

const trackWrapperStyleObj: Record<string, string> = {
  'position': 'relative',
  'height': '20px',
  'display': 'flex',
  'align-items': 'center',
  'cursor': 'pointer',
  'margin': '8px 0',
};

const trackStyleObj: Record<string, string> = {
  'position': 'absolute',
  'left': '0',
  'right': '0',
  'height': '4px',
  'background': 'var(--ogrid-border, rgba(0,0,0,0.15))',
  'border-radius': '2px',
  'overflow': 'hidden',
};

const thumbStyleObj: Record<string, string> = {
  'position': 'absolute',
  'width': '16px',
  'height': '16px',
  'border-radius': '50%',
  'background': 'var(--ogrid-accent, #0078d4)',
  'box-shadow': '0 1px 4px rgba(0,0,0,0.25)',
  'transform': 'translateX(-50%)',
  'cursor': 'grab',
  'top': '50%',
  'margin-top': '-8px',
  'z-index': '1',
};

const valueLabelStyleObj: Record<string, string> = {
  'display': 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-bottom': '4px',
};

const minMaxLabelStyleObj: Record<string, string> = {
  'display': 'flex',
  'justify-content': 'space-between',
  'font-size': '11px',
  'color': 'var(--ogrid-muted, #888)',
  'margin-top': '2px',
};

const numberInputStyleObj: Record<string, string> = {
  'width': '64px',
  'padding': '3px 6px',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  'border-radius': '4px',
  'font-size': '13px',
  'text-align': 'right',
  'outline': 'none',
  'background': 'var(--ogrid-bg, #fff)',
  'color': 'inherit',
};

const currentValueLabelStyleObj: Record<string, string> = {
  'font-size': '13px',
  'font-weight': '500',
};

// Helper to convert a Record<string,string> into an inline style string
function toStyleString(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');
}

@Component({
  selector: 'ogrid-slider-editor',
  standalone: true,
  template: `
    <div [style]="rootStyle" (mousedown)="$event.stopPropagation()">
      <!-- Value display + number input -->
      <div [style]="valueLabelStyle">
        <span [style]="currentValueLabelStyle">Value</span>
        <input
          #numberInput
          type="number"
          [value]="currentValue()"
          [min]="minVal()"
          [max]="maxVal()"
          [step]="stepVal()"
          (input)="handleNumberInput($event)"
          (keydown)="handleKeyDown($event)"
          [style]="numberInputStyle"
        />
      </div>

      <!-- Slider track + thumb -->
      <div
        #trackEl
        [style]="trackWrapperStyle"
        (mousedown)="handleTrackMouseDown($event)"
      >
        <div [style]="trackStyle">
          <div [style]="fillStyle()"></div>
        </div>
        <div [style]="thumbStyle()"></div>
      </div>

      <!-- Min/max labels -->
      <div [style]="minMaxLabelStyle">
        <span>{{ minVal() }}</span>
        <span>{{ maxVal() }}</span>
      </div>
    </div>
  `,
})
export class SliderEditorComponent {
  @Input() value: unknown;
  @Input() onValueChange!: (value: unknown) => void;
  @Input() onCommit!: () => void;
  @Input() onCancel!: () => void;
  @Input() item: unknown;
  @Input() column!: IColumnDef;
  @Input() cellEditorParams?: CellEditorParams;

  @ViewChild('trackEl') trackEl?: ElementRef<HTMLDivElement>;
  @ViewChild('numberInput') numberInputEl?: ElementRef<HTMLInputElement>;

  // ── Signals ──

  currentValue = signal(0);
  isDragging = signal(false);

  // ── Computed ──

  minVal = computed<number>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    const v = params?.['min'];
    return typeof v === 'number' ? v : DEFAULT_MIN;
  });

  maxVal = computed<number>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    const v = params?.['max'];
    return typeof v === 'number' ? v : DEFAULT_MAX;
  });

  stepVal = computed<number>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    const v = params?.['step'];
    return typeof v === 'number' && v > 0 ? v : DEFAULT_STEP;
  });

  percentage = computed<number>(() =>
    getPercentage(this.currentValue(), this.minVal(), this.maxVal())
  );

  // ── Style strings (pre-computed once for template binding) ──

  readonly rootStyle = toStyleString(rootStyleObj);
  readonly trackWrapperStyle = toStyleString(trackWrapperStyleObj);
  readonly trackStyle = toStyleString(trackStyleObj);
  readonly valueLabelStyle = toStyleString(valueLabelStyleObj);
  readonly minMaxLabelStyle = toStyleString(minMaxLabelStyleObj);
  readonly numberInputStyle = toStyleString(numberInputStyleObj);
  readonly currentValueLabelStyle = toStyleString(currentValueLabelStyleObj);

  // ── Dynamic styles (depend on signals) ──

  fillStyle(): string {
    return toStyleString({
      'height': '100%',
      'width': `${this.percentage()}%`,
      'background': 'var(--ogrid-accent, #0078d4)',
      'border-radius': '2px',
    });
  }

  thumbStyle(): string {
    return toStyleString({
      ...thumbStyleObj,
      'left': `${this.percentage()}%`,
      'cursor': this.isDragging() ? 'grabbing' : 'grab',
    });
  }

  // ── Drag state (module-level refs to avoid memory leaks) ──

  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;

  constructor() {
    afterNextRender(() => {
      // Parse initial value
      if (this.value != null) {
        const num = Number(this.value);
        if (!isNaN(num)) {
          this.currentValue.set(clampValue(snapToStep(num, this.minVal(), this.stepVal()), this.minVal(), this.maxVal()));
        } else {
          this.currentValue.set(this.minVal());
        }
      } else {
        this.currentValue.set(this.minVal());
      }
      // Focus the number input
      this.numberInputEl?.nativeElement.focus();
    });
  }

  // ── Helpers ──

  private getValueFromEvent(event: MouseEvent): number {
    const track = this.trackEl?.nativeElement;
    if (!track) return this.currentValue();
    const rect = track.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    return getValueFromOffset(offsetX, rect.width, this.minVal(), this.maxVal(), this.stepVal());
  }

  // ── Drag interaction ──

  handleTrackMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const val = this.getValueFromEvent(event);
    this.currentValue.set(val);
    this.onValueChange(val);
    this.isDragging.set(true);

    this.boundMouseMove = (e: MouseEvent) => {
      const v = this.getValueFromEvent(e);
      this.currentValue.set(v);
      this.onValueChange(v);
    };

    this.boundMouseUp = () => {
      this.isDragging.set(false);
      if (this.boundMouseMove) {
        document.removeEventListener('mousemove', this.boundMouseMove);
        this.boundMouseMove = null;
      }
      if (this.boundMouseUp) {
        document.removeEventListener('mouseup', this.boundMouseUp);
        this.boundMouseUp = null;
      }
    };

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  // ── Number input ──

  handleNumberInput(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    if (!isNaN(raw)) {
      const val = clampValue(snapToStep(raw, this.minVal(), this.stepVal()), this.minVal(), this.maxVal());
      this.currentValue.set(val);
      this.onValueChange(val);
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.onValueChange(this.currentValue());
      this.onCommit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.onCancel();
    }
  }
}
