import * as React from 'react';
import { GRID_CONTEXT_MENU_ITEMS, getContextMenuHandlers, getStructureMenuItems, getHidingMenuItems, getCellNoteMenuItems, getFreezeMenuItems, formatShortcut } from '../utils';
import type { GridContextMenuHandlerProps } from '../utils';
import { useMenuKeyboardNav } from '../hooks/useMenuKeyboardNav';

export interface GridContextMenuClassNames {
  contextMenu?: string;
  contextMenuItem?: string;
  contextMenuItemLabel?: string;
  contextMenuItemShortcut?: string;
  contextMenuDivider?: string;
}

/** Structure-edit section of the context menu (`allowStructureEdits`). */
export interface GridContextMenuStructure {
  /** Selected rows the row items apply to; 0 hides them. */
  rowCount: number;
  /** Selected columns the column items apply to; 0 hides them. */
  columnCount: number;
  canInsertRows: boolean;
  canDeleteRows: boolean;
  /** Runs a structure item: insertRowAbove, insertRowBelow, deleteRows, insertColumnLeft, insertColumnRight, deleteColumns. */
  onAction: (id: string) => void;
}

/** Cell-note section of the context menu (editable cell notes). */
export interface GridContextMenuNotes {
  /** Whether the active cell has a note (Edit/Delete note) or not (New note). */
  hasNote: boolean;
  /** Runs a note item: newNote, editNote, deleteNote. */
  onAction: (id: string) => void;
}

/** Hide/unhide section of the context menu (`allowHiding`). */
export interface GridContextMenuHiding {
  /** Selected rows "Hide rows" applies to; 0 hides the item. */
  rowCount: number;
  /** Selected columns "Hide columns" applies to; 0 hides the item. */
  columnCount: number;
  canUnhideRows: boolean;
  canUnhideColumns: boolean;
  /** Runs a hiding item: hideRows, unhideRows, hideColumns, unhideColumns. */
  onAction: (id: string) => void;
}

/** Freeze-panes section of the context menu (`allowFreeze`). */
export interface GridContextMenuFreeze {
  /** Currently frozen displayed rows. */
  frozenRows: number;
  /** Currently frozen leading visible columns. */
  frozenColumns: number;
  /** Data rows above the active cell (what "Freeze panes" would freeze). */
  rowsAbove: number;
  /** Data columns left of the active cell. */
  columnsLeft: number;
  /** Runs a freeze item: freezePanes, freezeTopRow, freezeFirstColumn, unfreezePanes. */
  onAction: (id: string) => void;
}

export interface GridContextMenuProps extends GridContextMenuHandlerProps {
  x: number;
  y: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Insert/delete row and column items. Omit to hide them. */
  structure?: GridContextMenuStructure;
  /** Hide/unhide row and column items. Omit to hide them. */
  hiding?: GridContextMenuHiding;
  /** Freeze/unfreeze items. Omit to hide them. */
  freeze?: GridContextMenuFreeze;
  /** New/Edit/Delete note items for the active cell. Omit to hide them. */
  notes?: GridContextMenuNotes;
  classNames?: GridContextMenuClassNames;
  onDataValidation?: () => void;
}

