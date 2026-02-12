import { type Ref } from 'vue';
/**
 * Returns a debounced ref that updates after the specified delay when the source value changes.
 */
export declare function useDebounce<T>(value: Ref<T>, delayMs: number): Ref<T>;
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
export declare function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delayMs: number): DebouncedFn<T>;
