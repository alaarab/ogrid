/**
 * Row-order snapshot for client-side processing.
 *
 * The grid applies sort + filters as a snapshot (Excel-like): after the user
 * sorts, later data changes keep the visual order until the user sorts or
 * filters again. These pure helpers decide whether a data change keeps the
 * snapshot and how to apply it to the new data.
 *
 * Two snapshot shapes:
 * - `ids` (when `getRowId` is provided and ids are unique): the ordered list of
 *   visible row ids plus the set of every id in the last processed dataset.
 *   Rows are looked up by id, so inserts and deletes keep the edit order:
 *   surviving ids stay put, deleted ids drop out, and new ids are appended in
 *   source order once they pass the current filters.
 * - `indices` (no `getRowId`, or duplicate ids): positions into the source
 *   array. Only same-length, same-position changes keep this snapshot.
 */

export interface IndexSnapshot<T> {
  readonly kind: 'indices';
  /** Source array the snapshot was last applied to. */
  readonly data: readonly T[];
  /** Positions into `data` of the visible rows, in display order. */
  readonly indices: readonly number[];
  /** Visible rows for `data`, in display order. */
  readonly rows: T[];
}

export interface IdSnapshot<T> {
  readonly kind: 'ids';
  /** Source array the snapshot was last applied to. */
  readonly data: readonly T[];
  /** Ids of the visible rows, in display order. */
  readonly ids: readonly unknown[];
  /** Every id in `data` (visible or filtered out), so new ids can be told apart from hidden ones. */
  readonly knownIds: ReadonlySet<unknown>;
  /** Visible rows for `data`, in display order. */
  readonly rows: T[];
}

export type RowOrderSnapshot<T> = IndexSnapshot<T> | IdSnapshot<T>;

/**
 * True when `next` looks like `prev` after in-place cell edits (same rows at
 * the same positions) rather than a different dataset. Used for index
 * snapshots: any length change is a different dataset.
 */
export function isSameRowSet<T>(
  prev: readonly T[],
  next: readonly T[],
  getRowId: ((row: T) => unknown) | undefined,
  editPending: boolean,
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  let shared = 0;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) {
      shared++;
      continue;
    }
    if (getRowId && a !== undefined && b !== undefined && getRowId(a) !== getRowId(b)) return false;
  }
  // An edit replaces some row objects while others stay reference-equal; a new
  // dataset (even one with matching ids) replaces all of them, unless the grid
  // just emitted edits that the host applied by rebuilding every row.
  return next.length === 0 || shared > 0 || (getRowId !== undefined && editPending);
}

/**
 * True when `next` looks like `prev` after edits, inserts or deletes rather
 * than a fresh dataset: some row object survives by reference (immutable
 * updates touch only the edited rows), or the grid just emitted an edit that
 * the host applied by rebuilding every row. Positions may shift, so this
 * matches by reference anywhere, not per position. A host that rebuilds every
 * row without a grid edit (polling refresh) is a fresh dataset.
 */
export function isEditLikeChange<T>(prev: readonly T[], next: readonly T[], editPending: boolean): boolean {
  if (prev === next) return true;
  if (next.length === 0 || editPending) return true;
  if (prev.length === 0) return false;
  const nextRows = new Set<T>(next);
  for (const row of prev) {
    if (nextRows.has(row)) return true;
  }
  return false;
}

/**
 * Whether a data change (same sort, filters and columns) keeps `snapshot`.
 * A `null` snapshot (not built yet) can't be kept.
 */
export function keepsSnapshot<T>(
  snapshot: RowOrderSnapshot<T> | null,
  prev: readonly T[],
  next: readonly T[],
  getRowId: ((row: T) => unknown) | undefined,
  editPending: boolean,
): boolean {
  if (snapshot === null) return false;
  if (snapshot.kind === 'ids' && getRowId !== undefined) return isEditLikeChange(prev, next, editPending);
  return isSameRowSet(prev, next, getRowId, editPending);
}

/**
 * Maps processed (filtered + sorted) rows back to their positions in `source`.
 * A row reference that appears more than once keeps one position per occurrence
 * (the processing sort is stable, so occurrences come back in source order).
 */
export function rowsToIndices<T>(source: readonly T[], rows: readonly T[]): number[] {
  const positions = new Map<T, number[]>();
  for (let i = 0; i < source.length; i++) {
    const row = source[i];
    if (row === undefined) continue;
    const list = positions.get(row);
    if (list) list.push(i);
    else positions.set(row, [i]);
  }
  const cursor = new Map<T, number>();
  const indices: number[] = [];
  for (const row of rows) {
    const list = positions.get(row);
    if (!list) continue;
    const n = cursor.get(row) ?? 0;
    const idx = list[Math.min(n, list.length - 1)];
    cursor.set(row, n + 1);
    if (idx !== undefined) indices.push(idx);
  }
  return indices;
}

/**
 * Maps `data` to id -> row. Returns `null` when two rows share an id (or a
 * row is `undefined`): id lookups would be ambiguous, so callers fall back to
 * index snapshots / a full re-sort.
 */
function indexById<T>(data: readonly T[], getRowId: (row: T) => unknown): Map<unknown, T> | null {
  const byId = new Map<unknown, T>();
  for (const row of data) {
    if (row === undefined) return null;
    const id = getRowId(row);
    if (byId.has(id)) return null;
    byId.set(id, row);
  }
  return byId;
}

