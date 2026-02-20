import { Component, ChangeDetectionStrategy, ViewChild, computed, Input, signal } from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { getColumnHeaderMenuItems, type IColumnHeaderMenuItem, type ColumnHeaderMenuHandlers } from '@alaarab/ogrid-angular';

/**
 * Column header dropdown menu for pin/unpin, sort, and autosize actions.
 * Uses Angular Material MatMenu.
 *
 * Uses signal-backed @Input setters so that computed() tracks changes
 * (plain @Input properties are not reactive in Angular signals).
 */
@Component({
  selector: 'column-header-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatMenuModule, MatDividerModule],
  template: `
    <button
      [matMenuTriggerFor]="menu"
      class="column-header-menu-trigger"
      [attr.aria-label]="'Column options for ' + columnId"
    >
      &#8942;
    </button>

    <mat-menu #menu="matMenu">
      @for (item of menuItems(); track item.id) {
        <button
          mat-menu-item
          [disabled]="item.disabled"
          (click)="handleMenuItemClick(item.id)"
        >
          {{ item.label }}
        </button>
        @if (item.divider) {
          <mat-divider></mat-divider>
        }
      }
    </mat-menu>
  `,
  styles: [`
    :host { flex-shrink: 0; }
    .column-header-menu-trigger {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.54));
    }

    .column-header-menu-trigger:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.08));
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
  `],
})
export class ColumnHeaderMenuComponent {
  @Input({ required: true }) columnId!: string;

  // Signal-backed inputs so computed() tracks changes reactively
  private readonly _canPinLeft = signal(true);
  private readonly _canPinRight = signal(true);
  private readonly _canUnpin = signal(false);
  private readonly _currentSort = signal<'asc' | 'desc' | null>(null);
  private readonly _isSortable = signal(true);
  private readonly _isResizable = signal(true);

  @Input() set canPinLeft(v: boolean) { this._canPinLeft.set(v); }
  @Input() set canPinRight(v: boolean) { this._canPinRight.set(v); }
  @Input() set canUnpin(v: boolean) { this._canUnpin.set(v); }
  @Input() set currentSort(v: 'asc' | 'desc' | null) { this._currentSort.set(v); }
  @Input() set isSortable(v: boolean) { this._isSortable.set(v); }
  @Input() set isResizable(v: boolean) { this._isResizable.set(v); }

  @Input() handlers: Partial<ColumnHeaderMenuHandlers> = {};

  @ViewChild(MatMenuTrigger) menuTrigger?: MatMenuTrigger;

  readonly menuItems = computed<IColumnHeaderMenuItem[]>(() =>
    getColumnHeaderMenuItems({
      canPinLeft: this._canPinLeft(),
      canPinRight: this._canPinRight(),
      canUnpin: this._canUnpin(),
      currentSort: this._currentSort(),
      isSortable: this._isSortable(),
      isResizable: this._isResizable(),
    })
  );

  handleMenuItemClick(itemId: string): void {
    const h = this.handlers;
    const actionMap: Record<string, (() => void) | undefined> = {
      pinLeft: h.onPinLeft,
      pinRight: h.onPinRight,
      unpin: h.onUnpin,
      sortAsc: h.onSortAsc,
      sortDesc: h.onSortDesc,
      clearSort: h.onClearSort,
      autosizeThis: h.onAutosizeThis,
      autosizeAll: h.onAutosizeAll,
    };
    const action = actionMap[itemId];
    if (action) {
      action();
      h.onClose?.();
    }
  }
}
