import * as React from 'react';

const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])';

export interface UseMenuKeyboardNavOptions {
  /** True while the menu is mounted and visible. */
  active: boolean;
  onClose: () => void;
  /** Element to return focus to on close. Defaults to whatever was focused when the menu opened. */
  getRestoreTarget?: () => HTMLElement | null;
}

/**
 * WAI-ARIA menu keyboard behavior for a container of `role="menuitem"` buttons:
 * focuses the first enabled item on open (items use tabIndex -1 and are focused programmatically), ArrowUp/Down (wrapping), Home/End,
 * Escape/Tab close, and focus restoration. The returned `onKeyDown` stops propagation of every
 * key so a menu portaled inside the grid's React tree never reaches the grid's keydown handler.
 */
export function useMenuKeyboardNav(
  menuRef: React.RefObject<HTMLElement | null>,
  options: UseMenuKeyboardNavOptions
): { onKeyDown: (e: React.KeyboardEvent) => void } {
  const { active, onClose } = options;
  const restoreRef = React.useRef(options.getRestoreTarget);
  restoreRef.current = options.getRestoreTarget;

  React.useLayoutEffect(() => {
    if (!active) return;
    const menu = menuRef.current;
    const previouslyFocused = (restoreRef.current?.() ?? document.activeElement) as HTMLElement | null;
    menu?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus({ preventScroll: true });
    return () => {
      const current = document.activeElement;
      // Only restore if focus is still inside the menu (or was dropped to body); never steal it from a click target.
      if (current && current !== document.body && !(menu?.contains(current))) return;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [active, menuRef]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Menus own their keys: nothing typed inside a menu may reach the grid handler.
      e.stopPropagation();
      const menu = menuRef.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
      const idx = items.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowDown':
          next = items.length ? (idx + 1) % items.length : null;
          break;
        case 'ArrowUp':
          next = items.length ? (idx <= 0 ? items.length - 1 : idx - 1) : null;
          break;
        case 'Home':
          next = items.length ? 0 : null;
          break;
        case 'End':
          next = items.length ? items.length - 1 : null;
          break;
        case 'Escape':
        case 'Tab':
          e.preventDefault();
          onClose();
          return;
        default:
          return;
      }
      e.preventDefault();
      if (next != null) {
        items[next]?.focus({ preventScroll: true });
      }
    },
    [menuRef, onClose]
  );

  return { onKeyDown };
}
