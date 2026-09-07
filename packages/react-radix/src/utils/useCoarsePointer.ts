import { useSyncExternalStore } from 'react';

const query = '(pointer: coarse)';
const getSnapshot = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
const getServerSnapshot = () => false;
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia?.(query);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};

/** Keep virtual row spacing in sync with the touch-target CSS media query. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
