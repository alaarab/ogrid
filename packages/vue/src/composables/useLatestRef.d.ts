import { type Ref } from 'vue';
/**
 * Returns a ref that always holds the latest value.
 * Useful for capturing volatile state in stable callbacks
 * without adding the value to reactive dependencies.
 *
 * Similar to React's useLatestRef, but uses Vue's customRef for synchronous updates.
 * The returned ref does NOT trigger reactivity when read - it's a "silent" ref
 * that always returns the current value without tracking dependencies.
 */
export declare function useLatestRef<T>(source: Ref<T> | T): Ref<T>;
