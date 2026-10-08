import { describe, expect, it } from 'bun:test';
import { createDataValidator, replaceDataValidationRange, validationDateSerial } from '../dataValidation';
import { FormulaEngine } from '../../formula/formulaEngine';
import type { IDataValidationRule, DataValidationOperator, IColumnDef } from '../../types';
const items = [{ value: 3, limit: 5 }, { value: 9, limit: 10 }];
const columns: IColumnDef<typeof items[number]>[] = [{ columnId: 'value', name: 'Value' }, { columnId: 'limit', name: 'Limit' }];
function check(rule: IDataValidationRule, value: unknown, row = 0) {
  return createDataValidator([rule], { items, columns }).validate(rule, value, 'value', row);
}
const cases: [DataValidationOperator, number, number][] = [
  ['between', 5, 11], ['notBetween', 11, 5], ['equal', 2, 3], ['notEqual', 3, 2],
  ['greaterThan', 3, 2], ['lessThan', 1, 2], ['greaterThanOrEqual', 2, 1], ['lessThanOrEqual', 2, 3],
];
describe('data validation', () => {
  for (const [operator, good, bad] of cases) it(`whole / ${operator} checks inclusive bounds and rejects invalid values`, () => {
    const rule: IDataValidationRule = { type: 'whole', columnIds: ['value'], operator, value: 2, value2: 10 };
    expect(check(rule, good)).toBe(true);
    expect(check(rule, String(good))).toBe(true);
    expect(check(rule, bad)).toBe(false);
    expect(check(rule, 2.5)).toBe(false);
    expect(check(rule, 'not a number')).toBe(false);
  });
  for (const type of ['decimal', 'date', 'time', 'textLength'] as const) for (const [operator, good, bad] of cases) it(`${type} / ${operator} compares its normalized value`, () => {
    const bound = (n: number) => type === 'date' ? 46023 + n : type === 'time' ? n / 24 : n;
    const cell = (n: number) => type === 'textLength' ? 'x'.repeat(n) : bound(n);
    const rule: IDataValidationRule = { type, columnIds: ['value'], operator, value: bound(2), value2: bound(10) };
    expect(check(rule, cell(good))).toBe(true);
    expect(check(rule, cell(bad))).toBe(false);
  });
  it('decimal allows fractions but rejects booleans and nonfinite numbers', () => {
    const rule: IDataValidationRule = { type: 'decimal', columnIds: ['value'], operator: 'between', value: 0.5, value2: 1.5 };
    expect(check(rule, 1.25)).toBe(true);
    for (const v of [true, NaN, Infinity, {}, '']) expect(check(rule, v)).toBe(false);
  });
  it('date compares ISO dates, Date objects, and Excel serials', () => {
    const rule: IDataValidationRule = { type: 'date', columnIds: ['value'], operator: 'between', value: '2026-01-01', value2: '2026-01-31' };
    for (const v of ['2026-01-01', new Date('2026-01-15T00:00:00Z'), 46053, '46053']) expect(check(rule, v)).toBe(true);
    for (const v of ['2025-12-31', '2026-02-01', '2026-02-31', 'garbage']) expect(check(rule, v)).toBe(false);
    expect(validationDateSerial('1900-01-01')).toBe(1);
    expect(validationDateSerial('1900-03-01')).toBe(61);
    expect(check({ ...rule, value: '46023', value2: '46053' }, '2026-01-15')).toBe(true);
  });
  it('time checks clock strings and fractions of a day', () => {
    const rule: IDataValidationRule = { type: 'time', columnIds: ['value'], operator: 'between', value: '09:00', value2: '17:00:00' };
    for (const v of ['09:00', '12:30:15', 0.5, new Date('2026-01-01T12:00:00Z')]) expect(check(rule, v)).toBe(true);
    for (const v of ['08:59', '24:00', '12:60', 1, -0.5]) expect(check(rule, v)).toBe(false);
  });
  it('textLength counts text instead of parsing its number', () => {
    const rule: IDataValidationRule = { type: 'textLength', columnIds: ['value'], operator: 'equal', value: 3 };
    expect(check(rule, 'abc')).toBe(true);
    expect(check(rule, 123)).toBe(true);
    expect(check(rule, 'four')).toBe(false);
  });
  for (const type of ['whole', 'decimal', 'date', 'time', 'textLength', 'list', 'custom'] as const) it(`${type} honors allowBlank for null, undefined, and empty text`, () => {
    const rule = { type, columnIds: ['value'], operator: 'greaterThan', value: 0, values: ['a'], formula: '=TRUE' } as IDataValidationRule;
    for (const v of ['', null, undefined]) {
      expect(check({ ...rule, allowBlank: true }, v)).toBe(true);
      expect(check({ ...rule, allowBlank: false }, v)).toBe(false);
    }
  });
  it('list accepts static values case-insensitively and reads live range/named sources', () => {
    const rules: IDataValidationRule[] = [{ type: 'list', columnIds: ['value'], values: ['Open', 7] }];
    expect(check(rules[0] as IDataValidationRule, 'open')).toBe(true);
    expect(check(rules[0] as IDataValidationRule, 'closed')).toBe(false);
    const range: IDataValidationRule = { type: 'list', columnIds: ['value'], source: '=$B$1:$B$2' };
    expect(check(range, 10)).toBe(true);
    expect(check(range, 9)).toBe(false);
    const named = createDataValidator([], { items, columns, namedRanges: { Limits: '$B$1:$B$2' } });
    expect(named.validate({ ...range, source: '=Limits' }, 5, 'value', 0)).toBe(true);
    expect(named.listValues({ ...range, source: '=Limits' }, 'value', 0)).toEqual([5, 10]);
  });
  it('targets the original sheet rows, predicate, columns, and last overlapping rule', () => {
    const first: IDataValidationRule<typeof items[number]> = { type: 'whole', columnIds: ['value'], rows: { start: 1, end: 1 }, operator: 'equal', value: 9, rowFilter: (r) => r.limit > 5 };
    const second: IDataValidationRule<typeof items[number]> = { type: 'list', columnIds: ['value'], rows: { start: 1 }, values: [10] };
    const validator = createDataValidator([first, second], { items, columns });
    expect(validator.isValid(items[0] as typeof items[number], 'value', 0, 100)).toBe(true);
    expect(validator.isValid(items[1] as typeof items[number], 'limit', 1, 100)).toBe(true);
    expect(validator.isValid(items[1] as typeof items[number], 'value', 1, 9)).toBe(false);
    expect(validator.isValid(items[1] as typeof items[number], 'value', 1, 10)).toBe(true);
  });
  it('custom formulas shift relative references and see proposed values without mutating the engine', () => {
    const accessor = { getCellValue: (col: number, row: number) => (items[row] as typeof items[number])?.[col === 0 ? 'value' : 'limit'], getRowCount: () => 2, getColumnCount: () => 2 };
    const engine = new FormulaEngine();
    engine.setFormula(0, 0, '=1+2', accessor);
    const rule: IDataValidationRule = { type: 'custom', columnIds: ['value'], formula: '=AND(A1>0,A1<=$B1)' };
    const validator = createDataValidator([rule], { items, columns, evaluateFormula: (formula, anchor, cell, proposed) => engine.createDetachedEvaluator({ ...accessor }, { proposed: proposed ? { ...cell, value: proposed.value } : undefined })(formula, anchor, cell) });
    expect(validator.validate(rule, 6, 'value', 0)).toBe(false);
    expect(validator.validate(rule, 6, 'value', 1)).toBe(true);
    expect(validator.validate(rule, '=20', 'value', 1)).toBe(false);
    expect(validator.validate({ ...rule, formula: '=1/0' }, 3, 'value', 0)).toBe(false);
    expect(engine.getValue(0, 0)).toBe(3);
    expect(engine.getFormula(0, 0)).toBe('=1+2');
    engine.setFormula(1, 0, '=A1*2', accessor);
    expect(validator.validate({ ...rule, formula: '=SUM(B1)<10' }, 6, 'value', 0)).toBe(false);
    expect(validator.validate({ ...rule, formula: '=SUM(B1)<10' }, 2, 'value', 0)).toBe(true);
    expect(engine.getValue(1, 0)).toBe(6);
    expect(check(rule, 3)).toBe(false);
  });
  it('comparison bounds can be formulas and list formulas can return arrays', () => {
    const engine = new FormulaEngine();
    const accessor = { getCellValue: (col: number, row: number) => col === 1 ? items[row]?.limit : items[row]?.value, getRowCount: () => 2, getColumnCount: () => 2 };
    const validator = createDataValidator([], { items, columns, evaluateFormula: (f, a, c) => engine.createDetachedEvaluator(accessor, { preserveArrays: true })(f, a, c) });
    expect(validator.validate({ type: 'decimal', columnIds: ['value'], operator: 'lessThanOrEqual', value: '=$B1' }, 7, 'value', 1)).toBe(true);
    expect(validator.listValues({ type: 'list', columnIds: ['value'], source: '=OFFSET($B$1,0,0,2,1)' }, 'value', 0)).toEqual([5, 10]);
  });
  it('editing a rectangle preserves outside rules and their formula origin', () => {
    const rule: IDataValidationRule = { type: 'custom', columnIds: ['value', 'limit'], rows: { start: 0, end: 5 }, formula: '=A1>0' };
    const next = replaceDataValidationRange([rule], ['value'], { start: 2, end: 3 });
    const validator = createDataValidator(next, { items, columns });
    expect(validator.ruleFor(items[0] as typeof items[number], 'value', 2)).toBeUndefined();
    expect(validator.ruleFor(items[0] as typeof items[number], 'value', 4)?.anchor).toEqual({ columnId: 'value', row: 0 });
    expect(validator.ruleFor(items[0] as typeof items[number], 'limit', 2)).toBeDefined();
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });
});

