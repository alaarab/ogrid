import * as React from 'react';
import { createPortal } from 'react-dom';
import { usePortalTheme } from '../hooks/usePortalTheme';
import { useMenuKeyboardNav } from '../hooks/useMenuKeyboardNav';
import { getColumnHeaderMenuItems } from '../utils';
import type { ColumnHeaderMenuInput } from '../utils';

export interface ColumnHeaderMenuClassNames {
  content?: string;
  item?: string;
  separator?: string;
}

export interface BaseColumnHeaderMenuProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  onClose: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  onAutosizeThis: () => void;
  onAutosizeAll: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
  currentSort: 'asc' | 'desc' | null;
  isSortable: boolean;
  isResizable: boolean;
  /** Show "Insert column left/right" and "Delete column" (`allowStructureEdits`). */
  canEditStructure?: boolean;
  onInsertColumnLeft?: () => void;
  onInsertColumnRight?: () => void;
  onDeleteColumn?: () => void;
  classNames?: ColumnHeaderMenuClassNames;
  /** Column name, used for the menu's accessible name. */
  columnName?: string;
  /** Resolve the portal target element. Defaults to document.body. */
  getPortalTarget?: (anchorElement: HTMLElement) => HTMLElement;
}

/**
 * Base column header dropdown menu for pin/sort/autosize actions.
 * Uses positioned div with portal rendering.
 * Shared by Radix and Fluent UI packages (Material uses MUI Menu instead).
 */
export function BaseColumnHeaderMenu(props: BaseColumnHeaderMenuProps) {
  const {
    isOpen,
    anchorElement,
    onClose,
    onPinLeft,
    onPinRight,
    onUnpin,
    onSortAsc,
    onSortDesc,
    onClearSort,
    onAutosizeThis,
    onAutosizeAll,
    canPinLeft,
    canPinRight,
    canUnpin,
    currentSort,
    isSortable,
    isResizable,
    canEditStructure = false,
    onInsertColumnLeft,
    onInsertColumnRight,
    onDeleteColumn,
    classNames,
    columnName,
    getPortalTarget,
  } = props;

  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  // Carry the grid's scoped theme tokens into the portaled menu.
  const anchorRef = React.useMemo(() => ({ current: anchorElement ?? null }), [anchorElement]);
  const portalTheme = usePortalTheme(anchorRef, isOpen);

  React.useEffect(() => {
    if (!isOpen || !anchorElement) {
      setPosition(null);
      return;
    }

    const rect = anchorElement.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the menu itself (portal)  -  let onClick fire first
      if (menuRef.current?.contains(target)) return;
      if (anchorElement && !anchorElement.contains(target)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // The menu is position: fixed from a one-time measurement, so close it once the header
    // actually moves (grid or page scroll) rather than leave it detached. Scrolls that leave
    // the header in place (inside the menu, unrelated scrollers, focus on open) keep it open.
    const handleScroll = () => {
      const now = anchorElement.getBoundingClientRect();
      if (Math.abs(now.top - rect.top) >= 1 || Math.abs(now.left - rect.left) >= 1) onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [isOpen, anchorElement, onClose]);

  // Keep the menu inside the viewport: shift left near the right edge, flip above the
  // anchor near the bottom edge.
  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !position || !anchorElement) return;
    const margin = 8;
    const menuRect = menu.getBoundingClientRect();
    let { top, left } = position;
    if (left + menuRect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - menuRect.width - margin);
    }
    if (top + menuRect.height > window.innerHeight - margin) {
      const above = anchorElement.getBoundingClientRect().top - 4 - menuRect.height;
      top = Math.max(margin, above);
    }
    if (top !== position.top || left !== position.left) setPosition({ top, left });
  }, [position, anchorElement]);

  const menuInput: ColumnHeaderMenuInput = React.useMemo(
    () => ({
      canPinLeft,
      canPinRight,
      canUnpin,
      currentSort,
      isSortable,
      isResizable,
      canEditStructure,
    }),
    [canPinLeft, canPinRight, canUnpin, currentSort, isSortable, isResizable, canEditStructure]
  );

  const items = React.useMemo(() => getColumnHeaderMenuItems(menuInput), [menuInput]);

  const handlers: Record<string, (() => void) | undefined> = React.useMemo(
    () => ({
      pinLeft: onPinLeft,
      pinRight: onPinRight,
      unpin: onUnpin,
      sortAsc: onSortAsc,
      sortDesc: onSortDesc,
      clearSort: onClearSort,
      autosizeThis: onAutosizeThis,
      autosizeAll: onAutosizeAll,
      insertColumnLeft: onInsertColumnLeft,
      insertColumnRight: onInsertColumnRight,
      deleteColumn: onDeleteColumn,
    }),
    [onPinLeft, onPinRight, onUnpin, onSortAsc, onSortDesc, onClearSort, onAutosizeThis, onAutosizeAll, onInsertColumnLeft, onInsertColumnRight, onDeleteColumn]
  );

  const getRestoreTarget = React.useCallback(() => anchorElement, [anchorElement]);
  const { onKeyDown } = useMenuKeyboardNav(menuRef, {
    active: isOpen && position != null,
    onClose,
    getRestoreTarget,
  });

  if (!isOpen || !position) return null;

  const portalTarget = anchorElement && getPortalTarget
    ? getPortalTarget(anchorElement)
    : document.body;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={columnName ? `${columnName} column options` : 'Column options'}
      onKeyDown={onKeyDown}
      className={classNames?.content}
      style={{
        ...portalTheme,
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 'var(--ogrid-z-popover, 10001)',
      }}
    >
      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={classNames?.item}
            disabled={item.disabled}
            onClick={() => {
              handlers[item.id]?.();
              onClose();
            }}
          >
            {item.label}
          </button>
          {item.divider && idx < items.length - 1 && (
            <div className={classNames?.separator} />
          )}
        </React.Fragment>
      ))}
    </div>,
    portalTarget
  );
}
