import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BaseColumnChooserComponent } from '@alaarab/ogrid-angular';

/**
 * Column visibility chooser dropdown using Angular Material styling.
 * Standalone component with inline template.
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
        &#9638; Column Visibility ({{ visibleCount() }} of {{ totalCount() }})
        <span class="ogrid-column-chooser__caret">{{ isOpen() ? '&#9650;' : '&#9660;' }}</span>
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
            <button class="ogrid-column-chooser__btn" (click)="clearAll()">Clear All</button>
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
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border: 1px solid rgba(0,0,0,0.23); border-radius: 4px;
      background: transparent; cursor: pointer; font-size: 14px; font-weight: 600;
      text-transform: none; white-space: nowrap;
    }
    .ogrid-column-chooser__caret { font-size: 10px; }
    .ogrid-column-chooser__dropdown {
      position: absolute; top: 100%; right: 0; z-index: 10;
      min-width: 220px; margin-top: 4px;
      background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .ogrid-column-chooser__header {
      padding: 8px 12px; font-size: 14px; font-weight: 600;
      border-bottom: 1px solid rgba(0,0,0,0.12); background: #fafafa;
    }
    .ogrid-column-chooser__list {
      max-height: 320px; overflow-y: auto; padding: 4px 0;
    }
    .ogrid-column-chooser__item {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 12px; min-height: 32px; cursor: pointer; font-size: 14px;
    }
    .ogrid-column-chooser__item:hover { background: rgba(0,0,0,0.04); }
    .ogrid-column-chooser__footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 8px 12px; border-top: 1px solid rgba(0,0,0,0.12); background: #fafafa;
    }
    .ogrid-column-chooser__btn {
      padding: 4px 12px; border: none; border-radius: 4px;
      background: transparent; cursor: pointer; font-size: 13px; text-transform: none;
    }
    .ogrid-column-chooser__btn:hover { background: rgba(0,0,0,0.04); }
    .ogrid-column-chooser__btn--primary {
      background: var(--mat-sys-primary, #1976d2); color: #fff;
    }
    .ogrid-column-chooser__btn--primary:hover {
      background: var(--mat-sys-primary, #1565c0);
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
