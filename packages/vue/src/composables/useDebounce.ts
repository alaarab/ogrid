import { ref, watch, onUnmounted, type Ref } from 'vue';

/**
 * Returns a debounced ref that updates after the specified delay when the source value changes.
 */
export function useDebounce<T>(value: Ref<T>, delayMs: number): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  watch(value, (newVal) => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedValue.value = newVal;
    }, delayMs);
  });

  onUnmounted(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });

  return debouncedValue;
}

export interface DebouncedFn<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  /** Cancel the pending invocation. */
  cancel: () => void;
  /** Execute the pending invocation immediately (no-op if nothing pending). */
  flush: () => void;
}

/**
 * Returns a stable callback that invokes the given function after the specified delay.
 * Each new call resets the timer. Includes `.cancel()` and `.flush()` methods.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): DebouncedFn<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let latestFn = fn;
  let latestArgs: Parameters<T> | undefined;

  const debounced = ((...args: Parameters<T>) => {
    latestFn = fn;
    latestArgs = args;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      latestFn(...args);
      latestArgs = undefined;
      timeoutId = undefined;
    }, delayMs);
  }) as DebouncedFn<T>;

  debounced.cancel = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = undefined;
    latestArgs = undefined;
  };

  debounced.flush = () => {
    if (timeoutId !== undefined && latestArgs !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
      const args = latestArgs;
      latestArgs = undefined;
      latestFn(...args);
    }
  };

  onUnmounted(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });

  return debounced;
}
