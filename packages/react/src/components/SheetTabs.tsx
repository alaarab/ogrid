/**
 * SheetTabs  -  Excel-style sheet tab bar at the bottom of the grid.
 *
 * Layout: [+] [Sheet1] [Sheet2] [Sheet3]
 *
 * Optional, each turned on by its callback: rename (double-click or F2),
 * reorder (drag a tab, or Move left/right in the tab menu), delete and tab
 * color (tab menu: right-click a tab, or Shift+F10 / the context-menu key).
 */

import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ISheetDef } from '@alaarab/ogrid-core';
import { useMenuKeyboardNav } from '../hooks/useMenuKeyboardNav';

export interface SheetTabsProps {
  sheets: ISheetDef[];
  activeSheet: string;
  onSheetChange: (sheetId: string) => void;
  onSheetAdd?: () => void;
  /** Rename a sheet (double-click a tab, F2, or "Rename" in the tab menu). */
  onSheetRename?: (sheetId: string, name: string) => void;
  /** Reorder sheets (drag a tab, or "Move left/right" in the tab menu). Receives every sheet id in the new order. */
  onSheetReorder?: (sheetIds: string[]) => void;
  /** Delete a sheet ("Delete" in the tab menu; not offered for the last sheet). */
  onSheetDelete?: (sheetId: string) => void;
  /** Set or clear (`undefined`) a sheet's tab color from the tab menu. */
  onSheetColorChange?: (sheetId: string, color: string | undefined) => void;
}

/** Tab colors offered in the tab menu. */
export const SHEET_TAB_COLORS: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Red', color: '#c00000' },
  { name: 'Orange', color: '#ed7d31' },
  { name: 'Gold', color: '#ffc000' },
  { name: 'Green', color: '#70ad47' },
  { name: 'Blue', color: '#4472c4' },
  { name: 'Purple', color: '#7030a0' },
];

/** `ids` with `fromId` moved before or after `toId`. */
export function moveSheetId(ids: readonly string[], fromId: string, toId: string, side: 'before' | 'after'): string[] {
  if (fromId === toId) return [...ids];
  const rest = ids.filter((id) => id !== fromId);
  const target = rest.indexOf(toId);
  if (target < 0 || rest.length === ids.length) return [...ids];
  rest.splice(side === 'before' ? target : target + 1, 0, fromId);
  return rest;
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  borderTop: '1px solid var(--ogrid-border, #e0e0e0)',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  minHeight: 30,
  overflowX: 'auto',
  overflowY: 'hidden',
  gap: 0,
  fontSize: 12,
};

const tabListStyle: React.CSSProperties = { display: 'flex', alignItems: 'center' };

const addBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: 16,
  lineHeight: '22px',
  color: 'var(--ogrid-fg-secondary, #666)',
  flexShrink: 0,
};

const tabBaseStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  padding: '4px 16px',
  fontSize: 12,
  lineHeight: '22px',
  color: 'var(--ogrid-fg, #242424)',
  whiteSpace: 'nowrap',
  position: 'relative',
};

const activeTabStyle: React.CSSProperties = {
  ...tabBaseStyle,
  fontWeight: 600,
  borderBottomColor: 'var(--ogrid-primary, #217346)',
  background: 'var(--ogrid-bg, #fff)',
};

const renameInputStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: 12,
  lineHeight: '20px',
  margin: '2px 4px',
  padding: '0 4px',
  width: 120,
  border: '1px solid var(--ogrid-accent, #0078d4)',
  borderRadius: 2,
  color: 'var(--ogrid-fg, #242424)',
  background: 'var(--ogrid-bg, #fff)',
};

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--ogrid-z-popover, 10001)' as unknown as number,
  minWidth: 160,
  padding: '4px 0',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 4,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
  fontSize: 12,
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  padding: '6px 12px',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
};

const menuDividerStyle: React.CSSProperties = { height: 1, margin: '4px 0', border: 'none', background: 'var(--ogrid-border, #e0e0e0)' };

const swatchRowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 12px' };

const swatchStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  padding: 0,
  borderRadius: 2,
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  cursor: 'pointer',
};

/** Which half of the tab the pointer is over during a drag. */
function dropSide(e: React.DragEvent<HTMLElement>): 'before' | 'after' {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientX > rect.left + rect.width / 2 ? 'after' : 'before';
}

interface MenuState {
  sheetId: string;
  x: number;
  y: number;
}

interface DropTarget {
  sheetId: string;
  side: 'before' | 'after';
}

