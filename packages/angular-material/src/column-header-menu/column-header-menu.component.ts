import { Component, ViewChild, computed, ChangeDetectionStrategy, Input } from '@angular/core';
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
      [attr.aria-label]="'Column options for ' + columnId"
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
  @Input({ required: true }) columnId!: string;
  @Input() canPinLeft: boolean = true;
  @Input() canPinRight: boolean = true;
  @Input() canUnpin: boolean = false;
  @Input() currentSort: 'asc' | 'desc' | null = null;
  @Input() isSortable: boolean = true;
  @Input() isResizable: boolean = true;

  @Input() handlers: Partial<ColumnHeaderMenuHandlers> = {};

  @ViewChild(MatMenuTrigger) menuTrigger?: MatMenuTrigger;

  readonly menuItems = computed<IColumnHeaderMenuItem[]>(() =>
    getColumnHeaderMenuItems({
      canPinLeft: this.canPinLeft,
      canPinRight: this.canPinRight,
      canUnpin: this.canUnpin,
      currentSort: this.currentSort,
      isSortable: this.isSortable,
      isResizable: this.isResizable,
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
