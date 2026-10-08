/**
 * Structure-edit support in the shared hooks: rows inserted through the grid
 * keep their place in a kept sort snapshot, and recorded actions are undoable.
 */
import { describe, it, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { applySnapshot, createSnapshot } from '../rowOrderSnapshot';
import { useUndoRedo } from '../useUndoRedo';

interface Row {
  id: number;
  age: number;
}

const a: Row = { id: 1, age: 30 };
const b: Row = { id: 2, age: 25 };
const c: Row = { id: 3, age: 35 };
const d: Row = { id: 4, age: 28 };
const e: Row = { id: 5, age: 20 };
const f: Row = { id: 6, age: 21 };
const data = [a, b, c, d];
const getRowId = (r: Row) => r.id;
const byAge = (rows: Row[]) => [...rows].sort((x, y) => x.age - y.age);
const keepAll = (rows: Row[]) => rows;
const ids = (rows: readonly Row[]) => rows.map(getRowId);

describe('applySnapshot with placeAddedInSourceOrder', () => {
  it('puts a new row right after the row before it in the data, not at the end', () => {
    const snap = createSnapshot(data, byAge(data), getRowId); // 2, 4, 1, 3
    const inserted = [a, e, b, c, d]; // e follows a (id 1)
    expect(ids(applySnapshot(snap, inserted, getRowId, keepAll, true)?.rows ?? [])).toEqual([2, 4, 1, 5, 3]);
    // Without the flag new rows are appended.
    expect(ids(applySnapshot(snap, inserted, getRowId, keepAll)?.rows ?? [])).toEqual([2, 4, 1, 3, 5]);
  });

  it('puts rows inserted at the top of the data first, in data order', () => {
    const snap = createSnapshot(data, keepAll(data), getRowId);
    expect(ids(applySnapshot(snap, [f, e, ...data], getRowId, keepAll, true)?.rows ?? [])).toEqual([6, 5, 1, 2, 3, 4]);
  });
});

describe('useUndoRedo recordAction', () => {
  it('undoes and redoes a recorded action, even without onCellValueChanged', () => {
    const log: string[] = [];
    const { result } = renderHook(() => useUndoRedo({ onCellValueChanged: undefined }));
    act(() => result.current.recordAction({ undo: () => log.push('undo'), redo: () => log.push('redo') }));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(log).toEqual(['undo', 'redo']);
  });

  it('a batch undoes recorded actions in reverse order', () => {
    const log: string[] = [];
    const { result } = renderHook(() => useUndoRedo({ onCellValueChanged: undefined }));
    act(() => {
      result.current.beginBatch();
      result.current.recordAction({ undo: () => log.push('undo 1'), redo: () => log.push('redo 1') });
      result.current.recordAction({ undo: () => log.push('undo 2'), redo: () => log.push('redo 2') });
      result.current.endBatch();
    });
    act(() => result.current.undo());
    expect(log).toEqual(['undo 2', 'undo 1']);
  });
});
