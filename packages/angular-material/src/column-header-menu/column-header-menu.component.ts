import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { BaseColumnHeaderMenuComponent } from '@alaarab/ogrid-angular';

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

    /* Always reserve space; hide on hover-capable devices until column is hovered.
       The th:hover rule lives in the parent (ViewEncapsulation.None) styles. */
    @media (hover: hover) {
      .column-header-menu-trigger { visibility: hidden; }
    }

    .column-header-menu-trigger:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.08));
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
  `],
})
export class ColumnHeaderMenuComponent extends BaseColumnHeaderMenuComponent {
  @ViewChild(MatMenuTrigger) menuTrigger?: MatMenuTrigger;
}
