import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-core';
import styles from './ColumnHeaderMenu.module.scss';

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

/**
 * Column header dropdown menu for pin/unpin actions.
 * Uses Radix UI DropdownMenu primitives.
 */
export function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
  const { isOpen, onClose, onPinLeft, onPinRight, onUnpin, canPinLeft, canPinRight, canUnpin } = props;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} sideOffset={4} align="start">
          <DropdownMenu.Item
            className={styles.item}
            disabled={!canPinLeft}
            onSelect={onPinLeft}
          >
            {COLUMN_HEADER_MENU_ITEMS[0].label}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={styles.item}
            disabled={!canPinRight}
            onSelect={onPinRight}
          >
            {COLUMN_HEADER_MENU_ITEMS[1].label}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={styles.item}
            disabled={!canUnpin}
            onSelect={onUnpin}
          >
            {COLUMN_HEADER_MENU_ITEMS[2].label}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
