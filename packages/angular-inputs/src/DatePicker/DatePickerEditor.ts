/**
 * DatePickerEditorComponent  -  Premium calendar-based date picker for OGrid (Angular).
 *
 * Usage:
 *   import { DatePickerEditorComponent } from '@alaarab/ogrid-angular-inputs';
 *
 *   // In your column definitions:
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: DatePickerEditorComponent,
 *     cellEditorPopup: true,
 *   }];
 *
 * Implements ICellEditorProps<T> via @Input() decorators  -  works with cellEditorPopup: true.
 */
import { Component, Input, signal, computed, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import type { IColumnDef, CellEditorParams } from '@alaarab/ogrid-core';
import { getCalendarGrid, formatDate, parseDate, DAY_NAMES, MONTH_NAMES } from '@alaarab/ogrid-inputs';

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
  'width': '280px',
  'user-select': 'none',
};

const headerStyleObj: Record<string, string> = {
  'display': 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  'margin-bottom': '8px',
};

const headerBtnStyleObj: Record<string, string> = {
  'background': 'none',
  'border': 'none',
  'cursor': 'pointer',
  'padding': '4px 8px',
  'border-radius': '4px',
  'font-size': '14px',
  'color': 'inherit',
  'line-height': '1',
};

const headerTitleStyleObj: Record<string, string> = {
  'font-weight': '600',
  'font-size': '14px',
};

const gridStyleObj: Record<string, string> = {
  'display': 'grid',
  'grid-template-columns': 'repeat(7, 1fr)',
  'gap': '1px',
  'text-align': 'center',
};

const dayHeaderStyleObj: Record<string, string> = {
  'padding': '4px 0',
  'font-size': '11px',
  'font-weight': '600',
  'color': 'var(--ogrid-muted, #888)',
};

const baseCellStyleObj: Record<string, string> = {
  'padding': '6px 0',
  'border-radius': '4px',
  'cursor': 'pointer',
  'font-size': '13px',
  'line-height': '1',
  'border': 'none',
  'background': 'none',
  'color': 'inherit',
};

const footerStyleObj: Record<string, string> = {
  'display': 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-top': '8px',
  'padding-top': '8px',
  'border-top': '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const footerBtnStyleObj: Record<string, string> = {
  'background': 'none',
  'border': 'none',
  'cursor': 'pointer',
  'padding': '4px 8px',
  'border-radius': '4px',
  'font-size': '12px',
  'color': 'var(--ogrid-accent, #0078d4)',
  'font-weight': '500',
};

const inputRowStyleObj: Record<string, string> = {
  'display': 'flex',
  'gap': '6px',
  'margin-bottom': '8px',
};

const inputStyleObj: Record<string, string> = {
  'flex': '1',
  'padding': '4px 8px',
  'border': '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  'border-radius': '4px',
  'font-size': '13px',
  'outline': 'none',
  'background': 'var(--ogrid-bg, #fff)',
  'color': 'inherit',
};

// Helper to convert a Record<string,string> into an inline style string
function toStyleString(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');
}

@Component({
  selector: 'ogrid-date-picker-editor',
  standalone: true,
  template: `
    <div [style]="rootStyle" (mousedown)="$event.stopPropagation()">
      <!-- Input row -->
      <div [style]="inputRowStyle">
        <input
          #inputEl
          type="text"
          [value]="inputText()"
          (input)="handleInputChange($event)"
          (keydown)="handleInputKeyDown($event)"
          placeholder="YYYY-MM-DD"
          [style]="inputStyle"
        />
      </div>

      <!-- Month/year header -->
      <div [style]="headerStyle">
        <button type="button" [style]="headerBtnStyle" (click)="prevMonth()" aria-label="Previous month">&#8249;</button>
        <span [style]="headerTitleStyle">{{ monthNames[viewMonth()] }} {{ viewYear() }}</span>
        <button type="button" [style]="headerBtnStyle" (click)="nextMonth()" aria-label="Next month">&#8250;</button>
      </div>

      <!-- Calendar grid -->
      <div [style]="gridStyle">
        @for (d of dayNames; track d) {
          <div [style]="dayHeaderStyle">{{ d }}</div>
        }
        @for (day of flatGrid(); track getKey(day)) {
          <button
            type="button"
            [style]="getCellStyle(day)"
            (click)="selectDay(day.year, day.month, day.date)"
            (mouseenter)="hoveredCell.set(getKey(day))"
            (mouseleave)="hoveredCell.set(null)"
            [tabIndex]="-1"
          >{{ day.date }}</button>
        }
      </div>

      <!-- Footer -->
      <div [style]="footerStyle">
        <button type="button" [style]="footerBtnStyle" (click)="handleToday()">Today</button>
        <button type="button" [style]="footerBtnStyle" (click)="handleClear()">Clear</button>
      </div>
    </div>
  `,
})
export class DatePickerEditorComponent {
  @Input() value: unknown;
  @Input() onValueChange!: (value: unknown) => void;
  @Input() onCommit!: () => void;
  @Input() onCancel!: () => void;
  @Input() item: unknown;
  @Input() column!: IColumnDef;
  @Input() cellEditorParams?: CellEditorParams;

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  readonly dayNames = DAY_NAMES;
  readonly monthNames = MONTH_NAMES;

