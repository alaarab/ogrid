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

  test('header row makes the column read as text', () => {
    const sheet = buildSheet([
      ['name', 'age'],
      ['Ada', 30],
      ['Bob', 42],
      ['Cay', 19],
    ]);
    const out = sheetToGridData(sheet);
    // Mapper does not strip the header row — it's the consumer's job.
    // With "name"/"age" in row 1 both columns are mixed strings + numbers
    // and resolve to 'text'.
    expect(out.columns[0].type).toBe('text');
    expect(out.columns[1].type).toBe('text');
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
