/**
 * Pure selection helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies — operates only on plain ISelectionRange values.
 */
import type { ISelectionRange } from '../types/dataGridTypes';

/**
 * Compare two selection ranges by value (deep equality).
 * Returns true if both ranges are equal, including when both are null.
 */
export function rangesEqual(
  a: ISelectionRange | null,
  b: ISelectionRange | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.startRow === b.startRow &&
    a.endRow === b.endRow &&
    a.startCol === b.startCol &&
    a.endCol === b.endCol
  );
}

/**
 * Clamp a selection range to the grid bounds (0-based, inclusive).
 *
 * @param range         The selection range to clamp.
 * @param maxRow        Maximum valid row index (items.length - 1).
 * @param maxCol        Maximum valid column index (visibleCols.length - 1).
 * @returns The clamped range, or null if the grid is empty.
 */
export function clampSelectionToBounds(
  range: ISelectionRange,
  maxRow: number,
  maxCol: number
): ISelectionRange | null {
  if (maxRow < 0 || maxCol < 0) return null;
  return {
    startRow: Math.max(0, Math.min(range.startRow, maxRow)),
    endRow: Math.max(0, Math.min(range.endRow, maxRow)),
    startCol: Math.max(0, Math.min(range.startCol, maxCol)),
    endCol: Math.max(0, Math.min(range.endCol, maxCol)),
  };
}

/**
 * Auto-scroll speed: proportional to how far past the scroll edge the pointer is.
 * Used by drag-selection auto-scroll in both React and Vue.
 *
 * @param distance  Distance past the edge threshold (pixels).
 * @param edgePx    Scroll edge threshold in pixels (default: 40).
 * @param minSpeed  Minimum scroll speed (default: 2).
 * @param maxSpeed  Maximum scroll speed (default: 20).
 * @returns Scroll speed in pixels per interval tick.
 */
export function computeAutoScrollSpeed(
  distance: number,
  edgePx = 40,
  minSpeed = 2,
  maxSpeed = 20
): number {
  const t = Math.min(distance / edgePx, 1);
  return minSpeed + t * (maxSpeed - minSpeed);
}
