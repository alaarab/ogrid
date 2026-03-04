/**
 * Shared utilities for boolean (checkbox) cell handling across all OGrid UI packages.
 *
 * The boolean cell pointerdown pattern repeats across React, Angular, and Vue:
 *   1. Stop propagation so the parent td's drag-select logic doesn't fire.
 *   2. Select the boolean cell (set active cell + selection range).
 *
 * Extracting this here lets each package call a single helper instead of
 * inlining the same three-step dance every time.
 *
 * Note: The vanilla JS package (TableRenderer.ts) uses a lower-level onCellMouseDown
 * callback interface that bundles selection into a single call. It doesn't use this
 * helper, but the stopPropagation step is still the same.
 */

import type { IActiveCell, ISelectionRange } from '../types';

/**
 * Callbacks that each UI package provides to select a cell in the grid.
 * These map directly to the interaction handles exposed by the state layer.
 */
export interface BooleanCellSelectHandlers {
  setActiveCell: (cell: IActiveCell | null) => void;
  setSelectionRange: (range: ISelectionRange | null) => void;
}

/**
 * Handle a pointerdown event on a boolean (checkbox) cell.
 *
 * Stops the event from bubbling to the parent td, which would otherwise start
 * a drag-select. Then selects the cell so the grid shows it as active.
 *
 * @param event - The native or synthetic pointer event from the checkbox.
 * @param rowIndex - Row index of the boolean cell.
 * @param globalColIndex - Global column index (includes checkbox/row-number offset).
 * @param colOffset - Number of pinned left columns (checkbox col + row numbers col).
 * @param handlers - Grid interaction callbacks for setting the active cell.
 *
 * @example
 * ```tsx
 * // React
 * onPointerDown={(e) =>
 *   handleBooleanCellPointerDown(e, descriptor.rowIndex, descriptor.globalColIndex, colOffset, {
 *     setActiveCell,
 *     setSelectionRange: (r) => interaction.setSelectionRange(r),
 *   })
 * }
 *
 * // Angular (in the component method)
 * onBooleanCheckboxPointerDown(event: PointerEvent, rowIndex: number, globalColIndex: number): void {
 *   handleBooleanCellPointerDown(event, rowIndex, globalColIndex, this.colOffset(), {
 *     setActiveCell: (c) => this.state().interaction.setActiveCell?.(c),
 *     setSelectionRange: (r) => this.state().interaction.setSelectionRange?.(r),
 *   });
 * }
 * ```
 */
export function handleBooleanCellPointerDown(
  event: { stopPropagation(): void },
  rowIndex: number,
  globalColIndex: number,
  colOffset: number,
  handlers: BooleanCellSelectHandlers,
): void {
  event.stopPropagation();
  const localCol = globalColIndex - colOffset;
  handlers.setActiveCell({ rowIndex, columnIndex: globalColIndex });
  handlers.setSelectionRange({
    startRow: rowIndex,
    startCol: localCol,
    endRow: rowIndex,
    endCol: localCol,
  });
}
