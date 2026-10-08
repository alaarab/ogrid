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

/** One sort level (structurally the same as `ISortModelItem` in the types module). */
type SortLevel = { field: string; direction: 'asc' | 'desc' };

export interface ComputeNextSortModelOptions {
  /**
   * Add to (or change) the existing levels instead of replacing them: Shift+click
   * on a header, or the column menu's "Add to sort". Default: false.
   */
  additive?: boolean;
}

/**
 * Normalize a sort input to an ordered list of levels: accepts a field id (with
 * an optional direction, default ascending) or a list of levels. Empty fields
 * are dropped and a field listed twice keeps only its first (higher-priority) level.
 */
export function normalizeSortModel(
  sortBy?: string | readonly SortLevel[] | null,
  sortDirection?: 'asc' | 'desc',
): SortLevel[] {
  if (!sortBy) return [];
  if (typeof sortBy === 'string') return [{ field: sortBy, direction: sortDirection === 'desc' ? 'desc' : 'asc' }];
  const seen = new Set<string>();
  const out: SortLevel[] = [];
  for (const level of sortBy) {
    if (!level?.field || seen.has(level.field)) continue;
    seen.add(level.field);
    out.push({ field: level.field, direction: level.direction === 'desc' ? 'desc' : 'asc' });
  }
  return out;
}

/** Stable string key for a sort model (for effect/memo dependencies). */
export function sortModelKey(model: readonly SortLevel[]): string {
  return model.map((level) => `${level.field}\u0000${level.direction}`).join('\u0001');
}

/**
 * Compute the next multi-level sort model for a sort request.
 *
 * Plain (non-additive) requests behave like `computeNextSortState` and leave a
 * single level: toggling flips the primary column's direction (a new column
 * starts ascending), an explicit direction sets it, and `null` clears the sort.
 *
 * Additive requests keep the other levels: toggling a column already in the
 * model cycles it ascending -> descending -> removed, a new column is appended
 * ascending, and an explicit direction updates the level in place (or appends it).
 *
 * `null` on a multi-level model removes just that column's level, so the column
 * menu's "Clear sort" doesn't drop the other levels.
 */
export function computeNextSortModel(
  current: readonly SortLevel[],
  columnKey: string,
  direction?: 'asc' | 'desc' | null,
  options?: ComputeNextSortModelOptions,
): SortLevel[] {
  const model = normalizeSortModel(current);
  const index = model.findIndex((level) => level.field === columnKey);
  const additive = options?.additive === true;

  if (direction === null) {
    if (model.length > 1 && index >= 0) return model.filter((_, i) => i !== index);
    if (additive && index < 0) return model;
    return [];
  }

  if (!additive) {
    if (direction) return [{ field: columnKey, direction }];
    const primary = model[0];
    return [{
      field: columnKey,
      direction: primary?.field === columnKey && primary.direction === 'asc' ? 'desc' : 'asc',
    }];
  }

  if (direction) {
    if (index < 0) return [...model, { field: columnKey, direction }];
    return model.map((level, i) => (i === index ? { field: columnKey, direction } : level));
  }
  if (index < 0) return [...model, { field: columnKey, direction: 'asc' }];
  if (model[index]?.direction === 'asc') {
    return model.map((level, i) => (i === index ? { field: columnKey, direction: 'desc' } : level));
  }
  return model.filter((_, i) => i !== index);
}
