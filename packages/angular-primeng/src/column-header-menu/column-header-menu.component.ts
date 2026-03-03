import { Component, computed, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import type { Menu } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { BaseColumnHeaderMenuComponent } from '@alaarab/ogrid-angular';

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
      [attr.aria-label]="'Column options for ' + columnId"
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
      padding: 0.25rem;
      min-width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
      border-radius: 4px;
      transition: background-color 0.15s;
    }
    /* Always reserve space; hide on hover-capable devices until column is hovered.
       The th:hover rule lives in the parent (ViewEncapsulation.None) styles. */
    @media (hover: hover) {
      .column-header-menu-trigger { visibility: hidden; }
    }
    .column-header-menu-trigger:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
  `],
})
export class ColumnHeaderMenuComponent extends BaseColumnHeaderMenuComponent {
  @ViewChild('menu') menuRef?: Menu;

  readonly menuModel = computed<MenuItem[]>(() => {
    const result: MenuItem[] = [];
    for (const item of this.menuItems()) {
      result.push({
        label: item.label,
        disabled: item.disabled,
        command: () => this.handleMenuItemClick(item.id),
      });
      if (item.divider) {
        result.push({ separator: true });
      }
    }
    return result;
  });
}
