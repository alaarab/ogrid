/**
 * Settings button in the top-right corner of the header rows (`headerMenu`),
 * plus the built-in items it shares with the column menus.
 */

import * as React from 'react';
import { BaseGridMenu } from './BaseGridMenu';
import type { GridMenuClassNames } from './BaseGridMenu';
import { usePortalTheme } from '../hooks/usePortalTheme';
import { resolveGridMenuItems } from '../types/gridMenuTypes';
import type { IGridMenuItem } from '../types/gridMenuTypes';
import type { IGridMenusConfig } from '../types/dataGridTypes';
import type { DataGridStyles } from './BaseDataGridTable.types';

/** Lists past this length get a search box. */
const SEARCHABLE_COLUMN_COUNT = 8;

/** Show/hide checklist of the chooser's columns, as a submenu item. */
export function buildColumnsMenuItem(
  chooser: NonNullable<IGridMenusConfig['columnChooser']>,
  id: string,
  label: string,
): IGridMenuItem {
  const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns } = chooser;
  const visibleCount = columns.filter((c) => visibleColumns.has(c.columnId)).length;
  const showAll: IGridMenuItem = {
    id: 'showAllColumns',
    label: 'Show all columns',
    keepOpen: true,
    divider: true,
    disabled: visibleCount === columns.length,
    onClick: () => {
      if (onSetVisibleColumns) {
        const next = new Set(visibleColumns);
        for (const c of columns) next.add(c.columnId);
        onSetVisibleColumns(next);
      } else {
        for (const c of columns) if (!visibleColumns.has(c.columnId)) onVisibilityChange(c.columnId, true);
      }
    },
  };
  return {
    id,
    label,
    searchable: columns.length > SEARCHABLE_COLUMN_COUNT,
    items: [
      showAll,
      ...columns.map((c): IGridMenuItem => {
        const checked = visibleColumns.has(c.columnId);
        return {
          id: `column:${c.columnId}`,
          label: c.name,
          checked,
          keepOpen: true,
          // Required columns stay, and so does the last shown one.
          disabled: c.required === true || (checked && visibleCount <= 1),
          onClick: () => onVisibilityChange(c.columnId, !checked),
        };
      }),
    ],
  };
}

export function buildFullScreenMenuItem(fullScreen: NonNullable<IGridMenusConfig['fullScreen']>): IGridMenuItem {
  return {
    id: 'fullScreen',
    label: fullScreen.isFullScreen ? 'Exit full screen' : 'Full screen',
    onClick: () => fullScreen.setFullScreen(!fullScreen.isFullScreen),
  };
}

function ExitFullScreenIcon(): React.ReactElement {
  // Arrows pointing inward, inside the 2-14 box (same drawing as the toolbar's exit icon).
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 10 6 10 6 14" />
      <polyline points="14 6 10 6 10 2" />
      <line x1="2" y1="14" x2="6" y2="10" />
      <line x1="14" y1="2" x2="10" y2="6" />
    </svg>
  );
}

function SettingsIcon(): React.ReactElement {
  // Three sliders; every stroke stays inside the 2-14 box so nothing clips.
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
      <circle cx="5" cy="4" r="1.5" fill="var(--ogrid-header-bg, #f5f5f5)" />
      <circle cx="10.5" cy="8" r="1.5" fill="var(--ogrid-header-bg, #f5f5f5)" />
      <circle cx="7" cy="12" r="1.5" fill="var(--ogrid-header-bg, #f5f5f5)" />
    </svg>
  );
}

export interface HeaderCornerMenuProps {
  gridMenus: IGridMenusConfig;
  onAutosizeAll: () => void;
  /** Clears the table's own column widths; the rest of the reset comes from `gridMenus`. */
  onResetWidths: () => void;
  styles: DataGridStyles;
  getPortalTarget?: (anchorElement: HTMLElement) => HTMLElement;
}

export function HeaderCornerMenu(props: HeaderCornerMenuProps): React.ReactElement {
  const { gridMenus, onAutosizeAll, onResetWidths, styles, getPortalTarget } = props;
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const portalTheme = usePortalTheme(triggerRef, open);
  const [headerHeight, setHeaderHeight] = React.useState<number | null>(null);

  // The corner spans every header row, so it follows the thead's height.
  // Found from the corner itself: the wrapper's ref isn't attached yet when
  // this child's layout effect first runs.
  const cornerRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const thead = cornerRef.current?.parentElement?.querySelector('thead');
    if (!thead) return;
    const measure = () => setHeaderHeight(Math.round(thead.getBoundingClientRect().height) || null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(thead);
    return () => observer.disconnect();
  }, []);

  const close = React.useCallback(() => setOpen(false), []);
  const { columnChooser, fullScreen, cornerItems, resetColumns } = gridMenus;
  const items = React.useMemo(() => {
    const builtIns: IGridMenuItem[] = [];
    if (columnChooser) builtIns.push({ ...buildColumnsMenuItem(columnChooser, 'columns', 'Columns'), divider: true });
    if (fullScreen) builtIns.push(buildFullScreenMenuItem(fullScreen));
    builtIns.push(
      { id: 'autosizeAll', label: 'Autosize all columns', onClick: onAutosizeAll },
      {
        id: 'resetColumns',
        label: 'Reset columns',
        onClick: () => {
          onResetWidths();
          resetColumns();
        },
      },
    );
    return resolveGridMenuItems(builtIns, cornerItems, { isFullScreen: fullScreen?.isFullScreen ?? false });
  }, [columnChooser, fullScreen, cornerItems, onAutosizeAll, onResetWidths, resetColumns]);

  const classNames: GridMenuClassNames = {
    content: styles.gridMenu,
    item: styles.gridMenuItem,
    separator: styles.gridMenuSeparator,
    search: styles.gridMenuSearch,
    check: styles.gridMenuCheck,
    icon: styles.gridMenuIcon,
  };

  const exit = fullScreen?.isFullScreen ? fullScreen : null;
  const shortcut = gridMenus.fullScreenShortcut;
  const exitTitle = `Exit full screen (Esc${shortcut ? ` or ${shortcut.length === 1 ? shortcut.toUpperCase() : shortcut}` : ''})`;

  return (
    <div ref={cornerRef} className={styles.headerCorner} data-ogrid-header-corner="">
      <div className={styles.headerCornerCell} style={headerHeight ? { height: headerHeight } : undefined}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.headerCornerTrigger}
          aria-label="Grid options"
          title="Grid options"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <SettingsIcon />
        </button>
      </div>
      {exit && (
        // Full screen hides the page's own controls: keep a way out in sight.
        <button
          type="button"
          className={styles.headerCornerTrigger}
          data-ogrid-exit-full-screen=""
          aria-label="Exit full screen"
          title={exitTitle}
          onClick={() => exit.setFullScreen(false)}
        >
          <ExitFullScreenIcon />
        </button>
      )}
      {open && (
        <BaseGridMenu
          items={items}
          anchorElement={triggerRef.current}
          onClose={close}
          ariaLabel="Grid options"
          classNames={classNames}
          getPortalTarget={getPortalTarget}
          placement="below-end"
          style={portalTheme}
        />
      )}
    </div>
  );
}
