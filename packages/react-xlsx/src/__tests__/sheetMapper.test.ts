import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import { sheetToGridData } from '../sheetMapper';

function buildSheet(rows: unknown[][], opts: XLSX.AOA2SheetOpts = {}): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows as XLSX.AOA2SheetOpts['origin'][][] & unknown[][], opts);
}

describe('sheetToGridData', () => {
  test('empty sheet → empty result', () => {
    const sheet: XLSX.WorkSheet = {};
    const out = sheetToGridData(sheet);
    expect(out.columns).toEqual([]);
    expect(out.rows).toEqual([]);
    expect(out.initialFormulas).toEqual([]);
  });

  test('column ids are Excel letters', () => {
    const sheet = buildSheet([
      ['name', 'age', 'city'],
      ['Ada', 30, 'London'],
    ]);
    const out = sheetToGridData(sheet);
    expect(out.columns.map((c) => c.columnId)).toEqual(['A', 'B', 'C']);
    expect(out.columns.map((c) => c.name)).toEqual(['A', 'B', 'C']);
  });

  test('row keys match column letters and carry __rowIdx', () => {
    const sheet = buildSheet([
      ['x', 'y'],
      ['p', 'q'],
    ]);
    const out = sheetToGridData(sheet);
    expect(out.rows).toEqual([
      { __rowIdx: 0, A: 'x', B: 'y' },
      { __rowIdx: 1, A: 'p', B: 'q' },
    ]);
  });

  test('detects numeric columns', () => {
    const sheet = buildSheet([
      ['name', 'age'],
      ['Ada', 30],
      ['Bob', 42],
      ['Cay', 19],
    ]);
    const out = sheetToGridData(sheet);
    // Header row "name"/"age" makes A column "text" (mixed text + text values),
    // and the same for B because the header row "age" is a string. Mapper does
    // not strip the header row — it's the consumer's job to mark it. So both
    // are 'text'. Verify that explicitly.
    expect(out.columns[0].type).toBe('text');
    expect(out.columns[1].type).toBe('text');
  });

  test('detects numeric column when no header string in B', () => {
    const sheet = buildSheet([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
    const out = sheetToGridData(sheet);
    expect(out.columns[0].type).toBe('numeric');
    expect(out.columns[1].type).toBe('numeric');
  });

  test('detects date column from Date instances', () => {
    // cellDates:true on aoa_to_sheet mirrors XLSX.read(buf, { cellDates: true })
    // — both produce cells whose .v is a real Date object instead of an
    // Excel serial number. Without this, aoa_to_sheet defaults to serials
    // and the mapper would (correctly) classify the column as numeric.
    const sheet = buildSheet([
      [new Date('2026-01-01'), 'apple'],
      [new Date('2026-02-15'), 'pear'],
    ], { cellDates: true });
    const out = sheetToGridData(sheet);
    expect(out.columns[0].type).toBe('date');
    expect(out.columns[1].type).toBe('text');
  });

  test('extracts formulas from cells with .f', () => {
    // aoa_to_sheet doesn't preserve formulas — set them by hand.
    const sheet = XLSX.utils.aoa_to_sheet([
      [10, 20, 0],
      [3, 4, 0],
    ]);
    sheet['C1'] = { t: 'n', v: 30, f: 'A1+B1' };
    sheet['C2'] = { t: 'n', v: 7, f: 'A2+B2' };
    const out = sheetToGridData(sheet);
    expect(out.initialFormulas).toEqual([
      { col: 2, row: 0, formula: 'A1+B1' },
      { col: 2, row: 1, formula: 'A2+B2' },
    ]);
    // Cached values still land in the row data.
    expect(out.rows[0].C).toBe(30);
    expect(out.rows[1].C).toBe(7);
  });

  test('handles missing cells as empty strings', () => {
    const sheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'hi' },
      C1: { t: 's', v: 'bye' },
      '!ref': 'A1:C1',
    };
    const out = sheetToGridData(sheet);
    expect(out.rows).toEqual([{ __rowIdx: 0, A: 'hi', B: '', C: 'bye' }]);
  });

  test('column letters past Z (AA, AB)', () => {
    const cells = new Array(28).fill(0).map((_, i) => i);
    const sheet = buildSheet([cells]);
    const out = sheetToGridData(sheet);
    expect(out.columns.length).toBe(28);
    expect(out.columns[25].columnId).toBe('Z');
    expect(out.columns[26].columnId).toBe('AA');
    expect(out.columns[27].columnId).toBe('AB');
  });
});
