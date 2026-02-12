/**
 * Latest ref utility for Angular using signals.
 * Provides functional parity with React's useLatestRef.
 */

import { type Signal } from '@angular/core';

/**
 * Creates a stable wrapper function that always calls the latest version of the provided function.
 * Useful for event handlers and callbacks where you want a stable reference but need to call
 * the latest implementation.
 *
 * @param fn - Signal containing the function to wrap
 * @returns A stable function that always invokes the latest version
 *
 * @example
 * ```typescript
 * class MyService {
 *   readonly onSave = signal<(value: string) => void>((val) => console.log('Default:', val));
 *   readonly stableOnSave = createLatestCallback(this.onSave);
 *
 *   constructor() {
 *     // Setup event listener with stable reference
 *     effect((onCleanup) => {
 *       // stableOnSave never changes, so this effect only runs once
 *       const callback = () => this.stableOnSave('data');
 *       window.addEventListener('click', callback);
 *       onCleanup(() => window.removeEventListener('click', callback));
 *     });
 *   }
 *
 *   updateHandler(newFn: (value: string) => void) {
 *     // Even though we change the function, the callback reference stays stable
 *     this.onSave.set(newFn);
 *   }
 * }
 * ```
 */
export function createLatestCallback<T extends (...args: unknown[]) => unknown>(
  fn: Signal<T>
): T {
  // Return a stable function that always calls the current value of the signal
  return ((...args: Parameters<T>) => {
    return fn()(...args);
  }) as T;
}

/**
 * Alias for createLatestCallback for consistency with React/Vue naming.
 * @deprecated Use createLatestCallback instead
 */
export const createLatestRef = createLatestCallback;