/**
 * Builds the snapshot for `rows`, the fully processed (filtered + sorted) view
 * of `data`. Prefers an id snapshot when `getRowId` is given and ids are
 * unique; otherwise stores positions.
 */
export function createSnapshot<T>(
  data: readonly T[],
  rows: T[],
  getRowId: ((row: T) => unknown) | undefined,
): RowOrderSnapshot<T> {
  if (getRowId !== undefined) {
    const byId = indexById(data, getRowId);
    if (byId !== null) {
      return { kind: 'ids', data, ids: rows.map(getRowId), knownIds: new Set(byId.keys()), rows };
    }
  }
  return { kind: 'indices', data, indices: rowsToIndices(data, rows), rows };
}

/**
 * Applies a kept snapshot to `data` (the changed dataset) without re-sorting.
 *
 * - Index snapshot: the same positions, now pointing at the current row objects.
 * - Id snapshot: surviving ids in snapshot order with their current row objects;
 *   missing ids dropped; ids not seen before appended in source order after
 *   `filterRows` (the current filters) keeps them. Rows that were filtered out
 *   before stay hidden until the user re-filters, like edited rows that no
 *   longer match.
 *
 * Returns `null` when the snapshot can't be applied and the caller must run a
 * full re-sort: duplicate ids in `data`, `getRowId` no longer provided, or no
 * id of the previous dataset survives (a different dataset, not an edit).
 */
export function applySnapshot<T>(
  snapshot: RowOrderSnapshot<T>,
  data: readonly T[],
  getRowId: ((row: T) => unknown) | undefined,
  filterRows: (rows: T[]) => T[],
): { rows: T[]; snapshot: RowOrderSnapshot<T> } | null {
  if (snapshot.data === data) return { rows: snapshot.rows, snapshot };

  if (snapshot.kind === 'indices') {
    const rows: T[] = [];
    for (const idx of snapshot.indices) {
      const row = data[idx];
      if (row !== undefined) rows.push(row);
    }
    return { rows, snapshot: { ...snapshot, data, rows } };
  }

  if (getRowId === undefined) return null;
  const byId = indexById(data, getRowId);
  if (byId === null) return null;

  const ids: unknown[] = [];
  const rows: T[] = [];
  for (const id of snapshot.ids) {
    const row = byId.get(id);
    if (row === undefined) continue;
    ids.push(id);
    rows.push(row);
  }

  const added: T[] = [];
  let overlap = rows.length > 0;
  for (const [id, row] of byId) {
    if (snapshot.knownIds.has(id)) overlap = true;
    else added.push(row);
  }
  // Nothing carried over from the previous dataset: a replacement (or the
  // first load), not an edit.
  if (!overlap && byId.size > 0) return null;

  if (added.length > 0) {
    for (const row of filterRows(added)) {
      ids.push(getRowId(row));
      rows.push(row);
    }
  }

  return { rows, snapshot: { kind: 'ids', data, ids, knownIds: new Set(byId.keys()), rows } };
}

/**
 * Inputs whose change always means a full re-sort. `sortField`/`sortDirection`
 * sit beside `sortVersion` so a controlled `sort` prop swapped by the host
 * (without going through `setSort`) still invalidates the snapshot.
 */
export interface ResortInputs {
  readonly sortVersion: number;
  readonly filters: unknown;
  readonly columns: unknown;
  readonly sortField: string;
  readonly sortDirection: 'asc' | 'desc';
}

/** What the last run saw, so the next run can tell an edit from a new dataset. */
export interface ResortTracker<T> {
  /** Inputs of the last full re-sort; `null` before the first run. */
  inputs: ResortInputs | null;
  /** `displayData` of the last run; `null` before the first run. */
  data: readonly T[] | null;
  /** Edit counter value when `data` last changed. */
  editVersion: number;
}

export function createResortTracker<T>(): ResortTracker<T> {
  return { inputs: null, data: null, editVersion: 0 };
}

/** True when any of the inputs that force a full re-sort differs (by identity). */
export function resortInputsChanged(prev: ResortInputs | null, next: ResortInputs): boolean {
  return (
    prev === null ||
    prev.sortVersion !== next.sortVersion ||
    prev.filters !== next.filters ||
    prev.columns !== next.columns ||
    prev.sortField !== next.sortField ||
    prev.sortDirection !== next.sortDirection
  );
}

/**
 * Decides whether this run needs a full re-sort, and records what it saw.
 *
 * A re-sort is due on the first run, when a re-sort input changed, or when the
 * data change can't keep the current snapshot (see `keepsSnapshot`). The edit
 * counter (`editVersion`, bumped by every edit the grid emits) only counts as
 * "an edit is pending" when it moved since the data last changed, so a host
 * that applies the grid's own edit keeps the order and a fresh dataset does not.
 *
 * Mutates `tracker`; callers hold it in a ref.
 */
export function trackResort<T>(
  tracker: ResortTracker<T>,
  inputs: ResortInputs,
  data: readonly T[],
  editVersion: number,
  snapshot: RowOrderSnapshot<T> | null,
  getRowId: ((row: T) => unknown) | undefined,
): boolean {
  const prevData = tracker.data;
  const needsResort =
    prevData === null ||
    resortInputsChanged(tracker.inputs, inputs) ||
    !keepsSnapshot(snapshot, prevData, data, getRowId, editVersion !== tracker.editVersion);
  if (needsResort) tracker.inputs = inputs;
  if (prevData !== data) tracker.editVersion = editVersion;
  tracker.data = data;
  return needsResort;
}
