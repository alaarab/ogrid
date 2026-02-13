import React, { useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
 * Uses Radix UI DropdownMenu primitives.
 */
export function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
  const {
    isOpen,
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

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

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} sideOffset={4} align="start">
          {items.map((item, idx) => (
            <React.Fragment key={item.id}>
              <DropdownMenu.Item
                className={styles.item}
                disabled={item.disabled}
                onSelect={handlers[item.id]}
              >
                {item.label}
              </DropdownMenu.Item>
              {item.divider && idx < items.length - 1 && (
                <DropdownMenu.Separator className={styles.separator} />
              )}
            </React.Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
