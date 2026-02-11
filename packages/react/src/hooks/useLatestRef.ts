import { useRef } from 'react';

/**
 * Returns a ref that always holds the latest value.
 * Useful for capturing volatile state in stable callbacks
 * without adding the value to dependency arrays.
 */
export function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
