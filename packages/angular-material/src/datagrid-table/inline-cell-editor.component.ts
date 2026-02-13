import { Component, Input, Output, EventEmitter, signal, effect, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IColumnDef } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-mat-inline-cell-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (editorType) {
      @case ('text') {
        <input
          #inputEl
          type="text"
          [value]="localValue()"
          (input)="localValue.set($any($event.target).value)"
          (keydown)="onTextKeyDown($event)"
          (blur)="onTextBlur()"
          [style]="getInputStyle()"
        />
      }
      @case ('select') {
        <div style="width:100%;height:100%;display:flex;align-items:center;padding:6px 10px;box-sizing:border-box;overflow:hidden;min-width:0">
          <select
            #inputEl
            [value]="localValue()"
            (change)="commitValue($any($event.target).value)"
            (keydown)="onSelectKeyDown($event)"
            style="width:100%;border:none;outline:none;background:transparent;font:inherit;cursor:pointer;color:var(--ogrid-fg, #242424)"
          >
            @for (opt of selectOptions(); track opt) {
              <option [value]="opt">{{ opt }}</option>
            }
          </select>
        </div>
      }
      @case ('checkbox') {
        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%">
          <input
            type="checkbox"
            [checked]="!!localValue()"
            (change)="commitValue($any($event.target).checked)"
            (keydown)="onCheckboxKeyDown($event)"
          />
        </div>
      }
      @case ('date') {
        <input
          #inputEl
          type="date"
          [value]="localValue()"
          (change)="commitValue($any($event.target).value)"
          (keydown)="onTextKeyDown($event)"
          (blur)="onTextBlur()"
          [style]="getInputStyle()"
        />
      }
      @default {
        <input
          #inputEl
          type="text"
          [value]="localValue()"
          (input)="localValue.set($any($event.target).value)"
          (keydown)="onTextKeyDown($event)"
          (blur)="onTextBlur()"
          [style]="getInputStyle()"
        />
      }
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
})
export class InlineCellEditorComponent<T = unknown> implements AfterViewInit {
  @Input({ required: true }) value!: unknown;
  @Input({ required: true }) item!: T;
  @Input({ required: true }) column!: IColumnDef<T>;
  @Input({ required: true }) rowIndex!: number;
  @Input({ required: true }) editorType!: 'text' | 'select' | 'checkbox' | 'date' | 'richSelect';
  @Output() commit = new EventEmitter<unknown>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement | HTMLSelectElement>;

  readonly localValue = signal<unknown>('');

  readonly selectOptions = signal<unknown[]>([]);

  private _initialized = false;

  ngOnInit(): void {
    this._initialized = true;
    this.syncFromInputs();
  }

  ngOnChanges(): void {
    if (this._initialized) {
      this.syncFromInputs();
    }
  }

  private syncFromInputs(): void {
    const v = this.value;
    this.localValue.set(v != null ? String(v) : '');

    const col = this.column;
    if (col?.cellEditorParams?.values) {
      this.selectOptions.set(col.cellEditorParams.values as unknown[]);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const el = this.inputEl?.nativeElement;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement && el.type === 'text') {
          el.select();
        }
      }
    });
  }

  commitValue(value: unknown): void {
    this.commit.emit(value);
  }

  onTextKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitValue(this.localValue());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel.emit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.commitValue(this.localValue());
    }
  }

  onSelectKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel.emit();
    }
  }

  onCheckboxKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel.emit();
    }
  }

  onTextBlur(): void {
    this.commitValue(this.localValue());
  }

  getInputStyle(): string {
    const baseStyle = 'width:100%;box-sizing:border-box;padding:6px 10px;border:2px solid var(--ogrid-selection, #217346);border-radius:2px;outline:none;font:inherit;background:var(--ogrid-bg, #fff);color:var(--ogrid-fg, #242424);';
    const col = this.column;
    if (col.type === 'numeric') {
      return baseStyle + 'text-align:right;';
    }
    return baseStyle;
  }
}
