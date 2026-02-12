import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-core';

/**
 * Column header dropdown menu for pin/unpin actions.
 * Uses Angular Material MatMenu.
 */
@Component({
  selector: 'column-header-menu',
  standalone: true,
  imports: [MatMenuModule, MatButtonModule, MatIconModule],
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
      <button
        mat-menu-item
        [disabled]="!canPinLeft"
        (click)="handlePinLeft()"
      >
        {{ menuItems[0].label }}
      </button>
      <button
        mat-menu-item
        [disabled]="!canPinRight"
        (click)="handlePinRight()"
      >
        {{ menuItems[1].label }}
      </button>
      <button
        mat-menu-item
        [disabled]="!canUnpin"
        (click)="handleUnpin()"
      >
        {{ menuItems[2].label }}
      </button>
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
  @Input() columnId!: string;
  @Input() canPinLeft = true;
  @Input() canPinRight = true;
  @Input() canUnpin = false;

  @Output() pinLeft = new EventEmitter<void>();
  @Output() pinRight = new EventEmitter<void>();
  @Output() unpin = new EventEmitter<void>();

  @ViewChild(MatMenuTrigger) menuTrigger?: MatMenuTrigger;

  readonly menuItems = COLUMN_HEADER_MENU_ITEMS;

  handlePinLeft(): void {
    if (this.canPinLeft) {
      this.pinLeft.emit();
    }
  }

  handlePinRight(): void {
    if (this.canPinRight) {
      this.pinRight.emit();
    }
  }

  handleUnpin(): void {
    if (this.canUnpin) {
      this.unpin.emit();
    }
  }
}
