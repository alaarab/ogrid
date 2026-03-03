import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { BaseColumnHeaderMenuComponent } from '@alaarab/ogrid-angular';

@Component({
  selector: 'column-header-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ogrid-header-menu" (click)="$event.stopPropagation()">
      <button
        class="ogrid-header-menu__trigger"
        [attr.aria-label]="'Column options for ' + columnId"
        (click)="toggleMenu($event)"
      >
        &#8942;
      </button>

      @if (isOpen()) {
        <div class="ogrid-header-menu__dropdown">
          @for (item of menuItems(); track item.id) {
            <button
              class="ogrid-header-menu__item"
              [disabled]="item.disabled"
              (click)="handleMenuItemClick(item.id)"
            >
              {{ item.label }}
            </button>
            @if (item.divider) {
              <div class="ogrid-header-menu__divider"></div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ogrid-header-menu {
      position: relative;
      display: inline-flex;
    }
    .ogrid-header-menu__trigger {
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 2px;
      background: transparent;
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    /* Always reserve space; hide on hover-capable devices until column is hovered.
       The th:hover rule lives in the parent (ViewEncapsulation.None) styles. */
    @media (hover: hover) {
      .ogrid-header-menu__trigger { visibility: hidden; }
    }
    .ogrid-header-menu__trigger:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    }
    .ogrid-header-menu__dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 1000;
      min-width: 140px;
      background: var(--ogrid-bg, #ffffff);
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
    }
    .ogrid-header-menu__item {
      display: block;
      width: 100%;
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--ogrid-fg, #242424);
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .ogrid-header-menu__item:hover:not(:disabled) {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    }
    .ogrid-header-menu__item:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .ogrid-header-menu__divider {
      height: 1px;
      margin: 4px 0;
      background: var(--ogrid-border, rgba(0, 0, 0, 0.12));
    }
  `],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ColumnHeaderMenuComponent extends BaseColumnHeaderMenuComponent {
  readonly isOpen = signal(false);

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  override handleMenuItemClick(itemId: string): void {
    super.handleMenuItemClick(itemId);
    this.isOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    const el = event.target as HTMLElement;
    if (!el.closest('column-header-menu')) {
      this.isOpen.set(false);
    }
  }
}
