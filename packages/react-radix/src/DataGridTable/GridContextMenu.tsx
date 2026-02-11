import * as React from 'react';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers, formatShortcut } from '@alaarab/ogrid-react';
import type { GridContextMenuHandlerProps } from '@alaarab/ogrid-react';
import styles from './DataGridTable.module.scss';

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  const { x, y, hasSelection, canUndo, canRedo, onClose } = props;
  const ref = React.useRef<HTMLDivElement>(null);
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
    <div ref={ref} className={styles.contextMenu} role="menu" style={{ left: x, top: y }} aria-label="Grid context menu">
      {GRID_CONTEXT_MENU_ITEMS.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={styles.contextMenuDivider} />}
          <button
            type="button"
            className={styles.contextMenuItem}
            onClick={handlers[item.id]}
            disabled={isDisabled(item)}
          >
            <span className={styles.contextMenuItemLabel}>{item.label}</span>
            {item.shortcut && (
              <span className={styles.contextMenuItemShortcut}>{formatShortcut(item.shortcut)}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
