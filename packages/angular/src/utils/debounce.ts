/**
 * Debounce utilities for Angular using signals.
 * Provides functional parity with React's useDebounce and useDebouncedCallback.
 */

import { signal, effect, type Signal } from '@angular/core';

/**
 * Creates a debounced signal that updates after the specified delay when the source value changes.
 *
 * @param source - The signal to debounce
 * @param delayMs - Delay in milliseconds
 * @returns A signal containing the debounced value
 *
 * @example
 * ```typescript
 * const searchQuery = signal('');
 * const debouncedQuery = createDebouncedSignal(searchQuery, 300);
 *
 * effect(() => {
 *   console.log('Debounced search:', debouncedQuery());
 * });
 * ```
 */
export function createDebouncedSignal<T>(source: Signal<T>, delayMs: number): Signal<T> {
  const debouncedValue = signal(source());

  effect((onCleanup) => {
    const currentValue = source();
    const timeoutId = setTimeout(() => {
      debouncedValue.set(currentValue);
    }, delayMs);

    onCleanup(() => clearTimeout(timeoutId));
  });

  return debouncedValue;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after `delayMs` milliseconds have elapsed since the last time it was invoked.
 *
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns A debounced version of the function
 *
 * @example
 * ```typescript
 * const saveData = (value: string) => {
 *   console.log('Saving:', value);
 * };
 *
 * const debouncedSave = createDebouncedCallback(saveData, 500);
 *
 * // Multiple rapid calls will only trigger once after 500ms
 * debouncedSave('hello');
 * debouncedSave('world');  // Only this will execute after 500ms
 * ```
 */
export function createDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  }) as T;
}

/**
 * Simple debounce function (non-Angular-specific, can be used anywhere).
 * Returns a debounced version of the provided function.
 *
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns A debounced version of the function with a `cancel()` method
 *
 * @example
 * ```typescript
 * const handleResize = debounce(() => {
 *   console.log('Window resized');
 * }, 200);
 *
 * window.addEventListener('resize', handleResize);
 *
 * // Later, cancel pending execution
 * handleResize.cancel();
 * ```
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
