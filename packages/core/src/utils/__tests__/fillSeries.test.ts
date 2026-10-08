import { detectFillSeries } from '../fillSeries';
import { computeAutoFillEndRow, computeFillDragEdits } from '../fillHelpers';
import type { IColumnDef } from '../../types/columnTypes';

/** Values k = from..to of the series detected for `values`, or null when none. */
function extend(values: unknown[], from: number, to: number, alternate = false): unknown[] | null {
  const series = detectFillSeries(values, { alternate });
  if (!series) return null;
  const out: unknown[] = [];
  for (let k = from; k <= to; k++) out.push(series.valueAt(k));
  return out;
}

describe('detectFillSeries', () => {
  describe('numbers', () => {
    it('a lone number copies; Ctrl (alternate) counts up by one', () => {
      expect(detectFillSeries([5])).toBeNull();
      expect(extend([5], 1, 3, true)).toEqual([6, 7, 8]);
    });

    it('two or more evenly spaced numbers continue their step, both ways', () => {
      expect(extend([1, 2], 2, 4)).toEqual([3, 4, 5]);
      expect(extend([10, 7, 4], 3, 4)).toEqual([1, -2]);
      expect(extend([2, 4], -2, -1)).toEqual([-2, 0]);
    });

    it('drops floating point noise', () => {
      expect(extend([0.1, 0.2], 2, 3)).toEqual([0.3, 0.4]);
    });

    it('unevenly spaced numbers follow their linear trend (Excel)', () => {
      const [next] = extend([1, 2, 4], 3, 3) as number[];
      expect(next).toBeCloseTo(5.333333, 5);
    });

    it('Ctrl copies a multi-number series instead', () => {
      expect(detectFillSeries([1, 2], { alternate: true })).toBeNull();
    });

    it('numeric strings continue as strings', () => {
      expect(extend(['1', '3'], 2, 2)).toEqual(['5']);
    });
  });

  describe('dates', () => {
    it('a single ISO date steps by a day, across month ends', () => {
      expect(extend(['2024-01-30'], 1, 3)).toEqual(['2024-01-31', '2024-02-01', '2024-02-02']);
      expect(extend(['2024-03-01'], -1, -1)).toEqual(['2024-02-29']);
    });

    it('two dates on the same day of the month step by months, clamped to short months', () => {
      expect(extend(['2024-01-15', '2024-02-15'], 2, 3)).toEqual(['2024-03-15', '2024-04-15']);
      expect(extend(['2023-11-30', '2023-12-30'], 2, 3)).toEqual(['2024-01-30', '2024-02-29']);
    });

    it('detects year steps', () => {
      expect(extend(['2020-06-01', '2021-06-01'], 2, 2)).toEqual(['2022-06-01']);
    });

    it('evenly spaced days keep their step (weekly)', () => {
      expect(extend(['2024-01-01', '2024-01-08'], 2, 2)).toEqual(['2024-01-15']);
    });

    it('Date objects produce Date objects', () => {
      const [next] = extend([new Date(2024, 0, 31, 9, 30)], 1, 1) as Date[];
      expect(next).toBeInstanceOf(Date);
      expect([next?.getFullYear(), next?.getMonth(), next?.getDate(), next?.getHours()]).toEqual([2024, 1, 1, 9]);
    });

    it('Ctrl copies dates', () => {
      expect(detectFillSeries(['2024-01-01'], { alternate: true })).toBeNull();
    });
  });

  describe('names', () => {
    it('weekday names and abbreviations wrap around, keeping the source case', () => {
      expect(extend(['Friday'], 1, 3)).toEqual(['Saturday', 'Sunday', 'Monday']);
      expect(extend(['mon'], -1, 1)).toEqual(['sun', 'mon', 'tue']);
      expect(extend(['MON', 'WED'], 2, 2)).toEqual(['FRI']);
    });

    it('month names and abbreviations', () => {
      expect(extend(['November'], 1, 2)).toEqual(['December', 'January']);
      expect(extend(['Jan'], 1, 1)).toEqual(['Feb']);
    });

    it('quarters cycle Q1..Q4', () => {
      expect(extend(['Q3'], 1, 3)).toEqual(['Q4', 'Q1', 'Q2']);
    });

    it('inconsistent steps are not a series', () => {
      expect(detectFillSeries(['Mon', 'Tue', 'Fri'])).toBeNull();
    });
  });

  describe('text with a trailing number', () => {
    it('counts the number up, keeping the prefix', () => {
      expect(extend(['Item 1'], 1, 2)).toEqual(['Item 2', 'Item 3']);
      expect(extend(['Row 2', 'Row 4'], 2, 2)).toEqual(['Row 6']);
    });

    it('keeps zero padding and counts back up below zero (Excel)', () => {
      expect(extend(['A009'], 1, 1)).toEqual(['A010']);
      expect(extend(['Item 1'], -2, -1)).toEqual(['Item 1', 'Item 0']);
    });

    it('different prefixes are not a series', () => {
      expect(detectFillSeries(['A1', 'B2'])).toBeNull();
    });
  });

  it('plain text, booleans and blanks are not series', () => {
    expect(detectFillSeries(['hello'])).toBeNull();
    expect(detectFillSeries([true])).toBeNull();
    expect(detectFillSeries([1, ''])).toBeNull();
    expect(detectFillSeries([])).toBeNull();
  });
});

interface Row {
  label: string | null;
  n: number | null;
  day: string | null;
}

