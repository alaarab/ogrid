import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { sheetToGridData } from '../sheetMapper';

function buildSheet(rows: unknown[][]): ExcelJS.Worksheet {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('s');
  for (const row of rows) ws.addRow(row);
  return ws;
}

describe('sheetToGridData', () => {
  test('null/empty sheet → empty result', () => {
    const out = sheetToGridData(null);
    expect(out.columns).toEqual([]);
    expect(out.rows).toEqual([]);
    expect(out.initialFormulas).toEqual([]);
  });

  test('column ids stay as Excel letters even when headers are promoted', () => {
    const sheet = buildSheet([
      ['name', 'age', 'city'],
      ['Ada', 30, 'London'],
    ]);
    const out = sheetToGridData(sheet);
    expect(out.columns.map((c) => c.columnId)).toEqual(['A', 'B', 'C']);
    // 'auto' (default) promotes the all-string row 1 to column names.
    expect(out.columns.map((c) => c.name)).toEqual(['name', 'age', 'city']);
  });

  test('headerRow:"none" preserves legacy A/B/C names and keeps row 1 as data', () => {
    const sheet = buildSheet([
      ['name', 'age', 'city'],
      ['Ada', 30, 'London'],
    ]);
    const out = sheetToGridData(sheet, { headerRow: 'none' });
    expect(out.columns.map((c) => c.name)).toEqual(['A', 'B', 'C']);
    expect(out.rows).toEqual([
      { __rowIdx: 0, A: 'name', B: 'age', C: 'city' },
      { __rowIdx: 1, A: 'Ada', B: 30, C: 'London' },
    ]);
  });

  test('row keys match column letters and carry __rowIdx', () => {
    const sheet = buildSheet([
      ['x', 'y'],
      ['p', 'q'],
    ]);
    // Row 1 is all strings, so 'auto' promotes it. Only one data row remains.
    const out = sheetToGridData(sheet);
    expect(out.rows).toEqual([{ __rowIdx: 0, A: 'p', B: 'q' }]);
  });

  test('promoted-header column type is detected from data rows, not the header row', () => {
    const sheet = buildSheet([
      ['name', 'age'],
      ['Ada', 30],
      ['Bob', 42],
      ['Cay', 19],
    ]);
    const out = sheetToGridData(sheet);
    // Column B is numeric once the "age" header is stripped from sampling.
    expect(out.columns[0].type).toBe('text');
    expect(out.columns[1].type).toBe('numeric');
  });

  test('does not promote when row 1 contains a non-string value', () => {
    const sheet = buildSheet([
      ['name', 42],
      ['Ada', 30],
    ]);
    const out = sheetToGridData(sheet);
    // Row 1 is mixed (string + number) so it stays as a data row.
    expect(out.columns.map((c) => c.name)).toEqual(['A', 'B']);
    expect(out.rows.length).toBe(2);
  });

  test('does not promote when there is only one row', () => {
    const sheet = buildSheet([['only', 'header', 'row']]);
    const out = sheetToGridData(sheet);
    // Stripping would leave zero data rows — keep the row instead.
    expect(out.columns.map((c) => c.name)).toEqual(['A', 'B', 'C']);
    expect(out.rows.length).toBe(1);
  });

  test('headerRow:"header" promotes even when row 1 has non-strings (coerces)', () => {
    const sheet = buildSheet([
      ['code', 2026],
      ['A', 1],
      ['B', 2],
    ]);
    const out = sheetToGridData(sheet, { headerRow: 'header' });
    expect(out.columns.map((c) => c.name)).toEqual(['code', '2026']);
    expect(out.rows.length).toBe(2);
  });

  test('falls back to column letter when a promoted header cell is empty', () => {
    const sheet = buildSheet([
      ['name', '', 'city'],
      ['Ada', 30, 'London'],
    ]);
    // 'auto' still promotes because '' counts as no content (not a non-string value).
    const out = sheetToGridData(sheet);
    expect(out.columns.map((c) => c.name)).toEqual(['name', 'B', 'city']);
  });

  test('detects numeric column when no header strings', () => {
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
    const sheet = buildSheet([
      [new Date('2026-01-01'), 'apple'],
      [new Date('2026-02-15'), 'pear'],
    ]);
    const out = sheetToGridData(sheet);
    expect(out.columns[0].type).toBe('date');
    expect(out.columns[1].type).toBe('text');
  });

  test('extracts formulas and surfaces cached results', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('s');
    ws.addRow([10, 20, 30]);
    ws.addRow([3, 4, 7]);
    // ExcelJS uses { formula, result } as the discriminated value shape
    // for formula cells. Our reader records the formula and surfaces
    // the cached result so the grid renders the right thing on first
    // paint, before the engine recalculates.
    ws.getCell('C1').value = { formula: 'A1+B1', result: 30 };
    ws.getCell('C2').value = { formula: 'A2+B2', result: 7 };
    const out = sheetToGridData(ws);
    expect(out.initialFormulas).toEqual([
      { col: 2, row: 0, formula: 'A1+B1' },
      { col: 2, row: 1, formula: 'A2+B2' },
    ]);
    expect(out.rows[0].C).toBe(30);
    expect(out.rows[1].C).toBe(7);
  });

  test('promoted header re-indexes initialFormulas down by one and drops header-row formulas', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('s');
    ws.addRow(['name', 'a', 'b', 'sum']);   // row 1 (header) — promoted away
    ws.addRow(['Ada', 10, 20, 30]);          // row 2 → data row 0
    ws.addRow(['Bob', 3, 4, 7]);             // row 3 → data row 1
    ws.getCell('D1').value = { formula: 'A1', result: 'sum' }; // dropped
    ws.getCell('D2').value = { formula: 'B2+C2', result: 30 };
    ws.getCell('D3').value = { formula: 'B3+C3', result: 7 };
    const out = sheetToGridData(ws);
    expect(out.columns.map((c) => c.name)).toEqual(['name', 'a', 'b', 'sum']);
    expect(out.initialFormulas).toEqual([
      { col: 3, row: 0, formula: 'B2+C2' },
      { col: 3, row: 1, formula: 'B3+C3' },
    ]);
    expect(out.rows[0].D).toBe(30);
    expect(out.rows[1].D).toBe(7);
  });

  test('handles missing cells as empty strings', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('s');
    ws.getCell('A1').value = 'hi';
    ws.getCell('C1').value = 'bye';
    const out = sheetToGridData(ws);
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

  test('flattens rich-text cell values to plain strings', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('s');
    ws.getCell('A1').value = {
      richText: [{ text: 'Hello ' }, { text: 'world' }],
    } as ExcelJS.CellRichTextValue;
    const out = sheetToGridData(ws);
    expect(out.rows[0].A).toBe('Hello world');
  });
});
