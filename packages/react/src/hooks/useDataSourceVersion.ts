import { useIdentityVersion } from './useIdentityVersion';

/**
 * Two data source objects behave the same when they share a prototype and
 * every own property (methods and any state they read through `this`) is
 * identical. An inline `{ fetchPage }` around a stable function is therefore
 * the same source on every render; a class instance is compared by identity
 * unless its own fields all match too.
 */
export function isSameDataSource(prev: unknown, next: unknown): boolean {
  if (prev === next) return true;
  if (typeof prev !== 'object' || typeof next !== 'object' || prev === null || next === null) return false;
  if (Object.getPrototypeOf(prev) !== Object.getPrototypeOf(next)) return false;
  const prevKeys = Object.keys(prev);
  if (prevKeys.length !== Object.keys(next).length) return false;
  const a = prev as Record<string, unknown>;
  const b = next as Record<string, unknown>;
  for (const key of prevKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Effect dependency that changes when the grid should treat `dataSource` as a
 * new source (refetch, rebuild caches, reload filter options).
 *
 * - With `dataSourceKey`, only a change of the key counts. The source object
 *   itself may be recreated every render (inline methods included); the grid
 *   always calls the latest one.
 * - Without it, a source whose own properties are all identical to the
 *   previous render's is the same source; anything else counts as a swap
 *   (an inline object with inline functions at most once, see
 *   useIdentityVersion).
 */
export function useDataSourceVersion(dataSource: unknown, dataSourceKey?: string | number): string | number {
  const identityVersion = useIdentityVersion(dataSource, isSameDataSource);
  return dataSourceKey !== undefined ? `key:${typeof dataSourceKey}:${String(dataSourceKey)}` : identityVersion;
}
