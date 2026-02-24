/**
 * Z-index constants for layering OGrid UI elements.
 * Ensures consistent stacking order across all packages.
 * Values mirror --ogrid-z-* CSS custom properties in _ogrid-theme.scss.
 */

export const Z_INDEX = {
  /** Column resize drag handle */
  RESIZE_HANDLE: 1,

  /** Active/editing cell outline */
  ACTIVE_CELL: 2,

  /** Fill handle dot */
  FILL_HANDLE: 3,

  /** Selection range overlay (marching ants) */
  SELECTION_OVERLAY: 4,

  /** Row number column */
  ROW_NUMBER: 5,

  /** Clipboard overlay (copy/cut animation) */
  CLIPBOARD_OVERLAY: 5,

  /** Sticky pinned body cells */
  PINNED: 6,

  /** Selection checkbox column in body */
  SELECTION_CELL: 7,

  /** Sticky thead row */
  THEAD: 8,

  /** Pinned header cells (sticky both axes) */
  PINNED_HEADER: 10,

  /** Focused header cell */
  HEADER_FOCUS: 11,

  /** Checkbox column in sticky header (sticky both axes) */
  SELECTION_HEADER_PINNED: 12,

  /** Loading overlay within table */
  LOADING: 2,

  /** Column reorder drop indicator */
  DROP_INDICATOR: 100,

  /** Dropdown menus (column chooser, pagination size select) */
  DROPDOWN: 1000,

  /** Filter popovers */
  FILTER_POPOVER: 1000,

  /** Modal dialogs */
  MODAL: 2000,

  /** Fullscreen grid container */
  FULLSCREEN: 9999,

  /** Context menus (right-click grid menu) */
  CONTEXT_MENU: 10000,
} as const;

/** Type helper for z-index keys */
export type ZIndexKey = keyof typeof Z_INDEX;
