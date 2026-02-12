import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-angular';

/**
 * Column header dropdown menu for pin/unpin actions.
 * Uses native HTML elements with lightweight styling.
 */
@Component({
  selector: 'column-header-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ogrid-header-menu" (click)="$event.stopPropagation()">
      <button
        class="ogrid-header-menu__trigger"
        [attr.aria-label]="'Column options for ' + columnId()"
        (click)="toggleMenu($event)"
      >
        &#8942;
      </button>

      @if (isOpen()) {
        <div class="ogrid-header-menu__dropdown">
          <button
            class="ogrid-header-menu__item"
            [disabled]="!canPinLeft()"
            (click)="handlePinLeft()"
          >
            {{ menuItems[0].label }}
          </button>
          <button
            class="ogrid-header-menu__item"
            [disabled]="!canPinRight()"
            (click)="handlePinRight()"
          >
            {{ menuItems[1].label }}
          </button>
          <button
            class="ogrid-header-menu__item"
            [disabled]="!canUnpin()"
            (click)="handleUnpin()"
          >
            {{ menuItems[2].label }}
          </button>
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
      opacity: 0;
      transition: opacity 0.15s;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 2px;
      background: transparent;
      color: var(--ogrid-fg, #242424);
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    :host:hover .ogrid-header-menu__trigger,
    .ogrid-header-menu__trigger:focus {
      opacity: 1;
    }
    .ogrid-header-menu__trigger:hover {
      background: var(--ogrid-hover-bg, #f0f0f0);
    }
    .ogrid-header-menu__dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 1000;
      min-width: 140px;
      background: var(--ogrid-bg, #ffffff);
      border: 1px solid var(--ogrid-border, #e0e0e0);
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
      background: var(--ogrid-hover-bg, #f0f0f0);
    }
    .ogrid-header-menu__item:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ColumnHeaderMenuComponent {
  readonly columnId = input.required<string>();
  readonly canPinLeft = input<boolean>(true);
  readonly canPinRight = input<boolean>(true);
  readonly canUnpin = input<boolean>(false);

  readonly onPinLeft = input<(() => void) | undefined>(undefined);
  readonly onPinRight = input<(() => void) | undefined>(undefined);
  readonly onUnpin = input<(() => void) | undefined>(undefined);

  readonly isOpen = signal(false);
  readonly menuItems = COLUMN_HEADER_MENU_ITEMS;

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  handlePinLeft(): void {
    if (this.canPinLeft()) {
      this.onPinLeft()?.();
    }
    this.isOpen.set(false);
  }

  handlePinRight(): void {
    if (this.canPinRight()) {
      this.onPinRight()?.();
    }
    this.isOpen.set(false);
  }

  handleUnpin(): void {
    if (this.canUnpin()) {
      this.onUnpin()?.();
    }
    this.isOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    const el = event.target as HTMLElement;
    if (!el.closest('column-header-menu')) {
      this.isOpen.set(false);
    }
  }
}
