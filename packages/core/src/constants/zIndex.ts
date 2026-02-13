/**
 * Z-index constants for layering OGrid UI elements.
 * Ensures consistent stacking order across all packages.
 */

export const Z_INDEX = {
  /** Selection range overlay (marching ants) */
  SELECTION_OVERLAY: 4,

  /** Clipboard overlay (copy/cut animation) */
  CLIPBOARD_OVERLAY: 5,

  /** Dropdown menus (column chooser, pagination size select) */
  DROPDOWN: 1000,

  /** Modal dialogs */
  MODAL: 2000,

  /** Context menus (right-click grid menu) */
  CONTEXT_MENU: 9999,
} as const;

/** Type helper for z-index keys */
export type ZIndexKey = keyof typeof Z_INDEX;
