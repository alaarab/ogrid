import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
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
  template: `
    <button
      pButton
      type="button"
      icon="pi pi-ellipsis-v"
      class="p-button-text p-button-sm column-header-menu-trigger"
      (click)="menu.toggle($event)"
      [attr.aria-label]="'Column options for ' + columnId"
    ></button>

    <p-menu
      #menu
      [model]="menuModel"
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
  @Input() columnId!: string;
  @Input() set canPinLeft(value: boolean) {
    this._canPinLeft = value;
    this.updateMenuModel();
  }
  @Input() set canPinRight(value: boolean) {
    this._canPinRight = value;
    this.updateMenuModel();
  }
  @Input() set canUnpin(value: boolean) {
    this._canUnpin = value;
    this.updateMenuModel();
  }

  @Output() pinLeft = new EventEmitter<void>();
  @Output() pinRight = new EventEmitter<void>();
  @Output() unpin = new EventEmitter<void>();

  @ViewChild('menu') menu!: Menu;

  private _canPinLeft = true;
  private _canPinRight = true;
  private _canUnpin = false;

  menuModel: MenuItem[] = [];

  ngOnInit(): void {
    this.updateMenuModel();
  }

  private updateMenuModel(): void {
    this.menuModel = [
      {
        label: COLUMN_HEADER_MENU_ITEMS[0].label,
        disabled: !this._canPinLeft,
        command: () => this.handlePinLeft(),
      },
      {
        label: COLUMN_HEADER_MENU_ITEMS[1].label,
        disabled: !this._canPinRight,
        command: () => this.handlePinRight(),
      },
      {
        label: COLUMN_HEADER_MENU_ITEMS[2].label,
        disabled: !this._canUnpin,
        command: () => this.handleUnpin(),
      },
    ];
  }

  handlePinLeft(): void {
    if (this._canPinLeft) {
      this.pinLeft.emit();
    }
  }

  handlePinRight(): void {
    if (this._canPinRight) {
      this.pinRight.emit();
    }
  }

  handleUnpin(): void {
    if (this._canUnpin) {
      this.unpin.emit();
    }
  }
}
