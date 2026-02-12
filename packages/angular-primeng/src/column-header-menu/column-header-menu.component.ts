import { Component, input, computed, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import type { Menu } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-core';

/**
 * Column header dropdown menu for pin/unpin actions.
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

  readonly onPinLeft = input<(() => void) | undefined>(undefined);
  readonly onPinRight = input<(() => void) | undefined>(undefined);
  readonly onUnpin = input<(() => void) | undefined>(undefined);

  readonly menuRef = viewChild<Menu>('menu');

  readonly menuModel = computed<MenuItem[]>(() => [
    {
      label: COLUMN_HEADER_MENU_ITEMS[0].label,
      disabled: !this.canPinLeft(),
      command: () => this.handlePinLeft(),
    },
    {
      label: COLUMN_HEADER_MENU_ITEMS[1].label,
      disabled: !this.canPinRight(),
      command: () => this.handlePinRight(),
    },
    {
      label: COLUMN_HEADER_MENU_ITEMS[2].label,
      disabled: !this.canUnpin(),
      command: () => this.handleUnpin(),
    },
  ]);

  handlePinLeft(): void {
    if (this.canPinLeft()) {
      this.onPinLeft()?.();
    }
  }

  handlePinRight(): void {
    if (this.canPinRight()) {
      this.onPinRight()?.();
    }
  }

  handleUnpin(): void {
    if (this.canUnpin()) {
      this.onUnpin()?.();
    }
  }
}
