import React, { useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getColumnHeaderMenuItems } from '@alaarab/ogrid-core';
import type { ColumnHeaderMenuInput } from '@alaarab/ogrid-core';
import styles from './ColumnHeaderMenu.module.scss';

export interface ColumnHeaderMenuProps {
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
}

/**
 * Column header dropdown menu for pin/sort/autosize actions.
 * Uses positioned div with portal rendering.
 */
export function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
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
  } = props;

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      // Don't close if clicking inside the menu itself (portal) — let onClick fire first
      if (menuRef.current && menuRef.current.contains(target)) return;
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

  const menuInput: ColumnHeaderMenuInput = useMemo(
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

  const items = useMemo(() => getColumnHeaderMenuItems(menuInput), [menuInput]);

  const handlers: Record<string, () => void> = {
    pinLeft: onPinLeft,
    pinRight: onPinRight,
    unpin: onUnpin,
    sortAsc: onSortAsc,
    sortDesc: onSortDesc,
    clearSort: onClearSort,
    autosizeThis: onAutosizeThis,
    autosizeAll: onAutosizeAll,
  };

  if (!isOpen || !position) return null;

  // Portal into the closest FluentProvider so --ogrid-* bridged variables are available
  const portalTarget = anchorElement?.closest('.fui-FluentProvider') as HTMLElement ?? document.body;

  return createPortal(
    <div
      ref={menuRef}
      className={styles.content}
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
            className={styles.item}
            disabled={item.disabled}
            onClick={() => {
              handlers[item.id]();
              onClose();
            }}
          >
            {item.label}
          </button>
          {item.divider && idx < items.length - 1 && (
            <div className={styles.separator} />
          )}
        </React.Fragment>
      ))}
    </div>,
    portalTarget
  );
}
