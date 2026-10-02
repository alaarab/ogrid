import { useMemo, useRef } from 'react';
import { getHeaderFilterConfig } from '../utils';
import type { HeaderFilterConfig, HeaderFilterConfigInput } from '../utils';
import type { IColumnDef } from '../types';

interface CachedConfig<T> {
  col: IColumnDef<T>;
  input: HeaderFilterConfigInput;
  config: HeaderFilterConfig;
}

/** Same values, ignoring closures (callers check what the closures capture). Empty arrays match. */
function sameConfigValues(a: HeaderFilterConfig, b: HeaderFilterConfig): boolean {
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  for (const key of keys) {
    const va = ra[key];
    const vb = rb[key];
    if (va === vb || typeof va === 'function') continue;
    if (Array.isArray(va) && Array.isArray(vb) && va.length === 0 && vb.length === 0) continue;
    return false;
  }
  return true;
}

/**
 * Per-column ColumnHeaderFilter props, keyed by columnId. A column's config
 * keeps its identity until its own sort/filter/options change, so the kits'
 * memoized ColumnHeaderFilter skips re-rendering on unrelated grid renders.
 */
export function useHeaderFilterConfigs<T>(
  visibleCols: IColumnDef<T>[],
  input: HeaderFilterConfigInput,
): Map<string, HeaderFilterConfig> {
  const cacheRef = useRef<Map<string, CachedConfig<T>>>(new Map());
  return useMemo(() => {
    const prevCache = cacheRef.current;
    const nextCache = new Map<string, CachedConfig<T>>();
    const configs = new Map<string, HeaderFilterConfig>();
    for (const col of visibleCols) {
      let config = getHeaderFilterConfig(col, input);
      const prev = prevCache.get(col.columnId);
      // The config's closures capture only the column and the input's handlers.
      if (
        prev &&
        prev.col === col &&
        prev.input.onColumnSort === input.onColumnSort &&
        prev.input.onFilterChange === input.onFilterChange &&
        sameConfigValues(prev.config, config)
      ) {
        config = prev.config;
      }
      nextCache.set(col.columnId, { col, input, config });
      configs.set(col.columnId, config);
    }
    cacheRef.current = nextCache;
    return configs;
  }, [visibleCols, input]);
}
