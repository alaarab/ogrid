import React, { useMemo, useEffect, useState } from 'react';
import { Menu, MenuItem, Divider } from '@mui/material';
import { getColumnHeaderMenuItems } from '@alaarab/ogrid-react';
import type { ColumnHeaderMenuInput } from '@alaarab/ogrid-react';

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
 * Uses Material UI Menu component with anchor position.
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

  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | undefined>(undefined);

  useEffect(() => {
    if (isOpen && anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      setAnchorPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    } else {
      setAnchorPosition(undefined);
    }
  }, [isOpen, anchorElement]);

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

  const handlers: Record<string, () => void> = useMemo(
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

  return (
    <Menu
      open={isOpen && !!anchorPosition}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      slotProps={{
        paper: {
          sx: {
            minWidth: 140,
          },
        },
      }}
    >
      {items.map((item, idx) => (
        <React.Fragment key={item.id}>
          <MenuItem
            disabled={item.disabled}
            onClick={() => {
              handlers[item.id]();
              onClose();
            }}
          >
            {item.label}
          </MenuItem>
          {item.divider && idx < items.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </Menu>
  );
}