const COLS: IColumnDef<Row>[] = [
  { columnId: 'label', name: 'Label', editable: true },
  { columnId: 'n', name: 'N', editable: true, type: 'numeric' },
  { columnId: 'day', name: 'Day', editable: true, type: 'date' },
];

const blank = (): Row => ({ label: null, n: null, day: null });

describe('computeFillDragEdits series', () => {
  const values = (events: { rowIndex: number; columnId: string; newValue: unknown }[]) =>
    events.map((e) => `${e.rowIndex}:${e.columnId}=${String(e.newValue)}`);

  it('fills each source column down as its own series', () => {
    const rows = [{ label: 'Mon', n: 1, day: '2024-01-01' }, { label: 'Tue', n: 3, day: '2024-02-01' }, blank(), blank()];
    const { events } = computeFillDragEdits({ startRow: 0, startCol: 0, endRow: 1, endCol: 2 }, 3, 2, rows, COLS);
    expect(values(events)).toEqual([
      '2:label=Wed', '2:n=5', '2:day=2024-03-01',
      '3:label=Thu', '3:n=7', '3:day=2024-04-01',
    ]);
  });

  it('fills up with decreasing values', () => {
    const rows = [blank(), blank(), { label: 'Item 5', n: 10, day: null }];
    const { events } = computeFillDragEdits({ startRow: 2, startCol: 0, endRow: 2, endCol: 0 }, 0, 0, rows, COLS);
    expect(values(events)).toEqual(['0:label=Item 3', '1:label=Item 4']);
  });

  it('fills right and left along each source row', () => {
    const cols: IColumnDef<Row>[] = [
      { columnId: 'label', name: 'A', editable: true },
      { columnId: 'n', name: 'B', editable: true },
      { columnId: 'day', name: 'C', editable: true },
    ];
    const right = computeFillDragEdits({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, 0, 2, [{ label: 'Q1', n: null, day: null }], cols);
    expect(values(right.events)).toEqual(['0:n=Q2', '0:day=Q3']);
    const left = computeFillDragEdits({ startRow: 0, startCol: 2, endRow: 0, endCol: 2 }, 0, 0, [{ label: null, n: null, day: 'Jan' }], cols);
    expect(values(left.events)).toEqual(['0:label=Nov', '0:n=Dec']);
  });

  it('a lone number copies; alternate (Ctrl) counts it up', () => {
    const rows = () => [{ label: null, n: 4, day: null }, blank(), blank()];
    expect(values(computeFillDragEdits({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 }, 2, 1, rows(), COLS).events))
      .toEqual(['1:n=4', '2:n=4']);
    expect(values(computeFillDragEdits({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 }, 2, 1, rows(), COLS, undefined, { alternate: true }).events))
      .toEqual(['1:n=5', '2:n=6']);
  });

  it('alternate (Ctrl) copies a series; series: false always copies', () => {
    const rows = () => [{ label: 'Item 1', n: null, day: null }, blank()];
    const src = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    expect(values(computeFillDragEdits(src, 1, 0, rows(), COLS, undefined, { alternate: true }).events)).toEqual(['1:label=Item 1']);
    expect(values(computeFillDragEdits(src, 1, 0, rows(), COLS, undefined, { series: false }).events)).toEqual(['1:label=Item 1']);
  });

  it('lines with a formula fill by shifting references, not as a series', () => {
    const rows = [{ label: null, n: 1, day: null }, { label: null, n: 2, day: null }, blank()];
    const setFormula = jest.fn();
    const { events } = computeFillDragEdits({ startRow: 0, startCol: 1, endRow: 1, endCol: 1 }, 2, 1, rows, COLS, {
      flatColumns: COLS,
      hasFormula: (col, row) => col === 1 && row === 0,
      getFormula: () => '=A1',
      setFormula,
    });
    // Tiled: row 2 takes row 0's formula, shifted down two rows.
    expect(events).toHaveLength(0);
    expect(setFormula).toHaveBeenCalledWith(1, 2, '=A3');
  });

  it('non-series text keeps tiling the source block', () => {
    const rows = [{ label: 'a', n: null, day: null }, { label: 'b', n: null, day: null }, blank(), blank(), blank()];
    const { events } = computeFillDragEdits({ startRow: 0, startCol: 0, endRow: 1, endCol: 0 }, 4, 0, rows, COLS);
    expect(values(events)).toEqual(['2:label=a', '3:label=b', '4:label=a']);
  });
});

describe('computeAutoFillEndRow', () => {
  const rowsWith = (labels: (string | null)[], ns: (number | null)[]): Row[] =>
    labels.map((label, i) => ({ label, n: ns[i] ?? null, day: null }));

  it('fills to the end of the contiguous data in the left neighbor column', () => {
    const rows = rowsWith(['a', 'b', 'c', null, 'e'], [1, null, null, null, null]);
    expect(computeAutoFillEndRow({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 }, rows, COLS)).toBe(2);
  });

  it('falls back to the right neighbor when the left has nothing below', () => {
    const rows = rowsWith(['x', null, null], [null, 1, 2]);
    expect(computeAutoFillEndRow({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, rows, COLS)).toBe(2);
  });

  it('returns -1 when neither neighbor has data below the source', () => {
    const rows = rowsWith(['a', null], [1, null]);
    expect(computeAutoFillEndRow({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 }, rows, COLS)).toBe(-1);
  });

  it('treats merge-covered cells as empty', () => {
    const rows = rowsWith(['a', 'b', 'c'], [1, null, null]);
    const covered = (r: number, c: number) => c === 0 && r === 2;
    expect(computeAutoFillEndRow({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 }, rows, COLS, covered)).toBe(1);
  });
});
