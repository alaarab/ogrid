import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BaseColumnChooserComponent } from '@alaarab/ogrid-angular';

/**
 * Column visibility chooser dropdown for Angular Radix (lightweight styling).
 * Standalone component with inline template and CSS variables for theming.
 */
@Component({
  selector: 'ogrid-column-chooser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ogrid-column-chooser">
      <button
        class="ogrid-column-chooser__trigger"
        (click)="toggle()"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="listbox"
      >
        ☰ Columns ({{ visibleCount() }} of {{ totalCount() }})
        <span class="ogrid-column-chooser__caret">{{ isOpen() ? '▲' : '▼' }}</span>
      </button>

      @if (isOpen()) {
        <div class="ogrid-column-chooser__dropdown" (click)="$event.stopPropagation()">
          <div class="ogrid-column-chooser__header">
            Select Columns ({{ visibleCount() }} of {{ totalCount() }})
          </div>

          <div class="ogrid-column-chooser__list">
            @for (col of columns; track col.columnId) {
              <label class="ogrid-column-chooser__item">
                <input
                  type="checkbox"
                  [checked]="visibleColumns.has(col.columnId)"
                  (change)="onCheckboxChange(col.columnId, $event)"
                />
                <span>{{ col.name }}</span>
              </label>
            }
          </div>

          <div class="ogrid-column-chooser__footer">
            <button class="ogrid-column-chooser__btn" (click)="onClearAll()">Clear All</button>
            <button class="ogrid-column-chooser__btn ogrid-column-chooser__btn--primary" (click)="selectAll()">Select All</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-flex; position: relative; }
    .ogrid-column-chooser { position: relative; }
    .ogrid-column-chooser__trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      text-transform: none;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .ogrid-column-chooser__trigger:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
      border-color: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-column-chooser__caret {
      font-size: 10px;
      opacity: 0.7;
    }
    .ogrid-column-chooser__dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 1000;
      min-width: 220px;
      margin-top: 4px;
      background: var(--ogrid-bg, #ffffff);
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .ogrid-column-chooser__header {
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ogrid-fg, #242424);
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-column-chooser__list {
      max-height: 320px;
      overflow-y: auto;
      padding: 4px 0;
    }
    .ogrid-column-chooser__item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      min-height: 32px;
      cursor: pointer;
      font-size: 14px;
      color: var(--ogrid-fg, #242424);
      transition: background 0.15s ease;
    }
    .ogrid-column-chooser__item:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    }
    .ogrid-column-chooser__item input[type="checkbox"] {
      cursor: pointer;
    }
    .ogrid-column-chooser__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-column-chooser__btn {
      padding: 6px 12px;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 13px;
      text-transform: none;
      transition: all 0.15s ease;
    }
    .ogrid-column-chooser__btn:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    }
    .ogrid-column-chooser__btn--primary {
      background: var(--ogrid-active-border, #0078d4);
      color: #ffffff;
      border-color: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-column-chooser__btn--primary:hover {
      opacity: 0.9;
    }
  `],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ColumnChooserComponent extends BaseColumnChooserComponent {
  onDocumentClick(event: MouseEvent): void {
    const el = event.target as HTMLElement;
    if (!el.closest('ogrid-column-chooser')) {
      this.isOpen.set(false);
    }
  }
}