  // ── Signals ──

  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth());
  selectedDate = signal('');
  inputText = signal('');
  hoveredCell = signal<string | null>(null);

  // ── Computed ──

  grid = computed(() => getCalendarGrid(this.viewYear(), this.viewMonth()));
  flatGrid = computed(() => this.grid().flat());

  // ── Style strings (pre-computed once for template binding) ──

  readonly rootStyle = toStyleString(rootStyleObj);
  readonly headerStyle = toStyleString(headerStyleObj);
  readonly headerBtnStyle = toStyleString(headerBtnStyleObj);
  readonly headerTitleStyle = toStyleString(headerTitleStyleObj);
  readonly gridStyle = toStyleString(gridStyleObj);
  readonly dayHeaderStyle = toStyleString(dayHeaderStyleObj);
  readonly footerStyle = toStyleString(footerStyleObj);
  readonly footerBtnStyle = toStyleString(footerBtnStyleObj);
  readonly inputRowStyle = toStyleString(inputRowStyleObj);
  readonly inputStyle = toStyleString(inputStyleObj);

  constructor() {
    afterNextRender(() => {
      // Parse initial value and set state
      if (this.value != null) {
        const parsed = parseDate(String(this.value));
        if (parsed) {
          this.viewYear.set(parsed.year);
          this.viewMonth.set(parsed.month);
          const formatted = formatDate(parsed.year, parsed.month, parsed.date);
          this.selectedDate.set(formatted);
          this.inputText.set(formatted);
        }
      }
      // Focus and select input
      const input = this.inputEl?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  // ── Helpers ──

  getKey(day: { year: number; month: number; date: number }): string {
    return formatDate(day.year, day.month, day.date);
  }

  getCellStyle(day: { year: number; month: number; date: number; isCurrentMonth: boolean; isToday: boolean }): string {
    const key = this.getKey(day);
    const isSelected = key === this.selectedDate();
    const isHovered = key === this.hoveredCell();

    const style: Record<string, string> = { ...baseCellStyleObj };

    if (!day.isCurrentMonth) {
      style['color'] = 'var(--ogrid-muted, #ccc)';
    }
    if (day.isToday && !isSelected) {
      style['font-weight'] = '700';
      style['color'] = 'var(--ogrid-accent, #0078d4)';
    }
    if (isSelected) {
      style['background'] = 'var(--ogrid-accent, #0078d4)';
      style['color'] = '#fff';
      style['font-weight'] = '600';
    } else if (isHovered) {
      style['background'] = 'var(--ogrid-bg-hover, #f0f0f0)';
    }

    return toStyleString(style);
  }

  // ── Navigation ──

  prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  // ── Date Selection ──

  selectDay(year: number, month: number, date: number): void {
    const formatted = formatDate(year, month, date);
    this.selectedDate.set(formatted);
    this.inputText.set(formatted);
    this.onValueChange(formatted);
    // Auto-commit on date selection (matches React behavior)
    setTimeout(() => this.onCommit(), 0);
  }

  // ── Input Handling ──

  handleInputChange(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.inputText.set(text);
    const parsed = parseDate(text);
    if (parsed) {
      this.selectedDate.set(formatDate(parsed.year, parsed.month, parsed.date));
      this.viewYear.set(parsed.year);
      this.viewMonth.set(parsed.month);
      this.onValueChange(text);
    }
  }

  handleInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.onValueChange(this.inputText());
      this.onCommit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.onCancel();
    }
  }

  // ── Footer Actions ──

  handleToday(): void {
    const t = new Date();
    this.selectDay(t.getFullYear(), t.getMonth(), t.getDate());
  }

  handleClear(): void {
    this.selectedDate.set('');
    this.inputText.set('');
    this.onValueChange('');
    this.onCommit();
  }
}
