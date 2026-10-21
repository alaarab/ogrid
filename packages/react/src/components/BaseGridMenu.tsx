/**
 * Portaled menu with nested submenus, checkable items and an optional search
 * box. Renders the column header menu and the header corner menu, including
 * the items apps add through `columnMenuItems` / `headerMenuItems`.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import type { IGridMenuItem } from '../types/gridMenuTypes';

export interface GridMenuClassNames {
  content?: string;
  item?: string;
  separator?: string;
  /** Search box above a searchable menu. */
  search?: string;
  /** Check mark slot of a checkable item. */
  check?: string;
  /** Icon slot. */
  icon?: string;
}

export interface BaseGridMenuProps {
  items: IGridMenuItem[];
  /** Element the menu opens from: the trigger, or the parent item for a submenu. */
  anchorElement: HTMLElement | null;
  /** Closes the whole menu (every open level). */
  onClose: () => void;
  ariaLabel: string;
  classNames?: GridMenuClassNames;
  /** Portal target. Defaults to document.body. */
  getPortalTarget?: (anchorElement: HTMLElement) => HTMLElement;
  /** Where the menu sits against its anchor. Submenus open to the right. */
  placement?: 'below-start' | 'below-end' | 'right';
  /** Extra inline style (the grid's theme tokens for the portal). */
  style?: React.CSSProperties;
  /** Show a search box that filters the items by label. */
  searchable?: boolean;
  /** Move focus into the menu when it opens. */
  autoFocus?: boolean;
  /** Set on submenus: ArrowLeft and Escape return to the parent item. */
  onBack?: () => void;
  /** Set on submenus: the pointer entered it (keeps the parent from switching submenus). */
  onPointerEnterMenu?: () => void;
  /** Bumped to move focus into an already open menu (a submenu opened by hover, then ArrowRight). */
  focusRequest?: number;
}

const ITEM_SELECTOR = '[role^="menuitem"]:not(:disabled):not([aria-disabled="true"])';
const HOVER_DELAY_MS = 150;
const VIEWPORT_MARGIN = 8;

function focusItem(el: HTMLElement | null | undefined) {
  el?.focus({ preventScroll: true });
}

