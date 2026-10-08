/**
 * Shared conditional formatting tests for the top-level OGrid component.
 * Each UI package calls createConditionalFormattingTests(OGrid).
 *
 * They pin down how rule results reach the DOM: fills, color scales, data bars
 * and borders on the <td> (under the selection tint), text styles on the cell
 * text, icons before it, and repaints when an edit moves the statistics.
 */
import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { IConditionalFormatRule } from '@alaarab/ogrid-core';
import type { IOGridProps, IColumnDef, ICellValueChangedEvent } from '../types';

interface Row {
  id: number;
  region: string;
  sales: number;
  target: number;
}

const rows: Row[] = [
  { id: 1, region: 'North', sales: 100, target: 150 },
  { id: 2, region: 'South', sales: 300, target: 200 },
  { id: 3, region: 'East', sales: 200, target: 250 },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'region', name: 'Region' },
  { columnId: 'sales', name: 'Sales', type: 'numeric', editable: true, cellEditor: 'text' },
  { columnId: 'target', name: 'Target', type: 'numeric' },
];

type Overrides = Partial<IOGridProps<Row>>;

export function createConditionalFormattingTests(OGrid: React.ComponentType<IOGridProps<Row>>): void {
  function Harness({ overrides }: { overrides: Overrides }) {
    const [data, setData] = React.useState(rows);
    const onCellValueChanged = React.useCallback((e: ICellValueChangedEvent<Row>) => {
      setData((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: Number(e.newValue) } : r)));
    }, []);
    const props = {
      columns,
      data,
      getRowId: (r: Row) => r.id,
      editable: true,
      onCellValueChanged,
      defaultSortBy: '',
      ...overrides,
    } as IOGridProps<Row>;
    return <OGrid {...props} />;
  }

  const renderGrid = (rules: IConditionalFormatRule<Row>[], overrides: Overrides = {}) =>
    render(<Harness overrides={{ conditionalFormats: rules, ...overrides }} />);

  function td(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const el = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"]`);
    if (!el) throw new Error(`No cell for row ${rowId}, column ${columnId}`);
    return el as HTMLElement;
  }

  describe('conditional formatting', () => {
    it.each(['cellValue', 'topBottom'] as const)('formats spilled children with a %s rule', type => {
      const data = rows.map(row => ({ ...row, sales: undefined as unknown as number }));
      const rule: IConditionalFormatRule<Row> = type === 'cellValue'
        ? { type, columnIds: ['sales'], operator: 'greaterThan', value: 1, style: { background: '#c6efce' } }
        : { type, columnIds: ['sales'], direction: 'top', rank: 1, style: { background: '#c6efce' } };
      const { container } = renderGrid([rule], { data, formulas: true, initialFormulas: [{ col: 1, row: 0, formula: '=SEQUENCE(3)' }] });
      expect(td(container, 1, 'sales').hasAttribute('data-cf')).toBe(false);
      expect(td(container, 3, 'sales').style.backgroundColor).toBe('#c6efce');
      expect(td(container, 2, 'sales').hasAttribute('data-cf')).toBe(type === 'cellValue');
    });

    it('applies a highlight rule fill to matching cells only, and its text style to their text', () => {
      const { container } = renderGrid([
        { type: 'cellValue', columnIds: ['sales'], operator: 'greaterThan', value: 150, style: { background: '#c6efce', color: '#006100', bold: true } },
      ]);
      const hit = td(container, 2, 'sales');
      expect(hit.style.backgroundColor).toBe('#c6efce');
      expect(hit.hasAttribute('data-cf')).toBe(true);
      const span = hit.querySelector('span[style]') as HTMLElement;
      expect(span.textContent).toBe('300');
      expect(span.style.color).toBe('#006100');
      expect(span.style.fontWeight).toBe('700');
      expect(td(container, 1, 'sales').hasAttribute('data-cf')).toBe(false);
      expect(td(container, 2, 'region').hasAttribute('data-cf')).toBe(false);
    });

    it('draws data bars as a background layer and keeps the cell text', () => {
      const { container } = renderGrid([{ type: 'dataBar', columnIds: ['sales'], color: '#638ec6', gradient: false }]);
      const cell = td(container, 3, 'sales');
      // 200 of 0..300
      expect(cell.style.backgroundImage).toContain('#638ec6 66.67%');
      expect(cell.style.backgroundImage).toContain('transparent 0.00%');
      expect(cell.textContent).toBe('200');
    });

    it('paints a color scale and keeps it on the active cell', () => {
      const { container } = renderGrid([
        { type: 'colorScale', columnIds: ['sales'], stops: [{ type: 'min', color: '#000000' }, { type: 'max', color: '#ffffff' }] },
      ]);
      const cell = td(container, 3, 'sales');
      expect(cell.style.backgroundColor).toBe('#808080');
      fireEvent.pointerDown(cell.querySelector('[data-row-index]') as HTMLElement);
      expect(td(container, 3, 'sales').style.backgroundColor).toBe('#808080');
    });

    it('keeps the format under the range selection tint', () => {
      const { container } = renderGrid([{ type: 'noBlanks', columnIds: ['sales'], style: { background: '#ffeb9c' } }]);
      fireEvent.pointerDown(td(container, 1, 'sales').querySelector('[data-row-index]') as HTMLElement);
      fireEvent.pointerDown(td(container, 3, 'sales').querySelector('[data-row-index]') as HTMLElement, { shiftKey: true });
      const inRange = td(container, 2, 'sales');
      expect(inRange.getAttribute('aria-selected')).toBe('true');
      expect(inRange.style.backgroundColor).toBe('#ffeb9c');
      // The tint itself is a background-image layer (see conditionalFormatCellStyle);
      // happy-dom drops gradients over var() colors, so only its sizing shows here.
      expect(inRange.style.backgroundSize).toBe('100% 100%');
    });

    it('renders icon set icons before the value', () => {
      const { container } = renderGrid([{ type: 'iconSet', columnIds: ['sales'], iconSet: '3Arrows' }]);
      expect(td(container, 2, 'sales').querySelector('[data-cf-icon]')?.getAttribute('data-cf-icon')).toBe('Up');
      expect(td(container, 1, 'sales').querySelector('[data-cf-icon]')?.getAttribute('data-cf-icon')).toBe('Down');
      expect(td(container, 1, 'sales').textContent).toContain('100');
    });

    it('recomputes statistics after an edit and repaints untouched rows', async () => {
      const { container } = renderGrid([{ type: 'topBottom', columnIds: ['sales'], direction: 'top', rank: 1, style: { background: '#ffc7ce' } }]);
      expect(td(container, 2, 'sales').style.backgroundColor).toBe('#ffc7ce');
      const cell = td(container, 1, 'sales').querySelector('[data-row-index]') as HTMLElement;
      fireEvent.pointerDown(cell);
      fireEvent.doubleClick(cell);
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      await waitFor(() => expect(grid.querySelector('tbody input')).toBeInTheDocument());
      const input = grid.querySelector('tbody input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(td(container, 1, 'sales').style.backgroundColor).toBe('#ffc7ce'));
      expect(td(container, 2, 'sales').hasAttribute('data-cf')).toBe(false);
    });

    it('evaluates formula rules per row with the formula engine', () => {
      // $C1 is target; highlight region and sales where sales >= target.
      const { container } = renderGrid(
        [{ type: 'formula', columnIds: ['region', 'sales'], formula: '=$B1>=$C1', style: { background: '#c6efce' } }],
        { formulas: true },
      );
      expect(td(container, 2, 'region').style.backgroundColor).toBe('#c6efce');
      expect(td(container, 2, 'sales').style.backgroundColor).toBe('#c6efce');
      expect(td(container, 1, 'region').hasAttribute('data-cf')).toBe(false);
      expect(td(container, 3, 'sales').hasAttribute('data-cf')).toBe(false);
    });

    it('counts hidden rows in statistics, as Excel does, without painting them', () => {
      // Row 2 (300, the max) is hidden: the visible max (200) is not the top 1.
      const { container } = renderGrid(
        [{ type: 'topBottom', columnIds: ['sales'], direction: 'top', rank: 1, style: { background: '#ffc7ce' } }],
        { hiddenRowIds: [2] },
      );
      expect(container.querySelector('tr[data-row-id="2"]')).toBeNull();
      expect(td(container, 3, 'sales').hasAttribute('data-cf')).toBe(false);
    });

    it('evaluates predicate rules without the formula engine', () => {
      const { container } = renderGrid([
        { type: 'predicate', columnIds: ['region'], test: (_v, row) => row.sales < row.target, style: { italic: true } },
      ]);
      expect((td(container, 1, 'region').querySelector('span[style]') as HTMLElement).style.fontStyle).toBe('italic');
      expect(td(container, 2, 'region').querySelector('span[style]')).toBeNull();
    });
  });
}
