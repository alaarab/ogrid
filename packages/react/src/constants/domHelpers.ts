import type * as React from 'react';

/**
 * Module-scope stable constants shared across all React UI DataGridTable implementations.
 * Avoid per-render allocations by keeping these at module scope.
 */

/** Root container style for the DataGridTable (flex column layout). */
export const GRID_ROOT_STYLE: React.CSSProperties = { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

/** Applied to cells that support editing  -  shows the cell cursor. */
export const CURSOR_CELL_STYLE: React.CSSProperties = { cursor: 'cell' };

/**
 * Popover anchor element style — must match the `.cellContent` layout so the cell
 * content doesn't shift when the editor opens. Uses flex alignment + cell padding
 * to keep the displayed value in the same position as a non-editing cell.
 */
export const POPOVER_ANCHOR_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '100%',
  minWidth: 40,
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  padding: 'var(--ogrid-cell-padding, 6px 10px)',
  overflow: 'hidden',
};

/** Prevents the default browser action for mouse events. */
export const PREVENT_DEFAULT = (e: React.MouseEvent): void => { e.preventDefault(); };

/** No-operation function. */
export const NOOP = (): void => {};

/** Stops event propagation (e.g. click on checkbox inside a row). */
export const STOP_PROPAGATION = (e: React.MouseEvent): void => { e.stopPropagation(); };
