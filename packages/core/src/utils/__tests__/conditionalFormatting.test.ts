import { describe, expect, it } from 'bun:test';
import { conditionalFormatCellStyle, conditionalFormatTextStyle, createConditionalFormatter } from '../conditionalFormatting';
import { createGridDataAccessor } from '../cellValue';
import { FormulaEngine } from '../../formula/formulaEngine';
import { FormulaError } from '../../formula/types';
import type { IColumnDef } from '../../types/columnTypes';
import type { IConditionalFormatRule, IConditionalFormatStyle } from '../../types/conditionalFormatTypes';

interface Row { id: number; v: unknown; w?: unknown }
const COLUMNS: IColumnDef<Row>[] = [{ columnId: 'v', name: 'V' }, { columnId: 'w', name: 'W' }];
const HIT: IConditionalFormatStyle = { background: '#ff0' };

const rowsOf = (values: unknown[]): Row[] => values.map((v, id) => ({ id, v }));

/** Which rows of column `v` a single style rule highlights. */
function matches(values: unknown[], rule: Omit<IConditionalFormatRule<Row>, 'columnIds'>, extra: { now?: Date } = {}): number[] {
  const items = rowsOf(values);
  const f = createConditionalFormatter([{ columnIds: ['v'], ...rule } as IConditionalFormatRule<Row>], { items, columns: COLUMNS, ...extra });
  return items.filter((it) => f?.getCellFormat(it, 'v')?.style.background === '#ff0').map((it) => it.id);
}

