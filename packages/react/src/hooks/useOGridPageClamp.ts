import { useEffect } from 'react';
import { useLatestRef } from './useLatestRef';
import { resolvePageClamp } from './ogridDerivations';
import type { PageClampInput } from './ogridDerivations';

/**
 * Snaps an internal page index back to the last page that has rows when the
 * row count shrinks underneath it (see resolvePageClamp). Without this the
 * page slice lands past the end and the grid renders no rows while pagination
 * still claims there is data.
 */
export function useOGridPageClamp(input: PageClampInput, setPage: (page: number) => void): void {
  const { lastPage, isPagePastEnd } = resolvePageClamp(input);
  const setPageRef = useLatestRef(setPage);
  useEffect(() => {
    if (isPagePastEnd) setPageRef.current(lastPage);
  }, [isPagePastEnd, lastPage, setPageRef]);
}
