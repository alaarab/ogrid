import { useState } from 'react';

/**
 * Number of sheets whose UI state is remembered. Sheet state is small (a few
 * sets and records), but a host that generates sheet ids dynamically would
 * otherwise grow the cache forever, so the least recently visited sheet is
 * evicted past this bound. Revisiting an evicted sheet just re-seeds it from
 * defaults, exactly like visiting it for the first time.
 */
const DEFAULT_MAX_REMEMBERED_SHEETS = 20;

export interface UseSheetScopedStateParams<S> {
  /** The `activeSheet` prop. `undefined` means the grid has no sheets at all. */
  activeSheet: string | undefined;
  /** State of the sheet being left, captured when the active sheet changes. */
  current: S;
  /** State to apply to a sheet being entered for the first time. */
  defaults: () => S;
  /** Writes a captured (or default) state back into the grid's state hooks. */
  apply: (state: S) => void;
  maxRememberedSheets?: number;
}

/**
 * Scopes a bundle of grid state to the active sheet.
 *
 * Switching sheets swaps both the columns and the rows underneath state that is
 * keyed on them, so carrying that state across a switch is wrong in both
 * directions: the incoming sheet inherits filters, a sort field, a page index
 * and row ids that mean nothing to it, and the outgoing sheet loses choices the
 * user deliberately made. This captures the state of the sheet being left and
 * restores whatever the sheet being entered had last time (or its defaults, the
 * first time it is seen).
 *
 * The swap happens during render, not in an effect, so the grid never commits a
 * frame showing the previous sheet's state applied to the new sheet's data.
 *
 * A grid with no sheets (`activeSheet` undefined) never sees a sheet change, so
 * this hook does nothing at all for it.
 */
export function useSheetScopedState<S>(params: UseSheetScopedStateParams<S>): void {
  const {
    activeSheet,
    current,
    defaults,
    apply,
    maxRememberedSheets = DEFAULT_MAX_REMEMBERED_SHEETS,
  } = params;

  // Held as state, not a ref, so the capture/restore is a render-phase state
  // update React can replay rather than a side effect written during render.
  const [tracked, setTracked] = useState<{
    sheet: string | undefined;
    saved: ReadonlyMap<string, S>;
  }>(() => ({ sheet: activeSheet, saved: new Map() }));

  if (activeSheet === tracked.sheet) return;

  const saved = new Map(tracked.saved);

  // Deleting before setting moves the entry to the end of the Map's iteration
  // order, so the eviction below drops the least recently visited sheet.
  if (tracked.sheet !== undefined) {
    saved.delete(tracked.sheet);
    saved.set(tracked.sheet, current);
  }

  // Take the incoming sheet's entry out of the cache before trimming: it is the
  // most recently used of all, and it goes back in when the user leaves it.
  const restored = activeSheet === undefined ? undefined : saved.get(activeSheet);
  if (activeSheet !== undefined) saved.delete(activeSheet);

  while (saved.size > maxRememberedSheets) {
    const oldest = saved.keys().next().value;
    if (oldest === undefined) break;
    saved.delete(oldest);
  }
  setTracked({ sheet: activeSheet, saved });

  if (activeSheet !== undefined) apply(restored ?? defaults());
}
