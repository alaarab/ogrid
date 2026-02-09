import * as React from 'react';
import { Menu, MenuItem } from '@mui/material';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers } from '@alaarab/ogrid-core';
import type { GridContextMenuHandlerProps } from '@alaarab/ogrid-core';

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
}

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  const { x, y, hasSelection, onClose } = props;
  const handlers = React.useMemo(() => getContextMenuHandlers(props), [props]);
  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      MenuListProps={{ dense: true, 'aria-label': 'Grid context menu' } as React.HTMLAttributes<HTMLUListElement>}
    >
      {GRID_CONTEXT_MENU_ITEMS.map((item) => (
        <MenuItem
          key={item.id}
          onClick={handlers[item.id]}
          disabled={item.disabledWhenNoSelection ? !hasSelection : false}
          divider={item.id === 'selectAll'}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
