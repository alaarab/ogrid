/**
 * Tests for the re-sort decision: when a data or input change keeps the
 * row-order snapshot and when it forces a full re-sort.
 */
import { describe, it, expect } from 'bun:test';
import {
  createResortTracker,
  createSnapshot,
  resortInputsChanged,
  trackResort,
} from '../rowOrderSnapshot';
import type { ResortInputs } from '../rowOrderSnapshot';

interface Row { id: number; v: string }
const getRowId = (r: Row) => r.id;
const filters = {};
const columns: unknown[] = [];
const inputs = (over: Partial<ResortInputs> = {}): ResortInputs => ({
  sortVersion: 0, filters, columns, sortField: 'v', sortDirection: 'asc', ...over,
});

describe('resortInputsChanged', () => {
  it('is true before the first run', () => {
    expect(resortInputsChanged(null, inputs())).toBe(true);
  });

  it('is false for equal inputs in a new object', () => {
    expect(resortInputsChanged(inputs(), inputs())).toBe(false);
  });

  it('compares filters and columns by identity', () => {
    expect(resortInputsChanged(inputs(), inputs({ filters: {} }))).toBe(true);
    expect(resortInputsChanged(inputs(), inputs({ columns: [] }))).toBe(true);
  });

  it('is true when only the sort field or direction changed (controlled sort)', () => {
    expect(resortInputsChanged(inputs(), inputs({ sortField: 'id' }))).toBe(true);
    expect(resortInputsChanged(inputs(), inputs({ sortDirection: 'desc' }))).toBe(true);
  });

  it('is true when sortVersion bumped (re-sort on the same column)', () => {
    expect(resortInputsChanged(inputs(), inputs({ sortVersion: 1 }))).toBe(true);
  });
});

describe('trackResort', () => {
  const a = { id: 1, v: 'a' };
  const b = { id: 2, v: 'b' };
  const data = [a, b];

  function primed() {
    const tracker = createResortTracker<Row>();
    expect(trackResort(tracker, inputs(), data, 0, null, getRowId)).toBe(true);
    const snapshot = createSnapshot(data, [b, a], getRowId);
    return { tracker, snapshot };
  }

  it('re-sorts on the first run', () => {
    const tracker = createResortTracker<Row>();
    expect(trackResort(tracker, inputs(), data, 0, null, getRowId)).toBe(true);
    expect(tracker.data).toBe(data);
  });

  it('keeps the snapshot when nothing changed', () => {
    const { tracker, snapshot } = primed();
    expect(trackResort(tracker, inputs(), data, 0, snapshot, getRowId)).toBe(false);
  });

  it('re-sorts when there is no snapshot to keep', () => {
    const { tracker } = primed();
    expect(trackResort(tracker, inputs(), data, 0, null, getRowId)).toBe(true);
  });

  it('keeps the order when the host applies a grid edit (edit counter moved)', () => {
    const { tracker, snapshot } = primed();
    const edited = [{ ...a, v: 'z' }, b];
    expect(trackResort(tracker, inputs(), edited, 1, snapshot, getRowId)).toBe(false);
    expect(tracker.editVersion).toBe(1);
  });

  it('re-sorts when the host replaces every row without an edit', () => {
    const { tracker, snapshot } = primed();
    const replaced = [{ id: 3, v: 'c' }, { id: 4, v: 'd' }];
    expect(trackResort(tracker, inputs(), replaced, 0, snapshot, getRowId)).toBe(true);
  });

  it('counts an edit once: the counter is consumed by the data change it explains', () => {
    const { tracker, snapshot } = primed();
    const edited = [{ ...a, v: 'z' }, b];
    trackResort(tracker, inputs(), edited, 1, snapshot, getRowId);
    // Same counter, data unchanged: the counter is not re-recorded.
    trackResort(tracker, inputs(), edited, 1, snapshot, getRowId);
    expect(tracker.editVersion).toBe(1);
    expect(tracker.data).toBe(edited);
  });

  it('does not record the edit counter while the data stays the same', () => {
    const { tracker, snapshot } = primed();
    trackResort(tracker, inputs(), data, 5, snapshot, getRowId);
    expect(tracker.editVersion).toBe(0);
  });

  it('records new inputs only when it decides to re-sort', () => {
    const { tracker, snapshot } = primed();
    const before = tracker.inputs;
    trackResort(tracker, inputs(), data, 0, snapshot, getRowId);
    expect(tracker.inputs).toBe(before);
    const next = inputs({ sortDirection: 'desc' });
    expect(trackResort(tracker, next, data, 0, snapshot, getRowId)).toBe(true);
    expect(tracker.inputs).toBe(next);
  });
});
