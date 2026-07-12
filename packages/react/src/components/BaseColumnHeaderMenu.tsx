import * as React from 'react';
import { createPortal } from 'react-dom';
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
  classNames?: ColumnHeaderMenuClassNames;
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
    classNames,
    getPortalTarget,
  } = props;

  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

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

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, anchorElement, onClose]);

  const menuInput: ColumnHeaderMenuInput = React.useMemo(
    () => ({
      canPinLeft,
      canPinRight,
      canUnpin,
      currentSort,
      isSortable,
      isResizable,
    }),
    [canPinLeft, canPinRight, canUnpin, currentSort, isSortable, isResizable]
  );

  const items = React.useMemo(() => getColumnHeaderMenuItems(menuInput), [menuInput]);

  const handlers: Record<string, () => void> = React.useMemo(
    () => ({
      pinLeft: onPinLeft,
      pinRight: onPinRight,
      unpin: onUnpin,
      sortAsc: onSortAsc,
      sortDesc: onSortDesc,
      clearSort: onClearSort,
      autosizeThis: onAutosizeThis,
      autosizeAll: onAutosizeAll,
    }),
    [onPinLeft, onPinRight, onUnpin, onSortAsc, onSortDesc, onClearSort, onAutosizeThis, onAutosizeAll]
  );

  if (!isOpen || !position) return null;

  const portalTarget = anchorElement && getPortalTarget
    ? getPortalTarget(anchorElement)
    : document.body;

  return createPortal(
    <div
      ref={menuRef}
      className={classNames?.content}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1000,
      }}
    >
      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
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
