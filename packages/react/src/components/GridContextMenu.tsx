import * as React from 'react';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers, formatShortcut } from '../utils/gridContextMenuHelpers';
import type { GridContextMenuHandlerProps } from '../utils/gridContextMenuHelpers';

export interface GridContextMenuClassNames {
  contextMenu?: string;
  contextMenuItem?: string;
  contextMenuItemLabel?: string;
  contextMenuItemShortcut?: string;
  contextMenuDivider?: string;
}

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  classNames?: GridContextMenuClassNames;
}

const menuPositionStyle = (x: number, y: number): React.CSSProperties => ({ left: x, top: y });

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  const { x, y, hasSelection, canUndo, canRedo, onClose, onCopy, onCut, onPaste, onSelectAll, onUndo, onRedo, classNames } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const handlers = React.useMemo(
    () => getContextMenuHandlers({ onCopy, onCut, onPaste, onSelectAll, onUndo, onRedo, onClose }),
    [onCopy, onCut, onPaste, onSelectAll, onUndo, onRedo, onClose]
  );

  const isDisabled = React.useCallback(
    (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
      if (item.disabledWhenNoSelection && !hasSelection) return true;
      if (item.id === 'undo' && !canUndo) return true;
      if (item.id === 'redo' && !canRedo) return true;
      return false;
    },
    [hasSelection, canUndo, canRedo]
  );

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
      style={menuPositionStyle(x, y)}
      aria-label="Grid context menu"
    >
      {GRID_CONTEXT_MENU_ITEMS.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            className={classNames?.contextMenuItem}
            onClick={handlers[item.id]}
            disabled={isDisabled(item)}
          >
            <span className={classNames?.contextMenuItemLabel}>{item.label}</span>
            {item.shortcut && (
              <span className={classNames?.contextMenuItemShortcut}>
                {formatShortcut(item.shortcut)}
              </span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