it('rejects direct, indirect and range candidate cycles without changing the live graph', () => {
  const accessor = { getCellValue: (col: number, row: number) => items[row]?.[col === 0 ? 'value' : 'limit'], getRowCount: () => 2, getColumnCount: () => 2 };
  const engine = new FormulaEngine();
  engine.setFormula(1, 0, '=A1+1', accessor);
  const rule: IDataValidationRule = { type: 'whole', columnIds: ['value'], operator: 'between', value: 1, value2: 10 };
  const validator = createDataValidator([rule], { items, columns, evaluateFormula: (formula, anchor, cell, proposed) => engine.createDetachedEvaluator(accessor, { proposed: proposed ? { ...cell, value: proposed.value } : undefined })(formula, anchor, cell) });
  for (const candidate of ['=A1+1', '=B1+1', '=SUM(A1:A2)', '=IF(FALSE,A1,3)', '=INDIRECT("A1")+1']) expect(validator.validate(rule, candidate, 'value', 0)).toBe(false);
  expect(validator.validate(rule, '=B2-1', 'value', 0)).toBe(true);
  expect(engine.getFormula(0, 0)).toBeUndefined();
  expect(engine.getValue(1, 0)).toBe(4);
});

it.each(['array arithmetic', 'spill shape'])('validates candidate %s without changing the sheet', kind => {
  const data = [{ value: 2, limit: '' }, { value: 3, limit: '' }, { value: '', limit: '' }];
  const accessor = { getCellValue: (col: number, row: number) => data[row]?.[col === 0 ? 'value' : 'limit'], getRowCount: () => 3, getColumnCount: () => 2 };
  const engine = new FormulaEngine();
  const validator = createDataValidator([], { items: data, columns, evaluateFormula: (f, a, c, proposed) => engine.createDetachedEvaluator(accessor, { preserveArrays: true, proposed: proposed ? { ...c, value: proposed.value } : undefined })(f, a, c) });
  const rule: IDataValidationRule = { type: 'custom', columnIds: ['value'], formula: '=SUM(A1:A2*1)<=10' };
  if (kind === 'array arithmetic') {
    expect(validator.validate(rule, 99, 'value', 0)).toBe(false);
    expect(validator.validate(rule, 4, 'value', 0)).toBe(true);
    expect(data[0]!.value).toBe(2);
    return;
  }
  engine.setFormula(1, 0, '=SEQUENCE(2)', accessor);
  const spill: IDataValidationRule = { type: 'custom', columnIds: ['limit'], formula: '=AND(SUM(B1#)<=3,ROWS(B1#)=2)' };
  expect(validator.validate(spill, '=SEQUENCE(3)', 'limit', 0)).toBe(false);
  expect(validator.validate(spill, '=SEQUENCE(2)', 'limit', 0)).toBe(true);
  expect(engine.getSpillRange(1, 0)).toMatchObject({ endRow: 1 });
  expect(engine.getValue(1, 1)).toBe(2);
  expect(data[0]!.value).toBe(2);
});
