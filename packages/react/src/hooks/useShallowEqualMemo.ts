import { useRef } from 'react';

/**
 * Returns a referentially stable value as long as the comparator considers
 * the new value equal to the previous one.  Unlike the broken
 * `useMemo` + `useRef` + `useEffect` pattern, this works correctly because
 * it compares *before* React's own reference check on the dependency array.
 */
export function useShallowEqualMemo<T>(
  value: T,
  isEqual: (a: T, b: T) => boolean
): T {
  const ref = useRef(value);
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}
