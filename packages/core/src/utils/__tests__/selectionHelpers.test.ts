import { computeAutoScrollDelta, getSelectAllRange } from '../selectionHelpers';

describe('getSelectAllRange', () => {
  it('covers every cell', () => {
    expect(getSelectAllRange(3, 2)).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 1 });
  });

  it('is null for a grid without cells', () => {
    expect(getSelectAllRange(0, 2)).toBeNull();
    expect(getSelectAllRange(3, 0)).toBeNull();
  });
});

describe('computeAutoScrollDelta', () => {
  const rect = { top: 100, bottom: 500, left: 0, right: 800 };

  it('does not scroll while the pointer is clear of the edges', () => {
    expect(computeAutoScrollDelta(rect, 400, 300)).toEqual({ dx: 0, dy: 0 });
  });

  it('scrolls toward the edge the pointer is near, faster the closer it gets', () => {
    const nearBottom = computeAutoScrollDelta(rect, 400, 470);
    const pastBottom = computeAutoScrollDelta(rect, 400, 600);
    expect(nearBottom.dx).toBe(0);
    expect(nearBottom.dy).toBeGreaterThan(0);
    expect(pastBottom.dy).toBe(20);
    expect(computeAutoScrollDelta(rect, 10, 110)).toEqual({ dx: -15.5, dy: -15.5 });
  });
});
