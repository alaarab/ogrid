import {
  getColumnHeaderMenuItems,
  type ColumnHeaderMenuHandlers,
  type ColumnHeaderMenuInput,
} from '@alaarab/ogrid-core';

const MENU_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  backgroundColor: 'var(--ogrid-bg, #fff)',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0, 0, 0, 0.12))',
  borderRadius: '6px',
  zIndex: '10000',
  minWidth: '180px',
  padding: '4px 0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  color: 'var(--ogrid-fg, #242424)',
};

const ITEM_STYLE: Partial<CSSStyleDeclaration> = {
  width: '100%',
  padding: '6px 12px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
};

const DIVIDER_STYLE: Partial<CSSStyleDeclaration> = {
  height: '1px',
  backgroundColor: 'var(--ogrid-border, #e0e0e0)',
  margin: '4px 0',
};

export class ColumnHeaderMenu {
  private menu: HTMLDivElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  show(
    anchorElement: HTMLElement,
    input: ColumnHeaderMenuInput,
    handlers: Partial<ColumnHeaderMenuHandlers>,
  ): void {
    this.close();

    const rect = anchorElement.getBoundingClientRect();
    this.menu = document.createElement('div');
    this.menu.setAttribute('role', 'menu');
    this.menu.setAttribute('aria-label', 'Column options');
    Object.assign(this.menu.style, MENU_STYLE);
    this.menu.style.left = `${rect.left}px`;
    this.menu.style.top = `${rect.bottom + 4}px`;

    const items = getColumnHeaderMenuItems(input);
    const actionMap: Record<string, (() => void) | undefined> = {
      pinLeft: handlers.onPinLeft,
      pinRight: handlers.onPinRight,
      unpin: handlers.onUnpin,
      sortAsc: handlers.onSortAsc,
      sortDesc: handlers.onSortDesc,
      clearSort: handlers.onClearSort,
      autosizeThis: handlers.onAutosizeThis,
      autosizeAll: handlers.onAutosizeAll,
    };

    items.forEach((item, index) => {
      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.setAttribute('role', 'menuitem');
      menuItem.textContent = item.label;
      Object.assign(menuItem.style, ITEM_STYLE);

      if (item.disabled) {
        menuItem.disabled = true;
        menuItem.style.cursor = 'not-allowed';
        menuItem.style.opacity = '0.5';
      } else {
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = 'var(--ogrid-bg-hover, #f5f5f5)';
        }, { passive: true });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = '';
        }, { passive: true });
        menuItem.addEventListener('click', () => {
          actionMap[item.id]?.();
          handlers.onClose?.();
          this.close();
        }, { passive: true });
      }

      this.menu?.appendChild(menuItem);

      if (item.divider && index < items.length - 1) {
        const divider = document.createElement('div');
        divider.setAttribute('role', 'separator');
        Object.assign(divider.style, DIVIDER_STYLE);
        this.menu?.appendChild(divider);
      }
    });

    document.body.appendChild(this.menu);

    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.close();
      }
    };
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };

    setTimeout(() => {
      if (this.outsideClickHandler) {
        document.addEventListener('mousedown', this.outsideClickHandler, { passive: true });
      }
      if (this.escapeHandler) {
        document.addEventListener('keydown', this.escapeHandler);
      }
    }, 0);
  }

  close(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }

  destroy(): void {
    this.close();
  }
}
