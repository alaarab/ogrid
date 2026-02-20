import { customRef, isRef, unref, type Ref, type ShallowRef } from 'vue';

/** Accept either Ref or ShallowRef for state fields */
export type MaybeShallowRef<T> = Ref<T> | ShallowRef<T>;

/**
 * Returns a ref that always holds the latest value.
 * Useful for capturing volatile state in stable callbacks
 * without adding the value to reactive dependencies.
 *
 * Similar to React's useLatestRef, but uses Vue's customRef for synchronous updates.
 * The returned ref does NOT trigger reactivity when read - it's a "silent" ref
 * that always returns the current value without tracking dependencies.
 */
export function useLatestRef<T>(source: Ref<T> | T): Ref<T> {
  let value = unref(source);

  return customRef((track, trigger) => ({
    get() {
      // Update value from source on every read (if source is a ref)
      if (isRef(source)) {
        value = source.value;
      }
      // Don't call track() - we don't want to add this to reactive dependencies
      return value;
    },
    set(newValue) {
      value = newValue;
      trigger(); // Still allow setting and triggering if needed
    },
  }));
}

