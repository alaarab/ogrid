import { resolveCellStyle, resolveCellDisplayContent } from '../dataGridViewModel';
import { FormulaError } from '../../formula/types';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  id: string;
  value: unknown;
}

const col: IColumnDef<Row> = { columnId: 'value', name: 'Value' };
const item: Row = { id: '1', value: 42 };

describe('resolveCellStyle', () => {
  it('returns error color when displayValue is FormulaError', () => {
    const error = new FormulaError('#DIV/0!');
    const style = resolveCellStyle(col, item, error);
    expect(style).toEqual({ color: 'var(--ogrid-formula-error-color, #d32f2f)' });
  });

  it('merges error color with existing static cellStyle', () => {
    const colWithStyle: IColumnDef<Row> & { cellStyle?: Record<string, string> } = {
      ...col,
      cellStyle: { fontWeight: 'bold' },
    };
    const error = new FormulaError('#VALUE!');
    const style = resolveCellStyle(colWithStyle as IColumnDef<Row>, item, error);
    expect(style).toEqual({ fontWeight: 'bold', color: 'var(--ogrid-formula-error-color, #d32f2f)' });
  });

  it('merges error color with function-based cellStyle', () => {
    const colWithStyle: IColumnDef<Row> & { cellStyle?: (item: Row) => Record<string, string> } = {
      ...col,
      cellStyle: () => ({ textAlign: 'right' }),
    };
    const error = new FormulaError('#REF!');
    const style = resolveCellStyle(colWithStyle as IColumnDef<Row>, item, error);
    expect(style).toEqual({ textAlign: 'right', color: 'var(--ogrid-formula-error-color, #d32f2f)' });
  });

  it('returns undefined when displayValue is not FormulaError and no cellStyle', () => {
    const style = resolveCellStyle(col, item, 42);
    expect(style).toBeUndefined();
  });

  it('returns base cellStyle when displayValue is not FormulaError', () => {
    const colWithStyle: IColumnDef<Row> & { cellStyle?: Record<string, string> } = {
      ...col,
      cellStyle: { color: 'blue' },
    };
    const style = resolveCellStyle(colWithStyle as IColumnDef<Row>, item, 'some string');
    expect(style).toEqual({ color: 'blue' });
  });

  it('returns undefined when no displayValue provided and no cellStyle', () => {
    const style = resolveCellStyle(col, item);
    expect(style).toBeUndefined();
  });

  it('handles all FormulaError types', () => {
    const errorTypes = ['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#CIRC!', '#ERROR!', '#N/A'] as const;
    for (const type of errorTypes) {
      const error = new FormulaError(type);
      const style = resolveCellStyle(col, item, error);
      expect(style?.color).toBe('var(--ogrid-formula-error-color, #d32f2f)');
    }
  });
});

describe('resolveCellDisplayContent', () => {
  it('converts FormulaError to its string representation', () => {
    const error = new FormulaError('#DIV/0!');
    const result = resolveCellDisplayContent(col, item, error);
    expect(result).toBe('#DIV/0!');
  });

  it('converts #REF! FormulaError to string', () => {
    const error = new FormulaError('#REF!');
    const result = resolveCellDisplayContent(col, item, error);
    expect(result).toBe('#REF!');
  });

  it('returns regular values unchanged (uses String fallback)', () => {
    const result = resolveCellDisplayContent(col, item, 42);
    expect(result).toBe('42');
  });

  it('returns null for null displayValue', () => {
    const result = resolveCellDisplayContent(col, item, null);
    expect(result).toBeNull();
  });
});
