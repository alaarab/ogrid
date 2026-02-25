import { applyFillValues } from '../fillHelpers';
import type { IFillFormulaOptions } from '../fillHelpers';
import type { IColumnDef } from '../../types/columnTypes';
import type { ISelectionRange } from '../../types/dataGridTypes';

interface Row {
  id: string;
  value: string | number | null;
}

const COL_A: IColumnDef<Row> = { columnId: 'id', name: 'A', editable: true };
const COL_B: IColumnDef<Row> = { columnId: 'value', name: 'B', editable: true };
const VISIBLE_COLS: IColumnDef<Row>[] = [COL_A, COL_B];

function makeRange(startRow: number, startCol: number, endRow: number, endCol: number): ISelectionRange {
  return { startRow, startCol, endRow, endCol };
}

describe('applyFillValues', () => {
  describe('normal value fill (backward compatible)', () => {
    it('fills value down from source cell when no formula options provided', () => {
      const items: Row[] = [
        { id: 'hello', value: null },
        { id: '', value: null },
        { id: '', value: null },
      ];
      const range = makeRange(0, 0, 2, 0);
      const events = applyFillValues(range, 0, 0, items, VISIBLE_COLS);
      expect(events).toHaveLength(2);
      expect(events[0].rowIndex).toBe(1);
      expect(events[0].newValue).toBe('hello');
      expect(events[1].rowIndex).toBe(2);
      expect(events[1].newValue).toBe('hello');
    });

    it('returns empty array when source cell is out of bounds', () => {
      const items: Row[] = [{ id: 'a', value: null }];
      const range = makeRange(5, 0, 6, 0);
      const events = applyFillValues(range, 5, 0, items, VISIBLE_COLS);
      expect(events).toHaveLength(0);
    });

    it('skips non-editable columns', () => {
      const colReadOnly: IColumnDef<Row> = { columnId: 'id', name: 'A', editable: false };
      const items: Row[] = [
        { id: 'hello', value: null },
        { id: '', value: null },
      ];
      const range = makeRange(0, 0, 1, 0);
      const events = applyFillValues(range, 0, 0, items, [colReadOnly]);
      expect(events).toHaveLength(0);
    });
  });

  describe('formula-aware fill', () => {
    it('fills formula with adjusted references when source cell has a formula', () => {
      const items: Row[] = [
        { id: 'src', value: null },
        { id: '', value: null },
        { id: '', value: null },
      ];
      const formulaStore = new Map<string, string>();
      formulaStore.set('0,0', '=A1+B1'); // flatCol=0, row=0

      const formulaOptions: IFillFormulaOptions<Row> = {
        flatColumns: VISIBLE_COLS,
        hasFormula: (col, row) => formulaStore.has(`${col},${row}`),
        getFormula: (col, row) => formulaStore.get(`${col},${row}`),
        setFormula: (col, row, formula) => {
          if (formula === null) formulaStore.delete(`${col},${row}`);
          else formulaStore.set(`${col},${row}`, formula);
        },
      };

      const range = makeRange(0, 0, 2, 0);
      const events = applyFillValues(range, 0, 0, items, VISIBLE_COLS, formulaOptions);

      // Formula-aware fill skips normal value events (formula evaluation provides the value)
      expect(events).toHaveLength(0);

      // Check formulas were set with adjusted references
      expect(formulaStore.get('0,1')).toBe('=A2+B2'); // row shifted by 1
      expect(formulaStore.get('0,2')).toBe('=A3+B3'); // row shifted by 2
    });

    it('preserves absolute references when filling formulas', () => {
      const items: Row[] = [
        { id: 'src', value: null },
        { id: '', value: null },
      ];
      const formulaStore = new Map<string, string>();
      formulaStore.set('0,0', '=$A$1+B1');

      const formulaOptions: IFillFormulaOptions<Row> = {
        flatColumns: VISIBLE_COLS,
        hasFormula: (col, row) => formulaStore.has(`${col},${row}`),
        getFormula: (col, row) => formulaStore.get(`${col},${row}`),
        setFormula: (col, row, formula) => {
          if (formula === null) formulaStore.delete(`${col},${row}`);
          else formulaStore.set(`${col},${row}`, formula);
        },
      };

      const range = makeRange(0, 0, 1, 0);
      applyFillValues(range, 0, 0, items, VISIBLE_COLS, formulaOptions);

      // $A$1 is absolute; B1 shifts to B2
      expect(formulaStore.get('0,1')).toBe('=$A$1+B2');
    });

    it('falls back to normal value fill when formulaOptions provided but source has no formula', () => {
      const items: Row[] = [
        { id: 'hello', value: null },
        { id: '', value: null },
      ];

      const formulaOptions: IFillFormulaOptions<Row> = {
        flatColumns: VISIBLE_COLS,
        hasFormula: () => false, // no formulas
        getFormula: () => undefined,
        setFormula: () => { /* noop */ },
      };

      const range = makeRange(0, 0, 1, 0);
      const events = applyFillValues(range, 0, 0, items, VISIBLE_COLS, formulaOptions);

      // Should use normal value fill path
      expect(events).toHaveLength(1);
      expect(events[0].newValue).toBe('hello');
    });
  });
});
