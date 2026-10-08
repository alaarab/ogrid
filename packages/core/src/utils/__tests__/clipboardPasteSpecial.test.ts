import {
  applyPastedValues,
  formatSelectionAsTsv,
  formatTsvAsHtmlTable,
  htmlClipboardToTsv,
  parseHtmlClipboard,
  parseTsvClipboard,
  tilePastedRows,
} from '../clipboardHelpers';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  a: unknown;
  b: unknown;
  c: unknown;
}

const COLS: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', editable: true },
  { columnId: 'b', name: 'B', editable: true },
  { columnId: 'c', name: 'C', editable: true },
];

const rows = (n: number): Row[] => Array.from({ length: n }, () => ({ a: null, b: null, c: null }));

describe('tilePastedRows', () => {
  it('a single value fills the whole selection', () => {
    expect(tilePastedRows([['x']], { startRow: 0, startCol: 0, endRow: 1, endCol: 2 })).toEqual([
      ['x', 'x', 'x'],
      ['x', 'x', 'x'],
    ]);
  });

  it('repeats a block when the selection is an exact multiple of it (any corner order)', () => {
    expect(tilePastedRows([['1', '2']], { startRow: 2, startCol: 3, endRow: 0, endCol: 0 })).toEqual([
      ['1', '2', '1', '2'],
      ['1', '2', '1', '2'],
      ['1', '2', '1', '2'],
    ]);
  });

  it('pastes the block once when the selection is not an exact multiple, or not larger', () => {
    const block = [['1', '2']];
    expect(tilePastedRows(block, { startRow: 0, startCol: 0, endRow: 0, endCol: 2 })).toBe(block);
    expect(tilePastedRows(block, { startRow: 0, startCol: 0, endRow: 0, endCol: 1 })).toBe(block);
    expect(tilePastedRows(block, { startRow: 0, startCol: 0, endRow: 0, endCol: 0 })).toBe(block);
  });
});

describe('applyPastedValues formula references', () => {
  it('shifts relative references by the offset from the copied cell (Excel)', () => {
    const setFormula = jest.fn();
    // Copied from B1 (sheet row 0, flat col 1); pasted at C3.
    applyPastedValues([['=A1+$A$1']], 2, 2, rows(4), COLS, {
      colOffset: 0,
      flatColumns: COLS,
      setFormula,
      source: { sheetRows: [0], flatCols: [1] },
    });
    expect(setFormula).toHaveBeenCalledWith(2, 2, '=B3+$A$1');
  });

  it('shifts each tiled copy by its own offset and uses sheet rows', () => {
    const setFormula = jest.fn();
    applyPastedValues([['=A1'], ['=A1']], 0, 0, rows(4), COLS, {
      colOffset: 0,
      flatColumns: COLS,
      setFormula,
      source: { sheetRows: [5], flatCols: [0] },
      // Display row r is sheet row r + 10.
      formulaRow: (r) => r + 10,
    });
    expect(setFormula.mock.calls).toEqual([
      [0, 0, '=A6'],
      [0, 1, '=A7'],
    ]);
  });

  it('pastes external formulas unchanged', () => {
    const setFormula = jest.fn();
    applyPastedValues([['=A1']], 3, 1, rows(4), COLS, { colOffset: 0, flatColumns: COLS, setFormula });
    expect(setFormula).toHaveBeenCalledWith(1, 3, '=A1');
  });
});

describe('formatSelectionAsTsv valuesOnly', () => {
  it('copies formula cells as their computed values', () => {
    const items: Row[] = [{ a: 2, b: null, c: 'x' }];
    const formulaOptions = {
      colOffset: 0,
      flatColumns: COLS,
      hasFormula: (col: number) => col === 1,
      getFormula: () => '=A1*2',
      getFormulaValue: () => 4,
    };
    const range = { startRow: 0, startCol: 0, endRow: 0, endCol: 2 };
    expect(formatSelectionAsTsv(items, COLS, range, formulaOptions)).toBe('2\t=A1*2\tx');
    expect(formatSelectionAsTsv(items, COLS, range, { ...formulaOptions, valuesOnly: true })).toBe('2\t4\tx');
  });
});

describe('HTML clipboard', () => {
  it('renders TSV as an escaped table with <br> for line breaks', () => {
    expect(formatTsvAsHtmlTable('a<b\t"x\r\ny"\r\n1\t&')).toBe(
      '<table><tbody><tr><td>a&lt;b</td><td>x<br>y</td></tr><tr><td>1</td><td>&amp;</td></tr></tbody></table>'
    );
  });

  it('parses a spreadsheet HTML payload into rows, skipping styles and honoring colspan', () => {
    const html = `<html><head><style>td { color: red }</style></head><body>
      <!--StartFragment--><table><tr><th>Name</th><th colspan="2">Wide</th></tr>
      <tr><td>Fish &amp; chips</td><td><b>1</b></td><td>line<br>two</td></tr></table><!--EndFragment--></body></html>`;
    expect(parseHtmlClipboard(html)).toEqual([
      ['Name', 'Wide', ''],
      ['Fish & chips', '1', 'line\ntwo'],
    ]);
  });

  it('reads non-table HTML as one cell', () => {
    expect(parseHtmlClipboard('<p>Hello&nbsp;<em>world</em></p>')).toEqual([['Hello world']]);
    expect(parseHtmlClipboard('<p> </p>')).toEqual([]);
  });

  it('round-trips through TSV', () => {
    const tsv = 'a\tb\r\n"multi\nline"\tc';
    expect(parseTsvClipboard(htmlClipboardToTsv(formatTsvAsHtmlTable(tsv)))).toEqual(parseTsvClipboard(tsv));
  });
});
