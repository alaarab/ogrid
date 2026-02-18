import type * as React from 'react';

/**
 * Module-scope stable constants shared across all React UI DataGridTable implementations.
 * Avoid per-render allocations by keeping these at module scope.
 */

/** Root container style for the DataGridTable (flex column layout). */
export const GRID_ROOT_STYLE: React.CSSProperties = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

/** Applied to cells that support editing — shows the cell cursor. */
export const CURSOR_CELL_STYLE: React.CSSProperties = { cursor: 'cell' };

/** Minimum size for popover anchor elements. */
export const POPOVER_ANCHOR_STYLE: React.CSSProperties = { minHeight: '100%', minWidth: 40 };

/** Prevents the default browser action for mouse events. */
export const PREVENT_DEFAULT = (e: React.MouseEvent): void => { e.preventDefault(); };

/** No-operation function. */
export const NOOP = (): void => {};

/** Stops event propagation (e.g. click on checkbox inside a row). */
export const STOP_PROPAGATION = (e: React.MouseEvent): void => { e.stopPropagation(); };
