import type * as React from 'react';

/**
 * One item in a grid menu (the header corner menu or a column's menu).
 * Give it `items` to make it open a submenu instead of running `onClick`.
 */
export interface IGridMenuItem {
  /** Stable id. Built-in items use fixed ids (see the docs) so apps can find, hide or move them. */
  id: string;
  label: string;
  /** Shown before the label. */
  icon?: React.ReactNode;
  /** Runs when the item is chosen. The menu closes afterwards unless `keepOpen` is set. */
  onClick?: () => void;
  /** Submenu items. The item opens a nested menu (click, hover, Enter or ArrowRight). */
  items?: IGridMenuItem[];
  disabled?: boolean;
  /** Render as a checkable item (`menuitemcheckbox`) showing this state. */
  checked?: boolean;
  /** Keep the menu open after `onClick` (checkable lists). */
  keepOpen?: boolean;
  /** Draw a separator after this item. */
  divider?: boolean;
  /** For an item with `items`: show a search box above its submenu that filters the items by label. */
  searchable?: boolean;
}

/** Context passed to a `headerMenuItems` function. */
export interface IHeaderMenuContext {
  /** True while the grid fills the viewport. */
  isFullScreen: boolean;
}

/** Context passed to a `columnMenuItems` function. */
export interface IColumnMenuContext {
  /** The column whose menu is open. */
  columnId: string;
}

/**
 * Items for a grid menu: an array is added after the built-in items; a function
 * receives the built-in items and returns the full list, so it can add, hide,
 * reorder or wrap them.
 */
export type GridMenuItems<C> = IGridMenuItem[] | ((builtIns: IGridMenuItem[], context: C) => IGridMenuItem[]);

/** Applies a `GridMenuItems` customization to the built-in items. */
export function resolveGridMenuItems<C>(builtIns: IGridMenuItem[], custom: GridMenuItems<C> | undefined, context: C): IGridMenuItem[] {
  if (!custom) return builtIns;
  if (typeof custom === 'function') return custom(builtIns, context);
  if (custom.length === 0) return builtIns;
  const last = builtIns[builtIns.length - 1];
  const withDivider = last && !last.divider ? [...builtIns.slice(0, -1), { ...last, divider: true }] : builtIns;
  return [...withDivider, ...custom];
}
