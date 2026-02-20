/**
 * Pure selection helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies — operates only on plain ISelectionRange values.
 */
import type { ISelectionRange } from '../types/dataGridTypes';

// Re-export normalizeSelectionRange from its canonical location for convenience.
// The original definition lives in dataGridTypes.ts and is preserved there
// to avoid breaking existing imports.
export { normalizeSelectionRange } from '../types/dataGridTypes';

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

/**
 * Apply a shift-click range selection to a set of row IDs.
 * Used by React `useRowSelection`, Vue `useRowSelection`, and JS `RowSelectionState`.
 *
 * @param start       Start index of the range (inclusive).
 * @param end         End index of the range (inclusive).
 * @param checked     Whether to add (true) or remove (false) the rows.
 * @param items       Array of all row data objects.
 * @param getRowId    Function to extract a unique row ID from an item.
 * @param currentSelection  Current set of selected row IDs (will be shallow-copied).
 * @returns A new Set of selected row IDs after applying the range.
 */
export function applyRangeRowSelection<T>(
  start: number,
  end: number,
  checked: boolean,
  items: T[],
  getRowId: (item: T) => string | number,
  currentSelection: Set<string | number>
): Set<string | number> {
  const next = new Set(currentSelection);
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  for (let i = lo; i <= hi; i++) {
    if (i < items.length) {
      const id = getRowId(items[i]);
      if (checked) next.add(id);
      else next.delete(id);
    }
  }
  return next;
}

/**
 * Compute the allSelected / someSelected state from a set of selected row IDs.
 * Used by React `useRowSelection`, Vue `useRowSelection`, and JS `RowSelectionState`.
 *
 * @param selectedIds  Current set of selected row IDs.
 * @param items        Array of all row data objects.
 * @param getRowId     Function to extract a unique row ID from an item.
 * @returns An object with `allSelected` and `someSelected` booleans.
 */
export function computeRowSelectionState<T>(
  selectedIds: Set<string | number>,
  items: T[],
  getRowId: (item: T) => string | number
): { allSelected: boolean; someSelected: boolean } {
  if (selectedIds.size === 0 || items.length === 0) {
    return { allSelected: false, someSelected: false };
  }
  const allSelected = items.every((item) => selectedIds.has(getRowId(item)));
  const someSelected = !allSelected && selectedIds.size > 0;
  return { allSelected, someSelected };
}
