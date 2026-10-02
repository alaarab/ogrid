/**
 * Sort/filter primitives shared by the main-thread path (utils/clientSideData)
 * and the Web Worker (workers/sortFilterWorker).
 *
 * The worker runs from a Blob built out of `Function.prototype.toString()`, so
 * it can't import modules. Instead, `SORT_FILTER_PRIMITIVES` is serialized into
 * the Blob ahead of the worker body. That only works because these are plain
 * `function` declarations: they keep their (possibly minified) names when
 * stringified, and they reference nothing but each other and globals.
 * Keep it that way: no imports, no closures, no arrow-function constants.
 */

/**
 * Timestamp for a date-column cell value (NaN when missing or invalid).
 * Bare `YYYY-MM-DD` strings are read as UTC midnight to match date display
 * and UTC filter bounds. Dates and numeric timestamps represent instants.
 */
export function toDateTimestamp(value: unknown): number {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(String(value)).getTime();
}

/**
 * Default (no custom `compare`, non-date) sort key: numbers as-is, everything
 * else lowercased text, null/undefined as `undefined`.
 */
export function toSortKey(value: unknown): string | number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return value;
  return String(value).toLowerCase();
}

/** Create once per execution context so comparisons reuse the locale collator. */
export function createSortCollator(): Intl.Collator {
  return new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Ascending total order over sort keys: missing values first, then numbers
 * (numerically), then text (locale-aware, with numeric strings in natural order).
 */
export function compareSortKeys(a: string | number | undefined, b: string | number | undefined, collator: Intl.Collator): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? -1 : 1;
  const an = typeof a === 'number';
  const bn = typeof b === 'number';
  if (an !== bn) return an ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
  return a === b ? 0 : a > b ? 1 : -1;
}

/** Ascending order over timestamps: invalid/missing (NaN) first. */
export function compareTimestamps(a: number, b: number): number {
  const an = Number.isNaN(a);
  const bn = Number.isNaN(b);
  if (an || bn) return an && bn ? 0 : an ? -1 : 1;
  return a === b ? 0 : a > b ? 1 : -1;
}

/** Serialized ahead of the worker body; see the file comment. */
export const SORT_FILTER_PRIMITIVES = [toDateTimestamp, toSortKey, createSortCollator, compareSortKeys, compareTimestamps];
