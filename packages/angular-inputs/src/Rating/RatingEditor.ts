/**
 * RatingEditorComponent — Premium star rating cell editor for OGrid (Angular).
 *
 * Usage:
 *   import { RatingEditorComponent } from '@alaarab/ogrid-angular-inputs';
 *
 *   // In your column definitions:
 *   const columns = [{
 *     columnId: 'rating',
 *     cellEditor: RatingEditorComponent,
 *     cellEditorPopup: true,
 *     cellEditorParams: { maxStars: 5, allowHalf: false },
 *   }];
 *
 * Implements ICellEditorProps<T> via @Input() decorators — works with cellEditorPopup: true.
 */
import { Component, Input, signal, computed, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import type { IColumnDef, CellEditorParams } from '@alaarab/ogrid-core';
import { clampRating, getStarFill, getRatingFromPosition, DEFAULT_MAX_STARS } from '@alaarab/ogrid-inputs';

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
  'min-width': '180px',
};

const starsRowStyleObj: Record<string, string> = {
  'display': 'flex',
  'align-items': 'center',
  'gap': '4px',
  'margin-bottom': '8px',
};

const starBtnStyleObj: Record<string, string> = {
  'background': 'none',
  'border': 'none',
  'cursor': 'pointer',
  'padding': '2px',
  'font-size': '24px',
  'line-height': '1',
  'color': 'inherit',
  'display': 'flex',
  'align-items': 'center',
};

const footerStyleObj: Record<string, string> = {
  'display': 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-top': '4px',
  'padding-top': '8px',
  'border-top': '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const labelStyleObj: Record<string, string> = {
  'font-size': '12px',
  'color': 'var(--ogrid-muted, #888)',
};

const clearBtnStyleObj: Record<string, string> = {
  'background': 'none',
  'border': 'none',
  'cursor': 'pointer',
  'padding': '4px 8px',
  'border-radius': '4px',
  'font-size': '12px',
  'color': 'var(--ogrid-accent, #0078d4)',
  'font-weight': '500',
};

// Helper to convert a Record<string,string> into an inline style string
function toStyleString(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');
}

@Component({
  selector: 'ogrid-rating-editor',
  standalone: true,
  template: `
    <div [style]="rootStyle" (mousedown)="$event.stopPropagation()">
      <!-- Stars row -->
      <div [style]="starsRowStyle">
        @for (star of starIndices(); track star) {
          <button
            #starBtn
            type="button"
            [style]="getStarBtnStyle(star)"
            (click)="handleStarClick($event, star)"
            (mouseenter)="hoverRating.set(star + 1)"
            (mouseleave)="hoverRating.set(null)"
            [attr.aria-label]="'Rate ' + (star + 1) + ' of ' + maxStars()"
            tabindex="-1"
          >{{ getStarChar(star) }}</button>
        }
      </div>

      <!-- Footer: label + clear -->
      <div [style]="footerStyle">
        <span [style]="labelStyle">{{ ratingLabel() }}</span>
        <button type="button" [style]="clearBtnStyle" (click)="handleClear()">Clear</button>
      </div>
    </div>
  `,
})
export class RatingEditorComponent {
  @Input() value: unknown;
  @Input() onValueChange!: (value: unknown) => void;
  @Input() onCommit!: () => void;
  @Input() onCancel!: () => void;
  @Input() item: unknown;
  @Input() column!: IColumnDef;
  @Input() cellEditorParams?: CellEditorParams;

  @ViewChild('starBtn') starBtnRef?: ElementRef<HTMLButtonElement>;

  // ── Signals ──

  currentRating = signal(0);
  hoverRating = signal<number | null>(null);

  // ── Computed ──

  maxStars = computed<number>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    const m = params?.['maxStars'];
    return typeof m === 'number' && m > 0 ? m : DEFAULT_MAX_STARS;
  });

  allowHalf = computed<boolean>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    return params?.['allowHalf'] === true;
  });

  starIndices = computed<number[]>(() =>
    Array.from({ length: this.maxStars() }, (_, i) => i)
  );

  displayRating = computed<number>(() =>
    this.hoverRating() ?? this.currentRating()
  );

  ratingLabel = computed<string>(() => {
    const r = this.currentRating();
    if (r === 0) return 'No rating';
    return `${r} / ${this.maxStars()}`;
  });

  // ── Style strings (pre-computed once for template binding) ──

  readonly rootStyle = toStyleString(rootStyleObj);
  readonly starsRowStyle = toStyleString(starsRowStyleObj);
  readonly footerStyle = toStyleString(footerStyleObj);
  readonly labelStyle = toStyleString(labelStyleObj);
  readonly clearBtnStyle = toStyleString(clearBtnStyleObj);

  constructor() {
    afterNextRender(() => {
      // Parse initial value
      if (this.value != null) {
        const num = Number(this.value);
        if (!isNaN(num)) {
          this.currentRating.set(clampRating(num, this.maxStars()));
        }
      }
    });
  }

  // ── Helpers ──

  getStarChar(starIndex: number): string {
    const fill = getStarFill(starIndex, this.displayRating(), this.allowHalf());
    if (fill === 'full') return '★';
    if (fill === 'half') return '⯨';
    return '☆';
  }

  getStarBtnStyle(starIndex: number): string {
    const fill = getStarFill(starIndex, this.displayRating(), this.allowHalf());
    const style: Record<string, string> = { ...starBtnStyleObj };
    if (fill !== 'empty') {
      style['color'] = 'var(--ogrid-star-color, #f5a623)';
    } else {
      style['color'] = 'var(--ogrid-muted, #ccc)';
    }
    return toStyleString(style);
  }

  // ── Interaction ──

  handleStarClick(event: MouseEvent, starIndex: number): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const rating = getRatingFromPosition(starIndex, offsetX, rect.width, this.allowHalf());
    const clamped = clampRating(rating, this.maxStars());
    this.currentRating.set(clamped);
    this.onValueChange(clamped);
    // Auto-commit on star selection
    setTimeout(() => this.onCommit(), 0);
  }

  handleClear(): void {
    this.currentRating.set(0);
    this.hoverRating.set(null);
    this.onValueChange(null);
    this.onCommit();
  }
}
