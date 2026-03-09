import { GRID_CONTEXT_MENU_ITEMS, formatShortcut } from '@alaarab/ogrid-core';
import type { ISelectionRange } from '@alaarab/ogrid-core';

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
  padding: '6px 12px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const DIVIDER_STYLE: Partial<CSSStyleDeclaration> = {
  height: '1px',
  backgroundColor: 'var(--ogrid-border, #e0e0e0)',
  margin: '4px 0',
};

export interface ContextMenuHandlers {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export class ContextMenu {
  private menu: HTMLDivElement | null = null;
  private handlers: ContextMenuHandlers | null = null;
  private menuItems: HTMLDivElement[] = [];
  private outsideClickCleanup: (() => void) | null = null;

  show(
    x: number,
    y: number,
    handlers: ContextMenuHandlers,
    canUndo: boolean,
    canRedo: boolean,
    selectionRange: ISelectionRange | null
  ): void {
    this.close();

    this.handlers = handlers;
    this.menu = document.createElement('div');
    this.menuItems = [];
    Object.assign(this.menu.style, MENU_STYLE);
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.setAttribute('role', 'menu');
    this.menu.setAttribute('aria-label', 'Grid context menu');

    for (const item of GRID_CONTEXT_MENU_ITEMS) {
      if (item.dividerBefore) {
        const divider = document.createElement('div');
        Object.assign(divider.style, DIVIDER_STYLE);
        divider.setAttribute('role', 'separator');
        this.menu.appendChild(divider);
      }

      const menuItem = document.createElement('div');
      Object.assign(menuItem.style, ITEM_STYLE);
      menuItem.setAttribute('role', 'menuitem');

      const label = document.createElement('span');
      label.textContent = item.label;
      menuItem.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.textContent = formatShortcut(item.shortcut);
        shortcut.style.marginLeft = '20px';
        shortcut.style.color = 'var(--ogrid-muted, #666)';
        shortcut.style.fontSize = '12px';
        menuItem.appendChild(shortcut);
      }

      const isDisabled =
        (item.id === 'undo' && !canUndo) ||
        (item.id === 'redo' && !canRedo) ||
        (item.disabledWhenNoSelection && selectionRange == null);

      if (isDisabled) {
        menuItem.setAttribute('aria-disabled', 'true');
        menuItem.tabIndex = -1;
        menuItem.style.color = 'var(--ogrid-fg-muted, rgba(0, 0, 0, 0.4))';
        menuItem.style.opacity = '0.5';
        menuItem.style.cursor = 'not-allowed';
      } else {
        menuItem.setAttribute('aria-disabled', 'false');
        menuItem.tabIndex = 0;
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = 'var(--ogrid-bg-hover, #f5f5f5)';
          menuItem.focus();
        }, { passive: true });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = '';
        }, { passive: true });
        menuItem.addEventListener('click', () => {
          this.handleItemClick(item.id);
        }, { passive: true });
      }

      menuItem.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.focusAdjacentMenuItem(menuItem, 1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.focusAdjacentMenuItem(menuItem, -1);
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          this.focusFirstEnabledMenuItem();
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          this.focusLastEnabledMenuItem();
          return;
        }
        if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
          e.preventDefault();
          this.handleItemClick(item.id);
        }
      });

      this.menuItems.push(menuItem);
      this.menu.appendChild(menuItem);
    }

    document.body.appendChild(this.menu);
    this.focusFirstEnabledMenuItem();

    const handleClickOutside = (e: MouseEvent) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.close();
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, { passive: true });
    }, 0);
    this.outsideClickCleanup = () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }

  close(): void {
    this.outsideClickCleanup?.();
    this.outsideClickCleanup = null;
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
    this.menuItems = [];
    this.handlers = null;
  }

  private handleItemClick(id: string): void {
    if (!this.handlers) return;
    switch (id) {
      case 'undo':
        this.handlers.onUndo();
        break;
      case 'redo':
        this.handlers.onRedo();
        break;
      case 'copy':
        this.handlers.onCopy();
        break;
      case 'cut':
        this.handlers.onCut();
        break;
      case 'paste':
        this.handlers.onPaste();
        break;
      case 'selectAll':
        this.handlers.onSelectAll();
        break;
    }
    this.close();
  }

  destroy(): void {
    this.close();
  }

  private focusAdjacentMenuItem(current: HTMLDivElement, direction: 1 | -1): void {
    const enabledItems = this.menuItems.filter((item) => item.getAttribute('aria-disabled') !== 'true');
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.indexOf(current);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + enabledItems.length) % enabledItems.length;
    enabledItems[nextIndex]?.focus();
  }

  private focusFirstEnabledMenuItem(): void {
    this.menuItems.find((item) => item.getAttribute('aria-disabled') !== 'true')?.focus();
  }

  private focusLastEnabledMenuItem(): void {
    const enabledItems = this.menuItems.filter((item) => item.getAttribute('aria-disabled') !== 'true');
    enabledItems[enabledItems.length - 1]?.focus();
  }
}
