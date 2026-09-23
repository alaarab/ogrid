import { useEffect, useState } from 'react';

const query = '(pointer: coarse)';
const matches = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;

/**
 * Keep virtual row spacing in sync with the touch-target CSS media query.
 *
 * useState + useEffect rather than useSyncExternalStore so the kit keeps
 * working on its declared React 17 peer. Starts false (the server snapshot)
 * and corrects after mount, so hydration matches.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const media = typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined;
    setCoarse(matches());
    if (!media) return;
    const onChange = () => setCoarse(matches());
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return coarse;
}
