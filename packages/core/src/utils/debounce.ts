/**
 * Debounces a function call, delaying execution until after `delayMs` milliseconds
 * have elapsed since the last invocation.
 *
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function with a `cancel` method
 *
 * @example
 * ```typescript
 * const search = debounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 *
 * search('a');
 * search('ab');
 * search('abc'); // Only this will execute after 300ms
 *
 * search.cancel(); // Cancel pending execution
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
