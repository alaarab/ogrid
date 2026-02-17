import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseColumnChooserComponent } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-primeng-column-chooser',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="position:relative;display:inline-block">
      <button
        type="button"
        class="p-button p-button-text p-button-sm"
        (click)="open.set(!open())"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        style="display:flex;align-items:center;gap:6px;font-size:13px"
      >
        <span aria-hidden>&#9881;</span>
        <span>Column Visibility ({{ visibleCount() }} of {{ totalCount() }})</span>
        <span aria-hidden>{{ open() ? '\u25B2' : '\u25BC' }}</span>
      </button>

      @if (open()) {
        <div
          style="position:absolute;right:0;top:100%;z-index:100;min-width:220px;max-height:320px;overflow-y:auto;background:var(--ogrid-bg, #fff);border:1px solid var(--ogrid-border, #e0e0e0);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.12);padding:8px 0"
        >
          <div style="padding:4px 12px;font-weight:600;font-size:12px;color:var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6))">
            Select Columns ({{ visibleCount() }} of {{ totalCount() }})
          </div>
          @for (col of columns; track col.columnId) {
            <label style="display:flex;align-items:center;gap:8px;padding:4px 12px;cursor:pointer;font-size:13px">
              <input
                type="checkbox"
                [checked]="visibleColumns.has(col.columnId)"
                (change)="onToggle(col.columnId, $any($event.target).checked)"
                [disabled]="col.required === true"
              />
              {{ col.name }}
            </label>
          }
          <div style="display:flex;gap:4px;padding:8px 12px;border-top:1px solid var(--ogrid-border, #e0e0e0);margin-top:4px">
            <button
              type="button"
              class="p-button p-button-text p-button-sm"
              (click)="onClearAll()"
              style="flex:1;font-size:12px"
            >Clear All</button>
            <button
              type="button"
              class="p-button p-button-text p-button-sm"
              (click)="onSelectAll()"
              style="flex:1;font-size:12px"
            >Select All</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ColumnChooserComponent extends BaseColumnChooserComponent {
  // PrimeNG uses 'open' instead of 'isOpen'
  get open() {
    return this.isOpen;
  }
}
