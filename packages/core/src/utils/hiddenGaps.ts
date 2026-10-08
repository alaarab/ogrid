/**
 * Hidden rows and columns sit in "gaps" between the shown ones, the way a
 * spreadsheet draws a double line where hidden rows or columns are. These
 * helpers find the gaps and collect the hidden keys a selection spans.
 */

/** Where hidden keys sit relative to the shown keys. */
export interface IHiddenGaps<K> {
  /** Hidden keys right before each shown key (only shown keys with a gap before them). */
  before: Map<K, K[]>;
  /** Hidden keys after the last shown key. */
  after: K[];
  /** The last shown key (where the `after` gap is drawn); undefined when every key is hidden. */
  lastShown?: K;
}

/**
 * Groups the hidden keys of `ordered` by the shown key that follows them.
 * Hidden keys after the last shown key go to `after`.
 */
export function computeHiddenGaps<K>(ordered: readonly K[], isHidden: (key: K) => boolean): IHiddenGaps<K> {
  const before = new Map<K, K[]>();
  let pending: K[] = [];
  let lastShown: K | undefined;
  for (const key of ordered) {
    if (isHidden(key)) {
      pending.push(key);
      continue;
    }
    lastShown = key;
    if (pending.length > 0) {
      before.set(key, pending);
      pending = [];
    }
  }
  return lastShown === undefined ? { before, after: pending } : { before, after: pending, lastShown };
}

/**
 * The hidden keys inside a selection of shown keys `shown[start..end]`: the
 * gaps between the selected keys (selecting across hidden rows or columns
 * selects them too, as in Excel). A selection that starts at the first shown
 * key also takes the gap before it, and one that ends at `gaps.lastShown`
 * the gap after it, since nothing else can select across those. `shown` may
 * be one page of the shown keys.
 */
export function hiddenKeysInSpan<K>(gaps: IHiddenGaps<K>, shown: readonly K[], start: number, end: number): K[] {
  if (shown.length === 0) return [];
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(shown.length - 1, Math.max(start, end));
  const out: K[] = [];
  for (let i = lo === 0 ? 0 : lo + 1; i <= hi; i++) {
    const key = shown[i];
    const gap = key === undefined ? undefined : gaps.before.get(key);
    if (gap) out.push(...gap);
  }
  const last = shown[hi];
  if (last !== undefined && last === gaps.lastShown) out.push(...gaps.after);
  return out;
}

/**
 * The hidden keys right next to one shown key: the gap before it and, for the
 * last shown key, the gap after it. Used by "Unhide columns" in a column's
 * header menu.
 */
export function hiddenKeysAround<K>(gaps: IHiddenGaps<K>, shown: readonly K[], key: K): K[] {
  const index = shown.indexOf(key);
  if (index < 0) return [];
  const out = [...(gaps.before.get(key) ?? [])];
  const next = shown[index + 1];
  if (next !== undefined) out.push(...(gaps.before.get(next) ?? []));
  if (key === gaps.lastShown) out.push(...gaps.after);
  return out;
}
