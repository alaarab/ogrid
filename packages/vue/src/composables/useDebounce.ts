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

/**
 * Returns a stable callback that invokes the given function after the specified delay.
 * Each new call resets the timer.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  // Keep a reference to the latest fn
  let latestFn = fn;

  const debounced = ((...args: Parameters<T>) => {
    latestFn = fn;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      latestFn(...args);
    }, delayMs);
  }) as T;

  onUnmounted(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });

  return debounced;
}
