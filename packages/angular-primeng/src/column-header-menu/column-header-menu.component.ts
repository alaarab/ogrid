import { Component, input, computed, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import type { Menu } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { getColumnHeaderMenuItems, type ColumnHeaderMenuHandlers } from '@alaarab/ogrid-core';

/**
 * Column header dropdown menu for pin/unpin, sort, and autosize actions.
 * Uses PrimeNG Menu component.
 */
@Component({
  selector: 'column-header-menu',
  standalone: true,
  imports: [ButtonModule, MenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      pButton
      type="button"
      icon="pi pi-ellipsis-v"
      class="p-button-text p-button-sm column-header-menu-trigger"
      (click)="menu.toggle($event)"
      [attr.aria-label]="'Column options for ' + columnId()"
    ></button>

    <p-menu
      #menu
      [model]="menuModel()"
      [popup]="true"
      appendTo="body"
    ></p-menu>
  `,
  styles: [`
    .column-header-menu-trigger {
      opacity: 0;
      transition: opacity 0.15s;
      padding: 0.25rem;
      min-width: auto;
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

  readonly menuRef = viewChild<Menu>('menu');

  readonly menuModel = computed<MenuItem[]>(() => {
    const items = getColumnHeaderMenuItems({
      canPinLeft: this.canPinLeft(),
      canPinRight: this.canPinRight(),
      canUnpin: this.canUnpin(),
      currentSort: this.currentSort(),
      isSortable: this.isSortable(),
      isResizable: this.isResizable(),
    });

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

    return items.map((item) => ({
      label: item.label,
      disabled: item.disabled,
      separator: item.divider,
      command: () => {
        const action = actionMap[item.id];
        if (action) {
          action();
          h.onClose?.();
        }
      },
    }));
  });
}
