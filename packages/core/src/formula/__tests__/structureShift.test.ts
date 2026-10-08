import { shiftFormulaReferences, shiftFormulaCells } from '../cellAddressUtils';

describe('shiftFormulaReferences', () => {
  describe('row inserts', () => {
    it('moves references at or below the insert point, relative and absolute alike', () => {
      expect(shiftFormulaReferences('=A1+A2+$A$3+A$4', 'row', 1, 2)).toBe('=A1+A4+$A$5+A$6');
    });

    it('leaves references above the insert point alone', () => {
      expect(shiftFormulaReferences('=A1*B1', 'row', 1, 1)).toBe('=A1*B1');
    });

    it('grows a range that spans the insert point', () => {
      expect(shiftFormulaReferences('=SUM(A1:A3)', 'row', 1, 1)).toBe('=SUM(A1:A4)');
    });
  });

  describe('row deletes', () => {
    it('turns a reference to a deleted row into #REF!', () => {
      expect(shiftFormulaReferences('=B1+1', 'row', 0, -1)).toBe('=#REF!+1');
    });

    it('moves references below the deleted rows up', () => {
      expect(shiftFormulaReferences('=A5', 'row', 1, -2)).toBe('=A3');
    });

    it('shrinks a range that loses some rows, and #REF!s one that loses all', () => {
      expect(shiftFormulaReferences('=SUM(A1:A5)', 'row', 1, -2)).toBe('=SUM(A1:A3)');
      expect(shiftFormulaReferences('=SUM(A2:A3)', 'row', 1, -2)).toBe('=SUM(#REF!)');
      expect(shiftFormulaReferences('=SUM(A2:A6)', 'row', 0, -3)).toBe('=SUM(A1:A3)');
    });
  });

  describe('columns', () => {
    it('moves column references at or right of an inserted column', () => {
      expect(shiftFormulaReferences('=A1+B1+C1', 'col', 1, 1)).toBe('=A1+C1+D1');
    });

    it('turns a deleted column reference into #REF! and moves the rest left', () => {
      expect(shiftFormulaReferences('=A1+B1+C1', 'col', 1, -1)).toBe('=A1+#REF!+B1');
    });

    it('keeps a reversed range in its written order', () => {
      expect(shiftFormulaReferences('=SUM(C1:A1)', 'col', 0, 1)).toBe('=SUM(D1:B1)');
    });
  });

  it('leaves sheet-qualified references, strings, function names and named ranges alone', () => {
    const f = '=Sheet2!A1+LOG10(A1)+"A1"+Revenue2';
    expect(shiftFormulaReferences(f, 'row', 0, 1)).toBe('=Sheet2!A1+LOG10(A2)+"A1"+Revenue2');
  });

  it('returns a formula it cannot tokenize unchanged', () => {
    expect(shiftFormulaReferences("='unterminated", 'row', 0, 1)).toBe("='unterminated");
  });
});

describe('shiftFormulaCells', () => {
  it('moves formula cells with their rows, drops deleted ones and rewrites references', () => {
    const cells = [
      { col: 3, row: 0, formula: '=B1*C1' },
      { col: 3, row: 2, formula: '=B3+B1' },
    ];
    expect(shiftFormulaCells(cells, 'row', 0, -1)).toEqual([{ col: 3, row: 1, formula: '=B2+#REF!' }]);
    expect(shiftFormulaCells(cells, 'row', 1, 1)).toEqual([
      { col: 3, row: 0, formula: '=B1*C1' },
      { col: 3, row: 3, formula: '=B4+B1' },
    ]);
  });

  it('moves formula cells right when a column is inserted before them', () => {
    expect(shiftFormulaCells([{ col: 2, row: 0, formula: '=A1+B1' }], 'col', 0, 1)).toEqual([
      { col: 3, row: 0, formula: '=B1+C1' },
    ]);
  });
});
