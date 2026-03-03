/**
 * ColorPickerEditorComponent  -  Premium color swatch grid cell editor for OGrid (Angular).
 *
 * Usage:
 *   import { ColorPickerEditorComponent } from '@alaarab/ogrid-angular-inputs';
 *
 *   // In your column definitions:
 *   const columns = [{
 *     columnId: 'color',
 *     cellEditor: ColorPickerEditorComponent,
 *     cellEditorPopup: true,
 *     cellEditorParams: { allowCustom: true },
 *   }];
 *
 * Implements ICellEditorProps<T> via @Input() decorators  -  works with cellEditorPopup: true.
 */
import { Component, Input, signal, computed, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import type { IColumnDef, CellEditorParams } from '@alaarab/ogrid-core';
import { DEFAULT_COLOR_PALETTE, isValidHex, normalizeHex, isLightColor } from '@alaarab/ogrid-inputs';

// ── Styles (inline objects to avoid CSS file dependency  -  keeps package sideEffects: false) ──

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
  'width': '196px',
};

const swatchGridStyleObj: Record<string, string> = {
  'display': 'grid',
  'grid-template-columns': 'repeat(5, 1fr)',
  'gap': '4px',
  'margin-bottom': '10px',
};

const baseSwatchStyleObj: Record<string, string> = {
  'width': '32px',
  'height': '32px',
  'border-radius': '4px',
  'border': '2px solid transparent',
  'cursor': 'pointer',
  'display': 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'font-size': '14px',
  'font-weight': '700',
  'transition': 'border-color 0.1s',
};

const hexRowStyleObj: Record<string, string> = {
  'display': 'flex',
  'gap': '6px',
  'align-items': 'center',
  'margin-bottom': '8px',
};

const hexPreviewStyleObj: Record<string, string> = {
  'width': '28px',
  'height': '28px',
  'border-radius': '4px',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  'flex-shrink': '0',
};

const hexInputStyleObj: Record<string, string> = {
  'flex': '1',
  'padding': '4px 8px',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  'border-radius': '4px',
  'font-size': '12px',
  'font-family': 'monospace',
  'outline': 'none',
  'background': 'var(--ogrid-bg, #fff)',
  'color': 'inherit',
};

const footerStyleObj: Record<string, string> = {
  'display': 'flex',
  'justify-content': 'flex-end',
  'padding-top': '8px',
  'border-top': '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
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
  selector: 'ogrid-color-picker-editor',
  standalone: true,
  template: `
    <div [style]="rootStyle" (mousedown)="$event.stopPropagation()">
      <!-- Color swatch grid -->
      <div [style]="swatchGridStyle">
        @for (color of palette(); track color) {
          <button
            type="button"
            [style]="getSwatchStyle(color)"
            (click)="selectColor(color)"
            (mouseenter)="hoverColor.set(color)"
            (mouseleave)="hoverColor.set(null)"
            [attr.aria-label]="color"
            tabindex="-1"
          >@if (isSelected(color)) { ✓ }</button>
        }
      </div>

      <!-- Custom hex input (shown when allowCustom is true) -->
      @if (allowCustom()) {
        <div [style]="hexRowStyle">
          <div [style]="getHexPreviewStyle()"></div>
          <input
            #hexInput
            type="text"
            [value]="hexInputText()"
            (input)="handleHexInput($event)"
            (keydown)="handleHexKeyDown($event)"
            placeholder="#RRGGBB"
            maxlength="7"
            [style]="hexInputStyle"
          />
        </div>
      }

      <!-- Footer -->
      <div [style]="footerStyle">
        <button type="button" [style]="clearBtnStyle" (click)="handleClear()">Clear</button>
      </div>
    </div>
  `,
})
export class ColorPickerEditorComponent {
  @Input() value: unknown;
  @Input() onValueChange!: (value: unknown) => void;
  @Input() onCommit!: () => void;
  @Input() onCancel!: () => void;
  @Input() item: unknown;
  @Input() column!: IColumnDef;
  @Input() cellEditorParams?: CellEditorParams;

  @ViewChild('hexInput') hexInputEl?: ElementRef<HTMLInputElement>;

  // ── Signals ──

  selectedColor = signal<string | null>(null);
  hexInputText = signal('');
  hoverColor = signal<string | null>(null);

  // ── Computed ──

  palette = computed<readonly string[]>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    const colors = params?.['colors'];
    if (Array.isArray(colors) && colors.length > 0) {
      return colors as string[];
    }
    return DEFAULT_COLOR_PALETTE;
  });

  allowCustom = computed<boolean>(() => {
    const params = this.cellEditorParams as Record<string, unknown> | undefined;
    return params?.['allowCustom'] !== false;
  });

  // ── Style strings (pre-computed once for template binding) ──

  readonly rootStyle = toStyleString(rootStyleObj);
  readonly swatchGridStyle = toStyleString(swatchGridStyleObj);
  readonly hexRowStyle = toStyleString(hexRowStyleObj);
  readonly hexInputStyle = toStyleString(hexInputStyleObj);
  readonly footerStyle = toStyleString(footerStyleObj);
  readonly clearBtnStyle = toStyleString(clearBtnStyleObj);

  constructor() {
    afterNextRender(() => {
      // Parse initial value
      if (this.value != null && typeof this.value === 'string' && this.value.length > 0) {
        const normalized = normalizeHex(this.value);
        if (normalized) {
          this.selectedColor.set(normalized);
          this.hexInputText.set(normalized);
        }
      }
      // Focus hex input if custom is allowed
      if (this.allowCustom()) {
        this.hexInputEl?.nativeElement.focus();
      }
    });
  }

  // ── Helpers ──

  isSelected(color: string): boolean {
    return this.selectedColor() === color;
  }

  getSwatchStyle(color: string): string {
    const style: Record<string, string> = {
      ...baseSwatchStyleObj,
      'background': color,
    };

    const isHovered = this.hoverColor() === color;
    const isSelected = this.isSelected(color);

    if (isSelected) {
      style['border-color'] = 'var(--ogrid-accent, #0078d4)';
      style['color'] = isLightColor(color) ? '#000' : '#fff';
    } else if (isHovered) {
      style['border-color'] = 'var(--ogrid-fg, #242424)';
      style['color'] = 'transparent';
    } else {
      style['border-color'] = 'rgba(0,0,0,0.1)';
      style['color'] = 'transparent';
    }

    return toStyleString(style);
  }

  getHexPreviewStyle(): string {
    const color = this.selectedColor();
    const style: Record<string, string> = { ...hexPreviewStyleObj };
    if (color) {
      style['background'] = color;
    } else {
      style['background'] = 'transparent';
    }
    return toStyleString(style);
  }

  // ── Interaction ──

  selectColor(color: string): void {
    this.selectedColor.set(color);
    this.hexInputText.set(color);
    this.onValueChange(color);
    // Auto-commit on swatch selection
    setTimeout(() => this.onCommit(), 0);
  }

  handleHexInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.hexInputText.set(text);
    if (isValidHex(text)) {
      const normalized = normalizeHex(text);
      if (normalized) {
        this.selectedColor.set(normalized);
        this.onValueChange(normalized);
      }
    }
  }

  handleHexKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const normalized = normalizeHex(this.hexInputText());
      if (normalized) {
        this.selectedColor.set(normalized);
        this.onValueChange(normalized);
      }
      this.onCommit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.onCancel();
    }
  }

  handleClear(): void {
    this.selectedColor.set(null);
    this.hexInputText.set('');
    this.onValueChange(null);
    this.onCommit();
  }
}
