import { renderHook } from '@testing-library/react';
import { useColumnPinning } from '../useColumnPinning';

describe('useColumnPinning computeLeftOffsets', () => {
  const cols = [{ columnId: 'a' }, { columnId: 'b' }, { columnId: 'c' }];
  const widths = { a: 100, b: 120, c: 80 };

  function setup() {
    return renderHook(() => useColumnPinning({ columns: [], pinnedColumns: { a: 'left', b: 'left' } })).result.current;
  }

  it('starts left offsets after the checkbox column', () => {
    const { computeLeftOffsets } = setup();
    expect(computeLeftOffsets(cols, widths, 100, true, 48)).toEqual({ a: 48, b: 148 });
  });

  it('also skips the row-number column so it is not covered by the first pinned column', () => {
    const { computeLeftOffsets } = setup();
    expect(computeLeftOffsets(cols, widths, 100, true, 48, 50)).toEqual({ a: 98, b: 198 });
    expect(computeLeftOffsets(cols, widths, 100, false, 48, 50)).toEqual({ a: 50, b: 150 });
  });
});