describe('createConditionalFormatter: highlight rules', () => {
  const nums = [5, 10, 15, 20, null, 'x'];
  it.each([
    ['greaterThan', 10, undefined, [2, 3]],
    ['greaterThanOrEqual', 10, undefined, [1, 2, 3]],
    ['lessThan', 10, undefined, [0]],
    ['lessThanOrEqual', '10', undefined, [0, 1]],
    ['equal', 15, undefined, [2]],
    ['notEqual', 15, undefined, [0, 1, 3, 5]],
    ['between', 10, 15, [1, 2]],
    ['between', 15, 10, [1, 2]],
    ['notBetween', 10, 15, [0, 3, 5]],
  ] as const)('cellValue %s %p %p', (operator, value, value2, expected) => {
    expect(matches(nums, { type: 'cellValue', operator, value, value2, style: HIT })).toEqual([...expected]);
  });

  it('cellValue compares dates and text', () => {
    expect(matches([new Date(2024, 0, 1), new Date(2024, 5, 1)], { type: 'cellValue', operator: 'greaterThan', value: new Date(2024, 2, 1), style: HIT })).toEqual([1]);
    expect(matches(['apple', 'Banana', 'cherry'], { type: 'cellValue', operator: 'equal', value: 'banana', style: HIT })).toEqual([1]);
  });

  it.each([
    ['contains', 'an', [0, 1]],
    ['notContains', 'an', [2, 3]],
    ['beginsWith', 'BA', [0]],
    ['endsWith', 'e', [2]],
  ] as const)('text %s', (operator, text, expected) => {
    expect(matches(['Banana', 'mango', 'apple', null], { type: 'text', operator, text, style: HIT })).toEqual([...expected]);
  });

  it('text matching can be case-sensitive', () => {
    expect(matches(['Banana', 'banana'], { type: 'text', operator: 'beginsWith', text: 'B', caseSensitive: true, style: HIT })).toEqual([0]);
  });

  it('dateOccurring periods are relative to now (local days, Sunday weeks)', () => {
    const now = new Date(2024, 4, 15, 13, 0); // Wed 15 May 2024
    const dates = [
      new Date(2024, 4, 15, 8), // today
      new Date(2024, 4, 14), // yesterday
      new Date(2024, 4, 9), // last 7 days (6 days ago)
      new Date(2024, 4, 8), // 7 days ago: not last 7 days
      '2024-05-12', // Sunday this week (ISO date string)
      new Date(2024, 3, 30), // last month
    ];
    const run = (period: string) => matches(dates, { type: 'dateOccurring', period, style: HIT } as never, { now });
    expect(run('today')).toEqual([0]);
    expect(run('yesterday')).toEqual([1]);
    expect(run('last7Days')).toEqual([0, 1, 2, 4]);
    expect(run('thisWeek')).toEqual([0, 1, 4]);
    expect(run('lastWeek')).toEqual([2, 3]);
    expect(run('thisMonth')).toEqual([0, 1, 2, 3, 4]);
    expect(run('lastMonth')).toEqual([5]);
  });

  it('duplicate and unique values (text case-insensitive, blanks ignored)', () => {
    const values = ['a', 'A', 'b', 3, 3, null, null];
    expect(matches(values, { type: 'duplicateValues', style: HIT })).toEqual([0, 1, 3, 4]);
    expect(matches(values, { type: 'duplicateValues', unique: true, style: HIT })).toEqual([2]);
  });

  it('top/bottom N and N percent include ties', () => {
    const values = [10, 50, 30, 50, 20, 40, 'n/a'];
    expect(matches(values, { type: 'topBottom', direction: 'top', rank: 1, style: HIT })).toEqual([1, 3]);
    expect(matches(values, { type: 'topBottom', direction: 'bottom', rank: 2, style: HIT })).toEqual([0, 4]);
    // 50% of 6 numbers = 3 items: 50, 50, 40
    expect(matches(values, { type: 'topBottom', direction: 'top', rank: 50, percent: true, style: HIT })).toEqual([1, 3, 5]);
  });

  it('above/below average, with orEqual and standard deviations', () => {
    const values = [10, 20, 30, 40, 50]; // avg 30, population sd ~14.14
    expect(matches(values, { type: 'average', direction: 'above', style: HIT })).toEqual([3, 4]);
    expect(matches(values, { type: 'average', direction: 'below', orEqual: true, style: HIT })).toEqual([0, 1, 2]);
    expect(matches(values, { type: 'average', direction: 'above', stdDev: 1, style: HIT })).toEqual([4]);
  });

  it('blanks, non-blanks, errors and non-errors', () => {
    const values = [1, '', '  ', null, new FormulaError('#DIV/0!', 'x'), 'ok'];
    expect(matches(values, { type: 'blanks', style: HIT })).toEqual([1, 2, 3]);
    expect(matches(values, { type: 'noBlanks', style: HIT })).toEqual([0, 4, 5]);
    expect(matches(values, { type: 'errors', style: HIT })).toEqual([4]);
    expect(matches(values, { type: 'noErrors', style: HIT })).toEqual([0, 1, 2, 3, 5]);
  });

  it('predicate rules receive value, item and sheet row', () => {
    expect(matches([1, 2, 3, 4], { type: 'predicate', test: (v, _item, row) => (v as number) % 2 === 0 && row > 1, style: HIT })).toEqual([3]);
  });

  it('formula rules shift relative references per row and column; $ parts stay', () => {
    const items: Row[] = [{ id: 0, v: 50, w: 1 }, { id: 1, v: 150, w: 2 }, { id: 2, v: 300, w: 3 }];
    const engine = new FormulaEngine();
    const evaluateFormula = engine.createDetachedEvaluator(createGridDataAccessor(items, COLUMNS));
    const f = createConditionalFormatter<Row>(
      [{ type: 'formula', columnIds: ['v', 'w'], formula: '=$A1>100', style: HIT }],
      { items, columns: COLUMNS, evaluateFormula },
    );
    const hits = items.flatMap((it) => ['v', 'w'].filter((c) => f?.getCellFormat(it, c)).map((c) => `${it.id}${c}`));
    expect(hits).toEqual(['1v', '1w', '2v', '2w']);
    // Fully relative: each cell compares itself.
    const g = createConditionalFormatter<Row>(
      [{ type: 'formula', columnIds: ['v'], formula: '=A1>=150', style: HIT }],
      { items, columns: COLUMNS, evaluateFormula },
    );
    expect(items.map((it) => !!g?.getCellFormat(it, 'v'))).toEqual([false, true, true]);
  });

  it('formula rules never match without a formula evaluator', () => {
    expect(matches([1, 2], { type: 'formula', formula: '=TRUE', style: HIT })).toEqual([]);
  });
});

