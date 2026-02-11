import * as React from 'react';
import { Menu, MenuItem, Divider } from '@mui/material';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers, formatShortcut } from '@alaarab/ogrid-react';
import type { GridContextMenuHandlerProps } from '@alaarab/ogrid-react';

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  const { x, y, hasSelection, canUndo, canRedo, onClose } = props;
  const handlers = React.useMemo(() => getContextMenuHandlers(props), [props]);

  const isDisabled = React.useCallback(
    (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
      if (item.disabledWhenNoSelection && !hasSelection) return true;
      if (item.id === 'undo' && !canUndo) return true;
      if (item.id === 'redo' && !canRedo) return true;
      return false;
    },
    [hasSelection, canUndo, canRedo]
  );

  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      MenuListProps={{ dense: true, 'aria-label': 'Grid context menu' } as React.HTMLAttributes<HTMLUListElement>}
    >
      {GRID_CONTEXT_MENU_ITEMS.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <Divider />}
          <MenuItem
            onClick={handlers[item.id]}
            disabled={isDisabled(item)}
          >
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ marginLeft: 24, color: 'rgba(0,0,0,0.4)', fontSize: '0.8em' }}>
                {formatShortcut(item.shortcut)}
              </span>
            )}
          </MenuItem>
        </React.Fragment>
      ))}
    </Menu>
  );
}
