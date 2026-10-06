/**
 * Tests for the row-order snapshot helpers: how a data change is classified
 * (edit vs replacement) and how a kept snapshot is re-applied by id or index.
 */
import { describe, it, expect } from 'bun:test';
import {
  applySnapshot,
  createSnapshot,
  isEditLikeChange,
  isSameRowSet,
  keepsSnapshot,
  rowsToIndices,
} from '../rowOrderSnapshot';
import type { IdSnapshot, IndexSnapshot } from '../rowOrderSnapshot';

interface Row {
  id: number;
  name: string;
  age: number;
}

const a: Row = { id: 1, name: 'Alice', age: 30 };
const b: Row = { id: 2, name: 'Bob', age: 25 };
const c: Row = { id: 3, name: 'Charlie', age: 35 };
const d: Row = { id: 4, name: 'Diana', age: 28 };
const data: Row[] = [a, b, c, d];
const getRowId = (r: Row) => r.id;
const byAge = (rows: Row[]) => [...rows].sort((x, y) => x.age - y.age);
const keepAll = (rows: Row[]) => rows;
const ids = (rows: readonly Row[]) => rows.map(getRowId);

describe('isEditLikeChange', () => {
  it('treats the same array, an emptied dataset and a pending edit as edits', () => {
    expect(isEditLikeChange(data, data, false)).toBe(true);
    expect(isEditLikeChange(data, [], false)).toBe(true);
    expect(isEditLikeChange(data, data.map((r) => ({ ...r })), true)).toBe(true);
  });

  it('is an edit when any row object survives, wherever it moved', () => {
    expect(isEditLikeChange(data, [{ ...a }, b, c, d], false)).toBe(true); // one row replaced
    expect(isEditLikeChange(data, [{ id: 9, name: 'New', age: 1 }, ...data], false)).toBe(true); // insert at front
    expect(isEditLikeChange(data, [a, c, d], false)).toBe(true); // delete
  });

  it('is a replacement when every row object is new and no edit is pending', () => {
    expect(isEditLikeChange(data, data.map((r) => ({ ...r })), false)).toBe(false);
    expect(isEditLikeChange([], data, false)).toBe(false); // first load
  });
});

describe('isSameRowSet (positional)', () => {
  it('rejects any length change', () => {
    expect(isSameRowSet(data, [...data, { id: 5, name: 'Eve', age: 22 }], getRowId, true)).toBe(false);
    expect(isSameRowSet(data, [a, b, c], undefined, false)).toBe(false);
  });

  it('accepts same-position edits and rejects a same-length replacement', () => {
    expect(isSameRowSet(data, [{ ...a }, b, c, d], undefined, false)).toBe(true);
    expect(isSameRowSet(data, data.map((r) => ({ ...r })), getRowId, false)).toBe(false);
    expect(isSameRowSet(data, data.map((r) => ({ ...r })), getRowId, true)).toBe(true);
    expect(isSameRowSet(data, [b, a, c, d], getRowId, true)).toBe(false); // ids moved
  });
});

describe('createSnapshot', () => {
  it('snapshots by id when getRowId is given and ids are unique', () => {
    const rows = byAge(data);
    const snap = createSnapshot(data, rows, getRowId);
    expect(snap.kind).toBe('ids');
    const idSnap = snap as IdSnapshot<Row>;
    expect(idSnap.ids).toEqual([2, 4, 1, 3]);
    expect([...idSnap.knownIds].sort()).toEqual([1, 2, 3, 4]);
    expect(idSnap.rows).toBe(rows);
    expect(idSnap.data).toBe(data);
  });

  it('falls back to positions without getRowId or with duplicate ids', () => {
    const rows = byAge(data);
    expect(createSnapshot(data, rows, undefined).kind).toBe('indices');
    const dupData = [a, { ...b, id: 1 }, c];
    const snap = createSnapshot(dupData, byAge(dupData), getRowId);
    expect(snap.kind).toBe('indices');
    expect((snap as IndexSnapshot<Row>).indices).toEqual([1, 0, 2]);
  });
});

describe('keepsSnapshot', () => {
  it('never keeps a missing snapshot', () => {
    expect(keepsSnapshot(null, data, data, getRowId, false)).toBe(false);
  });

  it('uses reference survival for id snapshots and positions for index snapshots', () => {
    const idSnap = createSnapshot(data, byAge(data), getRowId);
    const indexSnap = createSnapshot(data, byAge(data), undefined);
    const inserted = [...data, { id: 5, name: 'Eve', age: 22 }];
    expect(keepsSnapshot(idSnap, data, inserted, getRowId, false)).toBe(true);
    expect(keepsSnapshot(indexSnap, data, inserted, undefined, false)).toBe(false);
  });

  it('treats an id snapshot positionally when getRowId was dropped', () => {
    const idSnap = createSnapshot(data, byAge(data), getRowId);
    expect(keepsSnapshot(idSnap, data, [a, b, c], undefined, false)).toBe(false);
  });
});

