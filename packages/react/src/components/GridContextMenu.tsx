import * as React from 'react';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers, formatShortcut } from '../utils';
import type { GridContextMenuHandlerProps } from '../utils';

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
    // Handle both mouse and touch click-outside to close the menu
    const handlePointerOutside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Compute viewport-aware menu position to prevent overflow on small screens
  const menuStyle = React.useMemo((): React.CSSProperties => {
    const menuWidth = 200;
    const menuHeight = GRID_CONTEXT_MENU_ITEMS.length * 44 + 16; // approx
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = x + menuWidth > vw ? Math.max(0, vw - menuWidth - 8) : x;
    const top = y + menuHeight > vh ? Math.max(0, vh - menuHeight - 8) : y;
    return { left, top };
  }, [x, y]);

  return (
    <div
      ref={ref}
      className={classNames?.contextMenu}
      role="menu"
      style={menuStyle}
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