export function SheetTabs({
  sheets,
  activeSheet,
  onSheetChange,
  onSheetAdd,
  onSheetRename,
  onSheetReorder,
  onSheetDelete,
  onSheetColorChange,
}: SheetTabsProps): React.ReactElement {
  const tablistRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const hasMenu = !!(onSheetRename || onSheetReorder || onSheetDelete || onSheetColorChange);

  const focusTab = useCallback((sheetId: string) => {
    tablistRef.current?.querySelector<HTMLElement>(`[data-sheet-id="${CSS.escape(String(sheetId))}"]`)?.focus();
  }, []);

  const handleTabClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.sheetId;
      if (id) onSheetChange(id);
    },
    [onSheetChange]
  );

  // --- Rename ---
  const startRename = useCallback((sheetId: string) => {
    if (!onSheetRename) return;
    const sheet = sheets.find((s) => s.id === sheetId);
    if (!sheet) return;
    setDraft(sheet.name);
    setEditingId(sheetId);
  }, [onSheetRename, sheets]);

  const finishRename = useCallback((commit: boolean) => {
    const id = editingId;
    if (id == null) return;
    setEditingId(null);
    const name = draft.trim();
    const current = sheets.find((s) => s.id === id)?.name;
    if (commit && name && name !== current) onSheetRename?.(id, name);
    // Back to the tab once it has re-rendered.
    requestAnimationFrame(() => focusTab(id));
  }, [editingId, draft, sheets, onSheetRename, focusTab]);

  // Focus the rename input after it mounts (and after a closing tab menu has
  // handed focus back to its tab, which runs in a layout effect).
  useEffect(() => {
    if (editingId == null) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingId]);

  // --- Tab menu ---
  const openMenuAt = useCallback((sheetId: string, x: number, y: number) => {
    if (hasMenu) setMenu({ sheetId, x, y });
  }, [hasMenu]);
  const closeMenu = useCallback(() => setMenu(null), []);

  const move = useCallback((sheetId: string, delta: -1 | 1) => {
    const ids = sheets.map((s) => s.id);
    const index = ids.indexOf(sheetId);
    const target = ids[index + delta];
    if (index < 0 || target === undefined) return;
    onSheetReorder?.(moveSheetId(ids, sheetId, target, delta < 0 ? 'before' : 'after'));
  }, [sheets, onSheetReorder]);

  // WAI-ARIA tabs keyboard model: arrows move and activate, Home/End jump.
  // F2 renames, Shift+F10 / the context-menu key opens the tab menu.
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.sheetId;
      const index = sheets.findIndex((s) => s.id === id);
      if (index < 0 || id === undefined) return;
      if (e.key === 'F2' && onSheetRename) {
        e.preventDefault();
        startRename(id);
        return;
      }
      if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
        if (!hasMenu) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        openMenuAt(id, rect.left, rect.top);
        return;
      }
      const last = sheets.length - 1;
      const next =
        e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
        : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
        : e.key === 'Home' ? 0
        : e.key === 'End' ? last
        : -1;
      const target = next >= 0 ? sheets[next] : undefined;
      if (!target) return;
      e.preventDefault();
      onSheetChange(target.id);
      focusTab(target.id);
    },
    [sheets, onSheetChange, onSheetRename, startRename, hasMenu, openMenuAt, focusTab]
  );

  // --- Drag to reorder ---
  const handleDragStart = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.sheetId;
    if (!id) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.sheetId;
    if (!dragId || !id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const side = dropSide(e);
    setDropTarget((prev) => (prev?.sheetId === id && prev.side === side ? prev : { sheetId: id, side }));
  }, [dragId]);
  const endDrag = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.sheetId;
    e.preventDefault();
    if (dragId && id) {
      const ids = sheets.map((s) => s.id);
      const next = moveSheetId(ids, dragId, id, dropSide(e));
      if (next.some((sid, i) => sid !== ids[i])) onSheetReorder?.(next);
    }
    endDrag();
  }, [dragId, sheets, onSheetReorder, endDrag]);

  return (
    <div style={barStyle}>
      {onSheetAdd && (
        <button
          type="button"
          style={addBtnStyle}
          onClick={onSheetAdd}
          title="Add sheet"
          aria-label="Add sheet"
        >
          +
        </button>
      )}
      <div ref={tablistRef} style={tabListStyle} role="tablist" aria-label="Sheet tabs">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheet;
          if (sheet.id === editingId) {
            return (
              <input
                key={sheet.id}
                ref={renameInputRef}
                style={renameInputStyle}
                aria-label="Sheet name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => finishRename(true)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    finishRename(true);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finishRename(false);
                  }
                }}
              />
            );
          }
          const base = isActive ? activeTabStyle : tabBaseStyle;
          const drop = dropTarget?.sheetId === sheet.id && dragId !== sheet.id ? dropTarget.side : null;
          const style: React.CSSProperties = {
            ...base,
            ...(sheet.color ? { borderBottomColor: sheet.color } : undefined),
            ...(drop ? { boxShadow: `inset ${drop === 'before' ? '2px' : '-2px'} 0 0 var(--ogrid-accent, #0078d4)` } : undefined),
            ...(dragId === sheet.id ? { opacity: 0.5 } : undefined),
          };
          return (
            <button
              key={sheet.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-haspopup={hasMenu ? 'menu' : undefined}
              tabIndex={isActive ? 0 : -1}
              style={style}
              data-sheet-id={sheet.id}
              onClick={handleTabClick}
              onKeyDown={handleTabKeyDown}
              onDoubleClick={onSheetRename ? () => startRename(sheet.id) : undefined}
              onContextMenu={hasMenu ? (e) => {
                e.preventDefault();
                openMenuAt(sheet.id, e.clientX, e.clientY);
              } : undefined}
              draggable={onSheetReorder ? true : undefined}
              onDragStart={onSheetReorder ? handleDragStart : undefined}
              onDragOver={onSheetReorder ? handleDragOver : undefined}
              onDrop={onSheetReorder ? handleDrop : undefined}
              onDragEnd={onSheetReorder ? endDrag : undefined}
            >
              {sheet.name}
            </button>
          );
        })}
      </div>
      {menu && (
        <SheetTabMenu
          menuRef={menuRef}
          menu={menu}
          sheets={sheets}
          onClose={closeMenu}
          onRename={onSheetRename ? startRename : undefined}
          onMove={onSheetReorder ? move : undefined}
          onDelete={onSheetDelete}
          onColorChange={onSheetColorChange}
          restoreFocus={focusTab}
        />
      )}
    </div>
  );
}

