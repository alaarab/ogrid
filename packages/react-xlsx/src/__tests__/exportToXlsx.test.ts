/**
 * Export round-trip: build grid data → workbookFromGridData → serialize to a
 * real .xlsx Blob → workbookFromBlob → sheetToGridData → the reimported data
 * must match what was exported.
 */
import { describe, expect, test } from 'bun:test';
import { workbookFromGridData, xlsxBlobFromWorkbook } from '../exportToXlsx';
import { sheetToGridData, workbookFromBlob } from '../sheetMapper';

interface PersonRow {
  id: number;
  name: string;
  age: number;
  joined: Date;
  active: boolean;
}

const people: PersonRow[] = [
  { id: 1, name: 'Ada', age: 30, joined: new Date(Date.UTC(2024, 0, 15)), active: true },
  { id: 2, name: 'Bob', age: 42, joined: new Date(Date.UTC(2023, 5, 1)), active: false },
];

const personColumns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age' },
  { columnId: 'joined', name: 'Joined' },
  { columnId: 'active', name: 'Active' },
];

const getPersonValue = (item: PersonRow, columnId: string) =>
  item[columnId as keyof PersonRow];

async function roundTrip(wb: ReturnType<typeof workbookFromGridData>) {
  const blob = await xlsxBlobFromWorkbook(wb);
  const parsed = await workbookFromBlob(blob);
  const sheet = parsed.worksheets[0];
  return sheetToGridData(sheet);
}

describe('exportToXlsx round-trip', () => {
  test('formula export strips equals and restores the worksheet header offset', async () => {
    for (const headerRow of ['auto', 'none'] as const) {
      const imported = sheetToGridData(workbookFromGridData(
        [{ x: 2, sum: 4 }],
        [{ columnId: 'x', name: 'X' }, { columnId: 'sum', name: 'Sum' }],
        (item, id) => item[id as 'x' | 'sum'],
        { formulas: [{ col: 1, row: 0, formula: '=A1+$A$1' }] },
      ).worksheets[0], { headerRow });
      const wb = workbookFromGridData(imported.rows, imported.columns, (item, id) => item[id], {
        formulas: imported.initialFormulas,
      });
      const parsed = await workbookFromBlob(await xlsxBlobFromWorkbook(wb));
      const cell = parsed.worksheets[0].getCell(headerRow === 'none' ? 'B3' : 'B2');
      expect(cell.formula).toBe(headerRow === 'none' ? 'A3+$A$3' : 'A2+$A$2');
      expect(cell.result).toBe(4);
    }
  });

  test('non-finite values and formula caches serialize as empty cells', async () => {
    const wb = workbookFromGridData([{ a: NaN, b: Infinity, c: -Infinity }], [
      { columnId: 'a', name: 'A' }, { columnId: 'b', name: 'B' }, { columnId: 'c', name: 'C' },
    ], (item, id) => item[id as 'a' | 'b' | 'c'], {
      formulas: [{ col: 2, row: 0, formula: '=1/0' }],
    });
    const parsed = await workbookFromBlob(await xlsxBlobFromWorkbook(wb));
    expect(parsed.worksheets[0].getCell('A2').value).toBeNull();
    expect(parsed.worksheets[0].getCell('B2').value).toBeNull();
    expect(parsed.worksheets[0].getCell('C2').result).toBeUndefined();
  });

  test('sheet names are sanitized before serialization', async () => {
    for (const sheetName of ['', 'a/b:c*?[]\\', "'name'", 'History', 'x'.repeat(40)]) {
      const wb = workbookFromGridData([{ x: 1 }], [{ columnId: 'x', name: 'X' }], (item) => item.x, { sheetName });
      const parsed = await workbookFromBlob(await xlsxBlobFromWorkbook(wb));
      expect(parsed.worksheets[0].name.length).toBeGreaterThan(0);
      expect(parsed.worksheets[0].name.length).toBeLessThanOrEqual(31);
      expect(parsed.worksheets[0].name).not.toMatch(/[\\/*?:[\]]|^'|'$/);
    }
  });

  test('values, headers, and types survive export → serialize → reimport', async () => {
    const wb = workbookFromGridData(people, personColumns, getPersonValue);
    const out = await roundTrip(wb);

    expect(out.columns.map((c) => c.name)).toEqual(['Name', 'Age', 'Joined', 'Active']);
    expect(out.columns.map((c) => c.type)).toEqual(['text', 'numeric', 'date', 'boolean']);
    expect(out.rows.length).toBe(2);
    expect(out.rows[0].A).toBe('Ada');
    expect(out.rows[0].B).toBe(30);
    expect(out.rows[0].D).toBe(true);
    expect(out.rows[1].A).toBe('Bob');
    expect(out.rows[1].D).toBe(false);
  });

  test('custom sheet name is preserved', async () => {
    const wb = workbookFromGridData(people, personColumns, getPersonValue, {
      sheetName: 'People',
    });
    expect(wb.getWorksheet('People')).toBeDefined();
  });

  test('null/undefined values export as empty cells', async () => {
    const rows = [{ a: null, b: undefined, c: 'x' }];
    const cols = [
      { columnId: 'a', name: 'A col' },
      { columnId: 'b', name: 'B col' },
      { columnId: 'c', name: 'C col' },
    ];
    const wb = workbookFromGridData(rows, cols, (item, id) => item[id as keyof (typeof rows)[0]]);
    const out = await roundTrip(wb);
    expect(out.rows[0].A).toBe('');
    expect(out.rows[0].B).toBe('');
    expect(out.rows[0].C).toBe('x');
  });

  test('formulas export as live formula cells with cached results', async () => {
    const rows = [
      { x: 10, y: 20, sum: 30 },
      { x: 3, y: 4, sum: 7 },
    ];
    const cols = [
      { columnId: 'x', name: 'X' },
      { columnId: 'y', name: 'Y' },
      { columnId: 'sum', name: 'Sum' },
    ];
    const wb = workbookFromGridData(rows, cols, (item, id) => item[id as keyof (typeof rows)[0]], {
      formulas: [
        { col: 2, row: 0, formula: '=A1+B1' },
        { col: 2, row: 1, formula: '=A2+B2' },
      ],
    });
    const out = await roundTrip(wb);

    expect(out.initialFormulas).toEqual([
      { col: 2, row: 0, formula: '=A1+B1' },
      { col: 2, row: 1, formula: '=A2+B2' },
    ]);
    // Cached results render on reimport before any recalculation.
    expect(out.rows[0].C).toBe(30);
    expect(out.rows[1].C).toBe(7);
  });

  test('more than 26 columns map past Z through the reimport', async () => {
    const cols = Array.from({ length: 28 }, (_, i) => ({
      columnId: `c${i}`,
      name: `Col ${i}`,
    }));
    const row: Record<string, number> = {};
    for (let i = 0; i < 28; i++) row[`c${i}`] = i;
    const wb = workbookFromGridData([row], cols, (item, id) => item[id]);
    const out = await roundTrip(wb);
    expect(out.columns.length).toBe(28);
    expect(out.rows[0].AA).toBe(26);
    expect(out.rows[0].AB).toBe(27);
  });
});
