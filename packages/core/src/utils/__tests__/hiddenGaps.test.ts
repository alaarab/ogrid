import { describe, expect, it } from 'bun:test';
import { computeHiddenGaps, hiddenKeysInSpan, hiddenKeysAround } from '../hiddenGaps';
import { getHidingMenuItems, getColumnHeaderMenuItems } from '../gridContextMenuHelpers';

const hiddenSet = new Set(['a', 'c', 'd', 'g']);
const ordered = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const shown = ordered.filter((k) => !hiddenSet.has(k)); // b, e, f
const gaps = computeHiddenGaps(ordered, (k) => hiddenSet.has(k));

describe('computeHiddenGaps', () => {
  it('groups hidden keys by the shown key after them, trailing ones in `after`', () => {
    expect([...gaps.before.entries()]).toEqual([['b', ['a']], ['e', ['c', 'd']]]);
    expect(gaps.after).toEqual(['g']);
    expect(gaps.lastShown).toBe('f');
  });

  it('is empty when nothing is hidden', () => {
    const none = computeHiddenGaps(ordered, () => false);
    expect(none.before.size).toBe(0);
    expect(none.after).toEqual([]);
  });
});

describe('hiddenKeysInSpan', () => {
  it('collects the gaps between the selected keys', () => {
    expect(hiddenKeysInSpan(gaps, shown, 1, 1)).toEqual([]);
    expect(hiddenKeysInSpan(computeHiddenGaps(['x', 'y', 'z'], (k) => k === 'y'), ['x', 'z'], 0, 1)).toEqual(['y']);
  });

  it('takes the leading gap from the first key and the trailing gap at the last', () => {
    expect(hiddenKeysInSpan(gaps, shown, 0, 1)).toEqual(['a', 'c', 'd']);
    expect(hiddenKeysInSpan(gaps, shown, 1, 2)).toEqual(['g']);
    expect(hiddenKeysInSpan(gaps, shown, 2, 0)).toEqual(['a', 'c', 'd', 'g']);
  });
});

describe('hiddenKeysAround', () => {
  it('returns the gaps on both sides of a shown key', () => {
    expect(hiddenKeysAround(gaps, shown, 'b')).toEqual(['a', 'c', 'd']);
    expect(hiddenKeysAround(gaps, shown, 'f')).toEqual(['g']);
    expect(hiddenKeysAround(gaps, shown, 'missing')).toEqual([]);
  });
});

describe('hiding menu items', () => {
  it('counts rows and columns and only offers unhide when something is hidden', () => {
    expect(getHidingMenuItems({ rowCount: 1, columnCount: 0 }).map((i) => i.label)).toEqual(['Hide row']);
    const items = getHidingMenuItems({ rowCount: 3, columnCount: 2, canUnhideRows: true, canUnhideColumns: true });
    expect(items.map((i) => i.id)).toEqual(['hideRows', 'unhideRows', 'hideColumns', 'unhideColumns']);
    expect(items[0]?.label).toBe('Hide 3 rows');
    expect(items[0]?.dividerBefore).toBe(true);
    expect(items[2]?.label).toBe('Hide 2 columns');
    expect(getHidingMenuItems({ rowCount: 0, columnCount: 0 })).toEqual([]);
  });

  it('adds Hide column / Unhide columns to the header menu when asked', () => {
    const base = { canPinLeft: true, canPinRight: true, canUnpin: false };
    expect(getColumnHeaderMenuItems(base).some((i) => i.id === 'hideColumn')).toBe(false);
    const items = getColumnHeaderMenuItems({ ...base, canHide: true, canUnhide: true });
    expect(items.slice(-2).map((i) => i.id)).toEqual(['hideColumn', 'unhideColumns']);
    expect(items[items.length - 3]?.divider).toBe(true);
  });
});
