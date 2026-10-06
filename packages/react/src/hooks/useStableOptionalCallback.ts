import { useMemo } from 'react';
import { useLatestRef } from './useLatestRef';

/**
 * Stabilizes an optional consumer callback.
 *
 * Invalidation rule: the returned function's identity changes only when the
 * callback goes from absent to present (or back), never when the consumer
 * passes a new inline function. Calls always reach the latest callback. While
 * the callback is absent the result is `undefined`, so downstream "is a
 * handler supplied?" checks keep working.
 *
 * When `counter` is given, every call bumps it first (used to tell the data
 * pipeline that the next data change is the host applying a grid edit).
 */
export function useStableOptionalCallback<A extends unknown[], R>(
  callback: ((...args: A) => R) | undefined,
  counter?: { current: number },
): ((...args: A) => R | undefined) | undefined {
  const callbackRef = useLatestRef(callback);
  const hasCallback = callback != null;
  return useMemo(
    () => hasCallback
      ? (...args: A) => {
        if (counter) counter.current++;
        return callbackRef.current?.(...args);
      }
      : undefined,
    [hasCallback, callbackRef, counter],
  );
}
