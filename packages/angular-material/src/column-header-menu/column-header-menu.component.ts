import { Component, input, viewChild, computed, ChangeDetectionStrategy } from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { getColumnHeaderMenuItems, type IColumnHeaderMenuItem, type ColumnHeaderMenuHandlers } from '@alaarab/ogrid-core';

/**
 * Column header dropdown menu for pin/unpin, sort, and autosize actions.
 * Uses Angular Material MatMenu.
 */
@Component({
  selector: 'column-header-menu',
  standalone: true,
  imports: [MatMenuModule, MatButtonModule, MatIconModule, MatDividerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="menu"
      class="column-header-menu-trigger"
      [attr.aria-label]="'Column options for ' + columnId()"
    >
      <mat-icon>more_vert</mat-icon>
    </button>

    <mat-menu #menu="matMenu">
      @for (item of menuItems(); track item.id) {
        @if (item.divider) {
          <mat-divider></mat-divider>
        }
        <button
          mat-menu-item
          [disabled]="item.disabled"
          (click)="handleMenuItemClick(item.id)"
        >
          {{ item.label }}
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .column-header-menu-trigger {
      opacity: 0;
      transition: opacity 0.15s;
      width: 24px;
      height: 24px;
      line-height: 24px;
      padding: 0;
    }

    :host:hover .column-header-menu-trigger,
    .column-header-menu-trigger:focus {
      opacity: 1;
    }
  `],
})
export class ColumnHeaderMenuComponent {
  readonly columnId = input.required<string>();
  readonly canPinLeft = input<boolean>(true);
  readonly canPinRight = input<boolean>(true);
  readonly canUnpin = input<boolean>(false);
  readonly currentSort = input<'asc' | 'desc' | null>(null);
  readonly isSortable = input<boolean>(true);
  readonly isResizable = input<boolean>(true);

  readonly handlers = input<Partial<ColumnHeaderMenuHandlers>>({});

  readonly menuTrigger = viewChild(MatMenuTrigger);

  readonly menuItems = computed<IColumnHeaderMenuItem[]>(() =>
    getColumnHeaderMenuItems({
      canPinLeft: this.canPinLeft(),
      canPinRight: this.canPinRight(),
      canUnpin: this.canUnpin(),
      currentSort: this.currentSort(),
      isSortable: this.isSortable(),
      isResizable: this.isResizable(),
    })
  );

  handleMenuItemClick(itemId: string): void {
    const h = this.handlers();
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
