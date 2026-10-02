import { expect, it } from 'bun:test';

it('F10: built main entry recognises formula-subpath error instances', async () => {
  const main = await import('../../../dist/esm/index.js');
  const formula = await import('../../../dist/esm/formula/index.js');
  const engine = new formula.FormulaEngine();
  engine.setFormula(0, 0, '=1/0', {
    getCellValue: () => null, getRowCount: () => 1, getColumnCount: () => 1,
  });
  const value = engine.getValue(0, 0);
  const col = { columnId: 'value', name: 'Value', valueFormatter: () => '$NaN' };
  expect(main.resolveCellDisplayContent(col, {}, value)).toBe('#DIV/0!');
  expect(main.resolveCellStyle(col, {}, value)?.color).toBe('var(--ogrid-formula-error-color, #d32f2f)');
});