describe('applySnapshot', () => {
  it('returns the cached rows for the same data array', () => {
    const snap = createSnapshot(data, byAge(data), getRowId);
    const out = applySnapshot(snap, data, getRowId, keepAll);
    expect(out?.rows).toBe(snap.rows);
    expect(out?.snapshot).toBe(snap);
  });

  it('index snapshot: same positions, current row objects, holes skipped', () => {
    const snap = createSnapshot(data, byAge(data), undefined);
    const edited = [{ ...a, age: 99 }, b, c, d];
    const out = applySnapshot(snap, edited, undefined, keepAll);
    expect(out?.rows.map((r) => r.id)).toEqual([2, 4, 1, 3]);
    expect(out?.rows[2]?.age).toBe(99);
    expect(out?.snapshot.data).toBe(edited);
    // Shorter data: indices past the end drop out instead of yielding undefined.
    expect(applySnapshot(snap, [a, b], undefined, keepAll)?.rows.map((r) => r.id)).toEqual([2, 1]);
  });

  it('id snapshot: edited rows keep their place with the new object', () => {
    const snap = createSnapshot(data, byAge(data), getRowId);
    const edited = [{ ...a, age: 99 }, b, c, d];
    const out = applySnapshot(snap, edited, getRowId, keepAll);
    expect(ids(out!.rows)).toEqual([2, 4, 1, 3]);
    expect(out?.rows[2]?.age).toBe(99);
  });

  it('id snapshot: deleted ids drop out, the rest keep their order', () => {
    const snap = createSnapshot(data, byAge(data), getRowId);
    const out = applySnapshot(snap, [a, c, d], getRowId, keepAll);
    expect(ids(out!.rows)).toEqual([4, 1, 3]);
    expect((out!.snapshot as IdSnapshot<Row>).knownIds.has(2)).toBe(false);
  });

  it('id snapshot: new ids are filtered and appended in source order, never sorted', () => {
    const snap = createSnapshot(data, byAge(data), getRowId);
    const f = { id: 6, name: 'Frank', age: 1 };
    const e = { id: 5, name: 'Eve', age: 2 };
    const g = { id: 7, name: 'Gus', age: 3 };
    const next = [f, ...data, e, g];
    const out = applySnapshot(snap, next, getRowId, (rows) => rows.filter((r) => r.id !== 5));
    expect(ids(out!.rows)).toEqual([2, 4, 1, 3, 6, 7]);
    // Eve was filtered out but is known now: a later update must not re-add her.
    const again = applySnapshot(out!.snapshot, [...next], getRowId, keepAll);
    expect(ids(again!.rows)).toEqual([2, 4, 1, 3, 6, 7]);
  });

  it('id snapshot: rows hidden by the filter stay hidden when edited', () => {
    // Snapshot taken with Bob filtered out.
    const snap = createSnapshot(data, byAge([a, c, d]), getRowId);
    const out = applySnapshot(snap, [a, { ...b, name: 'Bobby' }, c, d], getRowId, keepAll);
    expect(ids(out!.rows)).toEqual([4, 1, 3]);
  });

  it('id snapshot: duplicate ids, a missing getRowId or no surviving id force a full re-sort', () => {
    const snap = createSnapshot(data, byAge(data), getRowId);
    expect(applySnapshot(snap, [...data, { ...b }], getRowId, keepAll)).toBeNull();
    expect(applySnapshot(snap, [...data], undefined, keepAll)).toBeNull();
    const replacement = [{ id: 11, name: 'X', age: 1 }, { id: 12, name: 'Y', age: 2 }];
    expect(applySnapshot(snap, replacement, getRowId, keepAll)).toBeNull();
    // Emptying the grid is fine: nothing to carry over, nothing to sort.
    expect(applySnapshot(snap, [], getRowId, keepAll)?.rows).toEqual([]);
  });

  it('id snapshot: a hidden row surviving still counts as overlap', () => {
    // Everything visible is deleted but a filtered-out row (Bob) survives: it is
    // the same dataset, so the surviving ids keep their (empty) order and new
    // rows are appended rather than re-sorted.
    const snap = createSnapshot(data, byAge([a, c, d]), getRowId);
    const out = applySnapshot(snap, [b, { id: 9, name: 'Zed', age: 50 }], getRowId, keepAll);
    expect(ids(out!.rows)).toEqual([9]);
  });
});

describe('rowsToIndices', () => {
  it('maps rows back to source positions, one per occurrence of a repeated reference', () => {
    const dup = { id: 1, name: 'Dup', age: 10 };
    expect(rowsToIndices([dup, b, dup], [b, dup, dup])).toEqual([1, 0, 2]);
    expect(rowsToIndices([a, b], [c])).toEqual([]);
  });
});