export function GridContextMenu(props: GridContextMenuProps): React.ReactElement {
  const { x, y, hasSelection, canUndo, canRedo, onClose, onCopy, onCut, onPaste, onPasteValues, onSelectAll, onUndo, onRedo, structure, hiding, freeze, notes, classNames, onDataValidation } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const handlers = React.useMemo(
    () => getContextMenuHandlers({ onCopy, onCut, onPaste, onPasteValues, onSelectAll, onUndo, onRedo, onClose }),
    [onCopy, onCut, onPaste, onPasteValues, onSelectAll, onUndo, onRedo, onClose]
  );

  const isDisabled = React.useCallback(
    (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
      if (item.disabledWhenNoSelection && !hasSelection) return true;
      if (item.id === 'undo' && !canUndo) return true;
      if (item.id === 'redo' && !canRedo) return true;
      if (item.id === 'pasteValues' && !onPasteValues) return true;
      return false;
    },
    [hasSelection, canUndo, canRedo, onPasteValues]
  );

  const structureItems = React.useMemo(
    () => (structure
      ? getStructureMenuItems({
        rowCount: structure.rowCount,
        columnCount: structure.columnCount,
        canInsertRows: structure.canInsertRows,
        canDeleteRows: structure.canDeleteRows,
      })
      : []),
    [structure]
  );

  const hidingItems = React.useMemo(
    () => (hiding
      ? getHidingMenuItems({
        rowCount: hiding.rowCount,
        columnCount: hiding.columnCount,
        canUnhideRows: hiding.canUnhideRows,
        canUnhideColumns: hiding.canUnhideColumns,
      })
      : []),
    [hiding]
  );
  const noteItems = React.useMemo(() => (notes ? getCellNoteMenuItems(notes.hasNote) : []), [notes]);

  const freezeItems = React.useMemo(
    () => (freeze
      ? getFreezeMenuItems({
        rowsAbove: freeze.rowsAbove,
        columnsLeft: freeze.columnsLeft,
        hasFrozenPanes: freeze.frozenRows > 0 || freeze.frozenColumns > 0,
      })
      : []),
    [freeze]
  );

  // Cell menus open by right-click or touch long-press; the focused cell may
  // still match :focus-visible from earlier keyboard navigation.
  const { onKeyDown } = useMenuKeyboardNav(ref, { active: true, onClose, initialFocusVisible: false });

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
    const menuHeight = (GRID_CONTEXT_MENU_ITEMS.length + structureItems.length + hidingItems.length + noteItems.length + freezeItems.length) * 44 + 16; // approx
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = x + menuWidth > vw ? Math.max(0, vw - menuWidth - 8) : x;
    const top = y + menuHeight > vh ? Math.max(0, vh - menuHeight - 8) : y;
    return { left, top };
  }, [x, y, structureItems.length, hidingItems.length, noteItems.length, freezeItems.length]);

  return (
    <div
      ref={ref}
      className={classNames?.contextMenu}
      role="menu"
      onKeyDown={onKeyDown}
      style={menuStyle}
      aria-label="Grid context menu"
    >
      {GRID_CONTEXT_MENU_ITEMS.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={classNames?.contextMenuItem}
            data-ogrid-menu-action={item.id}
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
      {structureItems.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={classNames?.contextMenuItem}
            data-ogrid-menu-action={item.id}
            onClick={() => {
              structure?.onAction(item.id);
              onClose();
            }}
          >
            <span className={classNames?.contextMenuItemLabel}>{item.label}</span>
          </button>
        </React.Fragment>
      ))}
      {hidingItems.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={classNames?.contextMenuItem}
            data-ogrid-menu-action={item.id}
            onClick={() => {
              hiding?.onAction(item.id);
              onClose();
            }}
          >
            <span className={classNames?.contextMenuItemLabel}>{item.label}</span>
          </button>
        </React.Fragment>
      ))}
      {freezeItems.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={classNames?.contextMenuItem}
            data-ogrid-menu-action={item.id}
            onClick={() => {
              freeze?.onAction(item.id);
              onClose();
            }}
          >
            <span className={classNames?.contextMenuItemLabel}>{item.label}</span>
          </button>
        </React.Fragment>
      ))}
      {onDataValidation && <><div className={classNames?.contextMenuDivider} /><button type="button" role="menuitem" tabIndex={-1} data-ogrid-menu-action="validation" className={classNames?.contextMenuItem} onClick={() => { onClose(); onDataValidation(); }}>Data validation…</button></>}
      {noteItems.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className={classNames?.contextMenuDivider} />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={classNames?.contextMenuItem}
            data-ogrid-menu-action={item.id}
            onClick={() => {
              onClose();
              notes?.onAction(item.id);
            }}
          >
            <span className={classNames?.contextMenuItemLabel}>{item.label}</span>
            {item.shortcut && (
              <span className={classNames?.contextMenuItemShortcut}>{formatShortcut(item.shortcut)}</span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