describe('createConditionalFormatter: targeting, priority, stopIfTrue', () => {
  it('rows and rowFilter limit both matching and statistics', () => {
    const values = [100, 1, 2, 3];
    // Top 1 among rows 1..3 is 3, not 100.
    expect(matches(values, { type: 'topBottom', direction: 'top', rank: 1, rows: { start: 1 }, style: HIT })).toEqual([3]);
    expect(matches(values, { type: 'noBlanks', rowFilter: (r) => r.id % 2 === 0, style: HIT })).toEqual([0, 2]);
  });

  it('statistics pool every targeted column', () => {
    const items: Row[] = [{ id: 0, v: 1, w: 9 }, { id: 1, v: 5, w: 2 }];
    const f = createConditionalFormatter<Row>(
      [{ type: 'topBottom', columnIds: ['v', 'w'], direction: 'top', rank: 1, style: HIT }],
      { items, columns: COLUMNS },
    );
    expect(f?.getCellFormat(items[0] as Row, 'w')).toBeDefined();
    expect(f?.getCellFormat(items[1] as Row, 'v')).toBeUndefined();
  });

  it('higher priority wins per property; lower rules fill the rest; stopIfTrue stops them', () => {
    const items = rowsOf([10]);
    const rules: IConditionalFormatRule<Row>[] = [
      { type: 'noBlanks', columnIds: ['v'], style: { background: 'low', bold: true }, priority: 2 },
      { type: 'noBlanks', columnIds: ['v'], style: { background: 'high' }, priority: 1 },
    ];
    expect(createConditionalFormatter(rules, { items, columns: COLUMNS })?.getCellFormat(items[0] as Row, 'v')?.style)
      .toEqual({ background: 'high', bold: true });
    (rules[1] as { stopIfTrue?: boolean }).stopIfTrue = true;
    expect(createConditionalFormatter(rules, { items, columns: COLUMNS })?.getCellFormat(items[0] as Row, 'v')?.style)
      .toEqual({ background: 'high' });
  });

  it('returns undefined for no rules and for untargeted columns', () => {
    const items = rowsOf([1]);
    expect(createConditionalFormatter([], { items, columns: COLUMNS })).toBeUndefined();
    const f = createConditionalFormatter<Row>([{ type: 'noBlanks', columnIds: ['v'], style: HIT }], { items, columns: COLUMNS });
    expect(f?.getCellFormat(items[0] as Row, 'w')).toBeUndefined();
  });

  it('reads values through getValue (e.g. formula results)', () => {
    const items = rowsOf(['=A2', 7]);
    const f = createConditionalFormatter<Row>(
      [{ type: 'cellValue', columnIds: ['v'], operator: 'equal', value: 7, style: HIT }],
      { items, columns: COLUMNS, getValue: (item) => (item.v === '=A2' ? 7 : item.v) },
    );
    expect(items.map((it) => !!f?.getCellFormat(it, 'v'))).toEqual([true, true]);
  });
});

