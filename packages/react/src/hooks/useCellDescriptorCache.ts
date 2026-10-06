import { useRef } from 'react';
import { CellDescriptorCache } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
import type { CellRenderDescriptorInput } from '../utils';

/**
 * One descriptor cache per grid lifetime, keyed by (rowIndex * stride + colIdx),
 * storing descriptor + volatile version string. It skips recomputation for
 * cells whose selection/editing state hasn't changed since the last render.
 *
 * Invalidation rules, applied synchronously during render so renderCellContent
 * (which reads the cache in the same render) sees them:
 * - the version is recomputed from the descriptor input's volatile fields
 *   every render;
 * - the cache is cleared when `items` or `visibleCols` change identity: new
 *   items may carry new data, and new visible columns shift column indices,
 *   so cached descriptors with a stale colIdx would be wrong.
 */
export function useCellDescriptorCache<T>(
  cellDescriptorInput: CellRenderDescriptorInput<T>,
  items: readonly T[],
  visibleCols: readonly unknown[],
) {
  const cellDescriptorInputRef = useLatestRef(cellDescriptorInput);
  const cellDescriptorCacheRef = useRef<CellDescriptorCache>(new CellDescriptorCache());
  cellDescriptorCacheRef.current.updateVersion(CellDescriptorCache.computeVersion(cellDescriptorInput));

  const prevItemsRef = useRef(items);
  const prevVisibleColsRef = useRef(visibleCols);
  if (prevItemsRef.current !== items || prevVisibleColsRef.current !== visibleCols) {
    prevItemsRef.current = items;
    prevVisibleColsRef.current = visibleCols;
    cellDescriptorCacheRef.current.clear();
  }
  return { cellDescriptorInputRef, cellDescriptorCacheRef };
}
