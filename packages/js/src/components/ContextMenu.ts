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
    Object.assign(this.menu.style, MENU_STYLE);
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;

    for (const item of GRID_CONTEXT_MENU_ITEMS) {
      if (item.dividerBefore) {
        const divider = document.createElement('div');
        Object.assign(divider.style, DIVIDER_STYLE);
        this.menu.appendChild(divider);
      }

      const menuItem = document.createElement('div');
      Object.assign(menuItem.style, ITEM_STYLE);

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
        menuItem.style.color = 'var(--ogrid-fg-muted, rgba(0, 0, 0, 0.4))';
        menuItem.style.opacity = '0.5';
        menuItem.style.cursor = 'not-allowed';
      } else {
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = 'var(--ogrid-bg-hover, #f5f5f5)';
        }, { passive: true });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = '';
        }, { passive: true });
        menuItem.addEventListener('click', () => {
          this.handleItemClick(item.id);
        }, { passive: true });
      }

      this.menu.appendChild(menuItem);
    }

    document.body.appendChild(this.menu);

    const handleClickOutside = (e: MouseEvent) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.close();
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, { passive: true });
    }, 0);
  }

  close(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
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
}
