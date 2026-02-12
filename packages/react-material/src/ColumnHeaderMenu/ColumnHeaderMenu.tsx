import React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-core';

export interface ColumnHeaderMenuProps {
  columnId: string;
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
    canPinLeft,
    canPinRight,
    canUnpin,
  } = props;

  const [triggerEl, setTriggerEl] = React.useState<HTMLButtonElement | null>(null);

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setTriggerEl(event.currentTarget);
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
        <MenuItem disabled={!canPinLeft} onClick={onPinLeft}>
          {COLUMN_HEADER_MENU_ITEMS[0].label}
        </MenuItem>
        <MenuItem disabled={!canPinRight} onClick={onPinRight}>
          {COLUMN_HEADER_MENU_ITEMS[1].label}
        </MenuItem>
        <MenuItem disabled={!canUnpin} onClick={onUnpin}>
          {COLUMN_HEADER_MENU_ITEMS[2].label}
        </MenuItem>
      </Menu>
    </>
  );
}
