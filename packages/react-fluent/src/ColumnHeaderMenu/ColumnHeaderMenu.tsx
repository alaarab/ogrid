import * as React from 'react';
import { useRef, useEffect, useMemo } from 'react';
import { getColumnHeaderMenuItems } from '@alaarab/ogrid-core';
import type { ColumnHeaderMenuInput } from '@alaarab/ogrid-core';
import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  menu: {
    position: 'fixed',
    minWidth: '140px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    padding: '4px',
    boxShadow: tokens.shadow16,
    zIndex: 100,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    height: '28px',
    padding: '0 8px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusSmall,
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',

    ':hover:not([disabled])': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },

    ':active:not([disabled])': {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },

    ':disabled': {
      color: tokens.colorNeutralForegroundDisabled,
      cursor: 'not-allowed',
    },
  },
  separator: {
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
    margin: '4px 0',
  },
});

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

export function ColumnHeaderMenu(props: ColumnHeaderMenuProps): React.ReactElement | null {
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
  const menuRef = useRef<HTMLDivElement>(null);
  const styles = useStyles();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
  }, [isOpen, onClose]);

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

  if (!isOpen || !anchorElement) return null;

  const rect = anchorElement.getBoundingClientRect();
  const menuStyle: React.CSSProperties = {
    top: rect.bottom + 4,
    left: rect.left,
  };

  return (
    <div ref={menuRef} className={styles.menu} style={menuStyle}>
      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <button
            className={styles.menuItem}
            onClick={handlers[item.id]}
            disabled={item.disabled}
          >
            {item.label}
          </button>
          {item.divider && idx < items.length - 1 && <div className={styles.separator} />}
        </React.Fragment>
      ))}
    </div>
  );
}
