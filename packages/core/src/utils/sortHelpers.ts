/**
 * Sort state computation helpers shared across all frameworks.
 */

export interface ISortState {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Compute the next sort state given the current state and a sort request.
 *
 * @param current - Current sort state
 * @param columnKey - Column being sorted
 * @param direction - Explicit direction, `null` to clear, or `undefined` to toggle
 * @returns New sort state
 */
export function computeNextSortState(
  current: ISortState,
  columnKey: string,
  direction?: 'asc' | 'desc' | null
): ISortState {
  if (direction === null) {
    // Clear sort
    return { field: '', direction: 'asc' };
  } else if (direction) {
    // Explicit direction (from column menu)
    return { field: columnKey, direction };
  } else {
    // Toggle (existing behavior for header click)
    return {
      field: columnKey,
      direction:
        current.field === columnKey && current.direction === 'asc' ? 'desc' : 'asc',
    };
  }
}
