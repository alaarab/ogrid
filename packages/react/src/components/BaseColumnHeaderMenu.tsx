import * as React from 'react';
import { usePortalTheme } from '../hooks/usePortalTheme';
import { BaseGridMenu } from './BaseGridMenu';
import type { GridMenuClassNames } from './BaseGridMenu';
import type { IGridMenuItem } from '../types/gridMenuTypes';
import { getColumnHeaderMenuItems } from '../utils';
import type { ColumnHeaderMenuInput } from '../utils';

export type ColumnHeaderMenuClassNames = GridMenuClassNames;

export interface BaseColumnHeaderMenuProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  onClose: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  /** Add this column as the next sort level. Shown when `canAddToSort`. */
  onAddToSort?: () => void;
  onAutosizeThis: () => void;
  onAutosizeAll: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
  currentSort: 'asc' | 'desc' | null;
  isSortable: boolean;
  isResizable: boolean;
  /** Show "Insert column left/right" and "Delete column" (`allowStructureEdits`). */
  canEditStructure?: boolean;
  onInsertColumnLeft?: () => void;
  onInsertColumnRight?: () => void;
  onDeleteColumn?: () => void;
  /** Show "Hide column" (`allowHiding`). */
  canHide?: boolean;
  /** Show "Unhide columns" (hidden columns sit next to this one). */
  canUnhide?: boolean;
  onHideColumn?: () => void;
  onUnhideColumns?: () => void;
  /** Show "Move left" / "Move right" (`columnReorder`). */
  canReorder?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  /** The grid is sorted by other columns: offer "Add to sort". */
  canAddToSort?: boolean;
  classNames?: ColumnHeaderMenuClassNames;
  /** Column name, used for the menu's accessible name. */
  columnName?: string;
  /** Resolve the portal target element. Defaults to document.body. */
  getPortalTarget?: (anchorElement: HTMLElement) => HTMLElement;
  /** Grid-level items (Choose columns, Full screen), placed after the autosize items. */
  extraItems?: IGridMenuItem[];
  /** Final say over the items: add, hide, reorder (`columnMenuItems`). */
  customizeItems?: (items: IGridMenuItem[]) => IGridMenuItem[];
}

/**
 * Base column header dropdown menu for pin/sort/autosize actions.
 * Renders through BaseGridMenu (portaled, with submenus).
 * Shared by Radix and Fluent UI packages (Material uses MUI Menu instead).
 */
export function BaseColumnHeaderMenu(props: BaseColumnHeaderMenuProps) {
  const {
    isOpen,
    anchorElement,
    onClose,
    onPinLeft,
    onPinRight,
    onUnpin,
    onSortAsc,
    onSortDesc,
    onClearSort,
    onAddToSort,
    onAutosizeThis,
    onAutosizeAll,
    canPinLeft,
    canPinRight,
    canUnpin,
    currentSort,
    isSortable,
    isResizable,
    canEditStructure = false,
    onInsertColumnLeft,
    onInsertColumnRight,
    onDeleteColumn,
    canHide = false,
    canUnhide = false,
    onHideColumn,
    onUnhideColumns,
    canReorder = false,
    canMoveLeft = false,
    canMoveRight = false,
    onMoveLeft,
    onMoveRight,
    canAddToSort = false,
    classNames,
    columnName,
    getPortalTarget,
    extraItems,
    customizeItems,
  } = props;

  // Carry the grid's scoped theme tokens into the portaled menu.
  const anchorRef = React.useMemo(() => ({ current: anchorElement ?? null }), [anchorElement]);
  const portalTheme = usePortalTheme(anchorRef, isOpen);

  const menuInput: ColumnHeaderMenuInput = React.useMemo(
    () => ({
      canPinLeft,
      canPinRight,
      canUnpin,
      currentSort,
      isSortable,
      isResizable,
      canEditStructure,
      canHide,
      canUnhide,
      canAddToSort: canAddToSort && onAddToSort != null,
      canReorder,
      canMoveLeft,
      canMoveRight,
    }),
    [canPinLeft, canPinRight, canUnpin, currentSort, isSortable, isResizable, canEditStructure, canHide, canUnhide, canAddToSort, onAddToSort, canReorder, canMoveLeft, canMoveRight]
  );

  const items = React.useMemo(() => getColumnHeaderMenuItems(menuInput), [menuInput]);

  const handlers: Record<string, (() => void) | undefined> = React.useMemo(
    () => ({
      pinLeft: onPinLeft,
      pinRight: onPinRight,
      unpin: onUnpin,
      sortAsc: onSortAsc,
      sortDesc: onSortDesc,
      clearSort: onClearSort,
      addToSort: onAddToSort ?? (() => {}),
      autosizeThis: onAutosizeThis,
      autosizeAll: onAutosizeAll,
      insertColumnLeft: onInsertColumnLeft,
      insertColumnRight: onInsertColumnRight,
      deleteColumn: onDeleteColumn,
      hideColumn: onHideColumn,
      unhideColumns: onUnhideColumns,
      moveLeft: onMoveLeft,
      moveRight: onMoveRight,
    }),
    [onPinLeft, onPinRight, onUnpin, onSortAsc, onSortDesc, onClearSort, onAddToSort, onAutosizeThis, onAutosizeAll, onInsertColumnLeft, onInsertColumnRight, onDeleteColumn, onHideColumn, onUnhideColumns, onMoveLeft, onMoveRight]
  );

  const menuItems = React.useMemo(() => {
    const builtIns: IGridMenuItem[] = items.map((item) => ({
      id: item.id,
      label: item.label,
      disabled: item.disabled,
      divider: item.divider,
      onClick: handlers[item.id],
    }));
    if (extraItems && extraItems.length > 0) {
      // App-level items (Choose columns, Full screen) sit with the autosize section.
      const after = builtIns.findIndex((item) => item.id === 'autosizeAll');
      const at = after >= 0 ? after + 1 : builtIns.length;
      const before = builtIns[at - 1];
      if (before) builtIns[at - 1] = { ...before, divider: false };
      const tail = builtIns.slice(at);
      const lastExtra = extraItems[extraItems.length - 1];
      const extras = tail.length > 0 && lastExtra ? [...extraItems.slice(0, -1), { ...lastExtra, divider: true }] : extraItems;
      if (before && after < 0) builtIns[at - 1] = { ...before, divider: true };
      builtIns.splice(at, 0, ...extras);
    }
    return customizeItems ? customizeItems(builtIns) : builtIns;
  }, [items, handlers, extraItems, customizeItems]);

  if (!isOpen || !anchorElement) return null;

  return (
    <BaseGridMenu
      items={menuItems}
      anchorElement={anchorElement}
      onClose={onClose}
      ariaLabel={columnName ? `${columnName} column options` : 'Column options'}
      classNames={classNames}
      getPortalTarget={getPortalTarget}
      style={portalTheme}
    />
  );
}
