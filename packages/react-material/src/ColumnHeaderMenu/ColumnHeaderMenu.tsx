import React, { useMemo } from 'react';
import { Menu, MenuItem, Divider, IconButton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { getColumnHeaderMenuItems } from '@alaarab/ogrid-core';
import type { ColumnHeaderMenuInput } from '@alaarab/ogrid-core';

export interface ColumnHeaderMenuProps {
  columnId: string;
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
 * Uses Material UI Menu component.
 */
export function ColumnHeaderMenu(props: ColumnHeaderMenuProps) {
  const {
    columnId,
    isOpen: _isOpen,
    anchorElement: _anchorElement,
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

  const [triggerEl, setTriggerEl] = React.useState<HTMLButtonElement | null>(null);

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setTriggerEl(event.currentTarget);
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
    <>
      <IconButton
        size="small"
        onClick={handleTriggerClick}
        aria-label={`Column options for ${columnId}`}
        sx={{
          opacity: 0,
          transition: 'opacity 0.15s',
          padding: '4px',
          '.MuiTableCell-root:hover &': {
            opacity: 1,
          },
          '&:focus': {
            opacity: 1,
          },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={triggerEl}
        open={Boolean(triggerEl)}
        onClose={() => {
          setTriggerEl(null);
          onClose();
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {items.map((item, idx) => (
          <React.Fragment key={item.id}>
            <MenuItem
              disabled={item.disabled}
              onClick={() => {
                handlers[item.id]();
                setTriggerEl(null);
              }}
            >
              {item.label}
            </MenuItem>
            {item.divider && idx < items.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </Menu>
    </>
  );
}
