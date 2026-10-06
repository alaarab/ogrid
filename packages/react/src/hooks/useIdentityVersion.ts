import { useEffect, useRef, useState } from 'react';

/**
 * Returns a number that increments when `value` is swapped for a different
 * object after having been referentially stable across a render.
 *
 * Use it as an effect dependency for props like `dataSource` that are held in
 * a ref to tolerate inline objects: an inline object changes identity on every
 * render, so it bumps the version at most once and can't cause a fetch loop,
 * while a memoized object that is deliberately replaced bumps it every time.
 *
 * `isSame` widens "the same value" beyond identity (e.g. an inline object
 * whose properties are all identical to the previous one's).
 */
export function useIdentityVersion<V>(value: V, isSame?: (prev: V, next: V) => boolean): number {
  const [version, setVersion] = useState(0);
  const lastRef = useRef(value);
  const stableRef = useRef(true);

  // Runs after every render on purpose: it compares identities across renders.
  useEffect(() => {
    if (value === lastRef.current || isSame?.(lastRef.current, value)) {
      lastRef.current = value;
      stableRef.current = true;
      return;
    }
    const wasStable = stableRef.current;
    lastRef.current = value;
    stableRef.current = false;
    if (wasStable) setVersion((v) => v + 1);
  });

  return version;
}