interface SheetTabMenuProps {
  menuRef: React.RefObject<HTMLDivElement | null>;
  menu: MenuState;
  sheets: ISheetDef[];
  onClose: () => void;
  onRename?: (sheetId: string) => void;
  onMove?: (sheetId: string, delta: -1 | 1) => void;
  onDelete?: (sheetId: string) => void;
  onColorChange?: (sheetId: string, color: string | undefined) => void;
  restoreFocus: (sheetId: string) => void;
}

function SheetTabMenu(props: SheetTabMenuProps): React.ReactElement {
  const { menuRef, menu, sheets, onClose, onRename, onMove, onDelete, onColorChange, restoreFocus } = props;
  const { sheetId } = menu;
  const index = sheets.findIndex((s) => s.id === sheetId);
  const sheet = sheets[index];
  const getRestoreTarget = useCallback(
    () => menuRef.current?.ownerDocument.querySelector<HTMLElement>(`[role="tab"][data-sheet-id="${CSS.escape(sheetId)}"]`) ?? null,
    [menuRef, sheetId]
  );
  const { onKeyDown } = useMenuKeyboardNav(menuRef, { active: true, onClose, getRestoreTarget });
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  // Open above the tab bar (it sits at the bottom of the grid), kept on screen.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const top = Math.max(margin, menu.y - rect.height - 4);
    const left = Math.max(margin, Math.min(menu.x, window.innerWidth - rect.width - margin));
    setPosition({ left, top });
  }, [menu, menuRef]);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [menuRef, onClose]);

  const run = (action: () => void, refocus = true) => {
    onClose();
    action();
    if (refocus) requestAnimationFrame(() => restoreFocus(sheetId));
  };

  const name = sheet?.name ?? sheetId;
  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${name} sheet options`}
      style={{ ...menuStyle, left: position.left, top: position.top }}
      onKeyDown={onKeyDown}
    >
      {onRename && (
        <button type="button" role="menuitem" tabIndex={-1} style={menuItemStyle} onClick={() => run(() => onRename(sheetId), false)}>
          Rename
        </button>
      )}
      {onMove && (
        <>
          <button type="button" role="menuitem" tabIndex={-1} style={menuItemStyle} disabled={index <= 0} onClick={() => run(() => onMove(sheetId, -1))}>
            Move left
          </button>
          <button type="button" role="menuitem" tabIndex={-1} style={menuItemStyle} disabled={index < 0 || index >= sheets.length - 1} onClick={() => run(() => onMove(sheetId, 1))}>
            Move right
          </button>
        </>
      )}
      {onDelete && (
        <button type="button" role="menuitem" tabIndex={-1} style={menuItemStyle} disabled={sheets.length <= 1} onClick={() => run(() => onDelete(sheetId), false)}>
          Delete
        </button>
      )}
      {onColorChange && (
        <>
          {(onRename || onMove || onDelete) && <hr style={menuDividerStyle} />}
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset inside role="menu" would be read as a form; role="group" is the menu pattern for a set of items */}
          <div role="group" aria-label="Tab color" style={swatchRowStyle}>
            {SHEET_TAB_COLORS.map((c) => {
              const current = sheet?.color === c.color;
              return (
                <button
                  key={c.color}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-label={`${c.name} tab color${current ? ' (current)' : ''}`}
                  title={c.name}
                  style={{ ...swatchStyle, background: c.color, outline: current ? '2px solid var(--ogrid-fg, #242424)' : undefined }}
                  onClick={() => run(() => onColorChange(sheetId, c.color))}
                />
              );
            })}
          </div>
          <button type="button" role="menuitem" tabIndex={-1} style={menuItemStyle} disabled={!sheet?.color} onClick={() => run(() => onColorChange(sheetId, undefined))}>
            No color
          </button>
        </>
      )}
    </div>
  );
}
