import { useEffect } from 'react';
import { useLatestRef } from './useLatestRef';

/**
 * Snaps an internal page index back to the last page that has rows when the
 * row count shrinks underneath it. `target` comes from resolvePageClampTarget:
 * the page to snap to, or `null` when the page is fine. Without this the page
 * slice lands past the end and the grid renders no rows while pagination still
 * claims there is data.
 */
export function useOGridPageClamp(target: number | null, setPage: (page: number) => void): void {
  const setPageRef = useLatestRef(setPage);
  useEffect(() => {
    if (target !== null) setPageRef.current(target);
  }, [target, setPageRef]);
}
