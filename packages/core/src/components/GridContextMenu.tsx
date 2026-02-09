import * as React from 'react';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers } from '../utils/gridContextMenuHelpers';
import type { GridContextMenuHandlerProps } from '../utils/gridContextMenuHelpers';

export interface GridContextMenuClassNames {
  contextMenu?: string;
  contextMenuItem?: string;
  contextMenuDivider?: string;
}

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
  classNames?: GridContextMenuClassNames;
}

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  const { x, y, hasSelection, onClose, classNames } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const handlers = React.useMemo(() => getContextMenuHandlers(props), [props]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={classNames?.contextMenu}
      role="menu"
      style={{ left: x, top: y }}
      aria-label="Grid context menu"
    >
      {GRID_CONTEXT_MENU_ITEMS.map((item) => (
        <React.Fragment key={item.id}>
          {item.id === 'selectAll' && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            className={classNames?.contextMenuItem}
            onClick={handlers[item.id]}
            disabled={item.disabledWhenNoSelection ? !hasSelection : false}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
