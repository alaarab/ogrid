import * as React from 'react';
import { useRef, useEffect } from 'react';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-core';
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
});

export interface ColumnHeaderMenuProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  onClose: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
}

export function ColumnHeaderMenu(props: ColumnHeaderMenuProps): React.ReactElement | null {
  const { isOpen, anchorElement, onClose, onPinLeft, onPinRight, onUnpin, canPinLeft, canPinRight, canUnpin } = props;
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

  if (!isOpen || !anchorElement) return null;

  const rect = anchorElement.getBoundingClientRect();
  const menuStyle: React.CSSProperties = {
    top: rect.bottom + 4,
    left: rect.left,
  };

  const handlers = [onPinLeft, onPinRight, onUnpin];
  const disabled = [!canPinLeft, !canPinRight, !canUnpin];

  return (
    <div ref={menuRef} className={styles.menu} style={menuStyle}>
      {COLUMN_HEADER_MENU_ITEMS.map((item, idx) => (
        <button
          key={item.id}
          className={styles.menuItem}
          onClick={handlers[idx]}
          disabled={disabled[idx]}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