export function BaseGridMenu(props: BaseGridMenuProps): React.ReactElement | null {
  const {
    items, anchorElement, onClose, ariaLabel, classNames, getPortalTarget, placement = 'below-start',
    style, searchable = false, autoFocus = true, onBack, onPointerEnterMenu, focusRequest = 0,
  } = props;
  const isSubmenu = onBack != null;
  const menuRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [query, setQuery] = React.useState('');
  // focusRequest > 0: the submenu takes focus (opened or entered from the keyboard, or by a click).
  const [openSub, setOpenSub] = React.useState<{ id: string; anchor: HTMLElement; focusRequest: number } | null>(null);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const clearHoverTimer = React.useCallback(() => {
    if (hoverTimer.current != null) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);
  React.useEffect(() => clearHoverTimer, [clearHoverTimer]);

  const shownItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
  }, [items, query]);

  // Place against the anchor, inside the viewport. Runs before paint, so the
  // first frame (hidden, at 0,0) is never seen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-place when a search changes the menu's height
  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !anchorElement) return;
    const rect = anchorElement.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxHeight = Math.max(120, vh - 2 * VIEWPORT_MARGIN);
    const h = Math.min(height, maxHeight);
    let left: number;
    let top: number;
    if (placement === 'right') {
      left = rect.right - 2;
      if (left + width > vw - VIEWPORT_MARGIN) left = Math.max(VIEWPORT_MARGIN, rect.left - width + 2);
      top = rect.top - 4;
    } else {
      left = placement === 'below-end' ? rect.right - width : rect.left;
      top = rect.bottom + 4;
      if (top + h > vh - VIEWPORT_MARGIN) {
        const above = rect.top - 4 - h;
        top = above >= VIEWPORT_MARGIN ? above : top;
      }
    }
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN));
    top = Math.min(Math.max(VIEWPORT_MARGIN, top), Math.max(VIEWPORT_MARGIN, vh - h - VIEWPORT_MARGIN));
    setPosition((prev) => (prev && prev.top === top && prev.left === left && prev.maxHeight === maxHeight ? prev : { top, left, maxHeight }));
  }, [anchorElement, placement, shownItems.length]);

  // Opening focus, keyboard modality, and focus back to the opener on close.
  const placed = position != null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per opening (when placed), not on every item change
  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!placed || !menu) return;
    menu.dataset.ogridMenuKeyboard = String(anchorElement?.matches(':focus-visible') ?? false);
    const onPointerDown = () => { menu.dataset.ogridMenuKeyboard = 'false'; };
    menu.addEventListener('pointerdown', onPointerDown);
    if (autoFocus) {
      if (searchable && searchRef.current) searchRef.current.focus({ preventScroll: true });
      else focusItem(menu.querySelector<HTMLElement>(ITEM_SELECTOR));
    }
    return () => {
      menu.removeEventListener('pointerdown', onPointerDown);
      if (isSubmenu) return;
      const current = document.activeElement;
      // Restore only when focus is still in a menu (or dropped to body); never steal it from a click target.
      if (current && current !== document.body && !current.closest('[data-ogrid-grid-menu]')) return;
      if (anchorElement?.isConnected) anchorElement.focus({ preventScroll: true });
    };
  }, [placed]);

  // Focus into an already open menu on request (hover opened it without focus).
  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!placed || !menu || focusRequest === 0) return;
    if (searchable && searchRef.current) searchRef.current.focus({ preventScroll: true });
    else focusItem(menu.querySelector<HTMLElement>(ITEM_SELECTOR));
  }, [focusRequest, placed, searchable]);

  // Root only: close on outside press, page/grid scroll that moves the anchor, and resize.
  React.useEffect(() => {
    if (isSubmenu || !anchorElement) return;
    const start = anchorElement.getBoundingClientRect();
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-ogrid-grid-menu]')) return;
      if (anchorElement.contains(target)) return; // the trigger toggles itself
      onCloseRef.current();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    const handleScroll = (e: Event) => {
      if (e.target instanceof Node && (e.target as Element).closest?.('[data-ogrid-grid-menu]')) return;
      const now = anchorElement.getBoundingClientRect();
      if (Math.abs(now.top - start.top) >= 1 || Math.abs(now.left - start.left) >= 1) onCloseRef.current();
    };
    const handleResize = () => onCloseRef.current();
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isSubmenu, anchorElement]);

  const openSubmenu = React.useCallback((id: string, anchor: HTMLElement, withFocus: boolean) => {
    clearHoverTimer();
    setOpenSub((prev) => {
      if (prev && prev.id === id) return withFocus ? { ...prev, focusRequest: prev.focusRequest + 1 } : prev;
      return { id, anchor, focusRequest: withFocus ? 1 : 0 };
    });
  }, [clearHoverTimer]);

  const closeSubmenu = React.useCallback((refocus: boolean) => {
    setOpenSub((prev) => {
      if (prev && refocus) focusItem(prev.anchor);
      return null;
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Menus own their keys: nothing typed here may reach the grid (or a parent menu).
    e.stopPropagation();
    const menu = menuRef.current;
    if (!menu) return;
    menu.dataset.ogridMenuKeyboard = 'true';
    const inSearch = e.target === searchRef.current;
    const own = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    const idx = own.indexOf(document.activeElement as HTMLElement);
    const active = idx >= 0 ? own[idx] : null;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(own[inSearch || idx < 0 ? 0 : (idx + 1) % own.length]);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (idx <= 0 && searchRef.current) searchRef.current.focus({ preventScroll: true });
        else focusItem(own[idx <= 0 ? own.length - 1 : idx - 1]);
        return;
      case 'Home':
      case 'End':
        if (inSearch) return;
        e.preventDefault();
        focusItem(e.key === 'Home' ? own[0] : own[own.length - 1]);
        return;
      case 'ArrowRight':
        if (inSearch || !active || active.getAttribute('aria-haspopup') !== 'menu') return;
        e.preventDefault();
        openSubmenu(active.dataset.ogridMenuAction ?? '', active, true);
        return;
      case 'ArrowLeft':
        if (inSearch || !onBack) return;
        e.preventDefault();
        onBack();
        return;
      case 'Escape':
        e.preventDefault();
        if (inSearch && query) { setQuery(''); return; }
        if (onBack) onBack();
        else onClose();
        return;
      case 'Tab':
        e.preventDefault();
        onClose();
        return;
      default:
    }
  };

  // Nothing to place against (and no document during SSR): render nothing.
  if (!anchorElement || typeof document === 'undefined') return null;
  const portalTarget = getPortalTarget ? getPortalTarget(anchorElement) : document.body;
  const subItem = openSub ? items.find((item) => item.id === openSub.id) : undefined;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      data-ogrid-grid-menu=""
      className={classNames?.content}
      onKeyDown={handleKeyDown}
      onMouseEnter={onPointerEnterMenu}
      style={{
        ...style,
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight,
        overflowY: 'auto',
        visibility: position ? undefined : 'hidden',
        zIndex: 'var(--ogrid-z-popover, 10001)',
      }}
    >
      {searchable && (
        <input
          ref={searchRef}
          type="search"
          className={classNames?.search}
          aria-label={`Search ${ariaLabel.toLowerCase()}`}
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {shownItems.map((item, idx) => {
        const hasSub = item.items != null;
        const isOpen = openSub?.id === item.id;
        return (
          <React.Fragment key={item.id}>
            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is menuitemcheckbox whenever aria-checked is set */}
            <button
              type="button"
              role={item.checked != null ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={item.checked != null ? item.checked : undefined}
              aria-haspopup={hasSub ? 'menu' : undefined}
              aria-expanded={hasSub ? isOpen : undefined}
              tabIndex={-1}
              className={classNames?.item}
              data-ogrid-menu-action={item.id}
              disabled={item.disabled}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                clearHoverTimer();
                if (isOpen) return;
                if (!hasSub && !openSub) return;
                hoverTimer.current = setTimeout(() => {
                  if (hasSub) setOpenSub({ id: item.id, anchor: el, focusRequest: 0 });
                  else setOpenSub(null);
                }, HOVER_DELAY_MS);
              }}
              onMouseLeave={clearHoverTimer}
              onClick={(e) => {
                if (hasSub) {
                  if (isOpen) closeSubmenu(false);
                  else openSubmenu(item.id, e.currentTarget, true);
                  return;
                }
                item.onClick?.();
                if (!item.keepOpen) onClose();
              }}
            >
              {item.checked != null && (
                <span className={classNames?.check} aria-hidden="true">{item.checked ? '✓' : ''}</span>
              )}
              {item.icon != null && <span className={classNames?.icon} aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
            {item.divider && idx < shownItems.length - 1 && <div className={classNames?.separator} />}
          </React.Fragment>
        );
      })}
      {searchable && shownItems.length === 0 && (
        <div className={classNames?.item} aria-live="polite" style={{ opacity: 0.6, cursor: 'default' }}>No matches</div>
      )}
      {openSub && subItem?.items && (
        <BaseGridMenu
          // A different item gets a fresh submenu: no search text or open child carried over.
          key={subItem.id}
          items={subItem.items}
          anchorElement={openSub.anchor}
          onClose={onClose}
          ariaLabel={subItem.label}
          classNames={classNames}
          getPortalTarget={getPortalTarget}
          placement="right"
          style={style}
          searchable={subItem.searchable}
          autoFocus={openSub.focusRequest > 0}
          focusRequest={openSub.focusRequest}
          onBack={() => closeSubmenu(true)}
          onPointerEnterMenu={clearHoverTimer}
        />
      )}
    </div>,
    portalTarget,
  );
}