describe('createConditionalFormatter: scales, bars, icons', () => {
  const formatOf = (values: unknown[], rule: Omit<IConditionalFormatRule<Row>, 'columnIds'>) => {
    const items = rowsOf(values);
    const f = createConditionalFormatter([{ columnIds: ['v'], ...rule } as IConditionalFormatRule<Row>], { items, columns: COLUMNS });
    return items.map((it) => f?.getCellFormat(it, 'v'));
  };

  it('2-color scale interpolates between min and max', () => {
    const out = formatOf([0, 50, 100, 'x'], { type: 'colorScale', stops: [{ type: 'min', color: '#000000' }, { type: 'max', color: '#ffffff' }] });
    expect(out.map((c) => c?.style.background)).toEqual(['#000000', '#808080', '#ffffff', undefined]);
    expect(out[1]?.scaled).toBe(true);
  });

  it('3-color scale uses the midpoint stop', () => {
    const out = formatOf([0, 25, 50, 100], {
      type: 'colorScale',
      stops: [{ type: 'number', value: 0, color: '#ff0000' }, { type: 'number', value: 50, color: '#ffff00' }, { type: 'number', value: 100, color: '#00ff00' }],
    });
    expect(out.map((c) => c?.style.background)).toEqual(['#ff0000', '#ff8000', '#ffff00', '#00ff00']);
  });

  it('data bars span from 0 for positive data and from the axis for mixed data', () => {
    const pos = formatOf([0, 25, 100], { type: 'dataBar' });
    expect(pos.map((c) => [c?.dataBar?.start, c?.dataBar?.end])).toEqual([[0, 0], [0, 25], [0, 100]]);
    const mixed = formatOf([-50, 0, 150], { type: 'dataBar', gradient: false });
    // axis at 25%
    expect(mixed.map((c) => [c?.dataBar?.start, c?.dataBar?.end, c?.dataBar?.negative])).toEqual([[0, 25, true], [25, 25, false], [25, 100, false]]);
    expect(mixed[0]?.dataBar?.gradient).toBe(false);
  });

  it('data bars honor explicit min/max', () => {
    const out = formatOf([10, 20, 30], { type: 'dataBar', min: { type: 'number', value: 10 }, max: { type: 'number', value: 20 } });
    expect(out.map((c) => c?.dataBar?.end)).toEqual([0, 100, 100]);
  });

  it('icon sets split at percent thresholds; reverse flips', () => {
    const values = [0, 40, 70, 100];
    expect(formatOf(values, { type: 'iconSet', iconSet: '3Arrows' }).map((c) => c?.icon?.index)).toEqual([2, 1, 0, 0]);
    expect(formatOf(values, { type: 'iconSet', iconSet: '3Arrows', reverse: true }).map((c) => c?.icon?.index)).toEqual([0, 1, 2, 2]);
  });
});

describe('conditional format CSS', () => {
  it('fills become background-color; a tint and data bar layer on top', () => {
    const style = conditionalFormatCellStyle(
      { style: { background: '#c6efce', border: '#f00' }, dataBar: { start: 0, end: 40, color: '#638ec6', gradient: false, negative: false, barOnly: false } },
      { tint: 'rgba(0,0,0,0.1)' },
    );
    expect(style?.backgroundColor).toBe('#c6efce');
    const layers = style?.backgroundImage?.split(/,\s(?=linear-gradient)/);
    // Tint on top, then the four border edges, then the bar; box-shadow stays free for Find highlights.
    expect(layers?.[0]).toBe('linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.1))');
    expect(layers?.slice(1, 5)).toEqual(Array(4).fill('linear-gradient(#f00, #f00)'));
    expect(layers?.[5]).toBe('linear-gradient(to right, transparent 0.00%, #638ec6 0.00%, #638ec6 40.00%, transparent 40.00%)');
    expect(style?.backgroundSize).toBe('100% 100%, 100% 1px, 100% 1px, 1px 100%, 1px 100%, 100% 70%');
    expect(style?.boxShadow).toBeUndefined();
  });

  it('opaque cells keep the theme background under the fill', () => {
    const style = conditionalFormatCellStyle({ style: { background: '#c6efce' } }, { opaque: true });
    expect(style?.backgroundColor).toBe('var(--ogrid-bg, #fff)');
    expect(style?.backgroundImage).toBe('linear-gradient(#c6efce, #c6efce)');
  });

  it('text style maps font flags and hides text for bar-only cells', () => {
    expect(conditionalFormatTextStyle({ style: { color: 'red', bold: true, italic: true, underline: true, strikethrough: true } }))
      .toEqual({ color: 'red', fontWeight: '700', fontStyle: 'italic', textDecoration: 'underline line-through' });
    expect(conditionalFormatTextStyle({ style: {}, dataBar: { start: 0, end: 1, color: 'x', gradient: true, negative: false, barOnly: true } })?.color).toBe('transparent');
    expect(conditionalFormatTextStyle({ style: { background: 'x' } })).toBeUndefined();
  });
});
