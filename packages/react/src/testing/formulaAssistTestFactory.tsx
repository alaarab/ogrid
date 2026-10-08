/**
 * Shared formula editing help tests: function autocomplete and argument hints
 * in the inline cell editor and the formula bar. Each UI package calls
 * createFormulaAssistTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, IOGridProps } from '../types';
import type { IFormulaFunction } from '@alaarab/ogrid-core';

interface Row {
  id: string;
  a: number;
  b: string;
}

const rows: Row[] = [
  { id: 'r0', a: 2, b: '' },
  { id: 'r1', a: 3, b: '' },
];

const columns: IColumnDef<Row>[] = (['a', 'b'] as const).map((key) => ({
  columnId: key,
  name: key.toUpperCase(),
  editable: true,
  cellEditor: 'text' as const,
}));

const DOUBLE: IFormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  description: 'Doubles a number.',
  signature: 'number',
  evaluate: () => 0,
};

function listbox(): HTMLElement | null {
  return document.body.querySelector('[role="listbox"][aria-label="Formula suggestions"]');
}

function optionNames(): string[] {
  return Array.from(listbox()?.querySelectorAll('[role="option"]') ?? []).map((o) => o.textContent?.replace(/^(fx|N)/, '') ?? '');
}

function hint(): HTMLElement | null {
  return document.body.querySelector('[role="tooltip"]');
}

export function createFormulaAssistTests(OGrid: React.ComponentType<IOGridProps<Row>>): void {
  function renderGrid(overrides: Partial<IOGridProps<Row>> = {}) {
    const onCellValueChanged = jest.fn();
    const props = {
      data: rows,
      columns,
      getRowId: (r: Row) => r.id,
      editable: true,
      formulas: true,
      onCellValueChanged,
      ...overrides,
    } as IOGridProps<Row>;
    const utils = render(<OGrid {...props} />);
    const grid = utils.container.querySelector('[role="region"]') as HTMLElement;
    return { ...utils, grid, onCellValueChanged };
  }

  function cell(container: HTMLElement, rowId: string, columnId: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"] [data-row-index]`);
    if (!el) throw new Error(`no cell ${rowId}/${columnId}`);
    return el;
  }

  async function openEditor(container: HTMLElement, grid: HTMLElement, rowId = 'r0', columnId = 'b'): Promise<HTMLInputElement> {
    const target = cell(container, rowId, columnId);
    fireEvent.pointerDown(target);
    fireEvent.doubleClick(target);
    return waitFor(() => {
      const el = grid.querySelector<HTMLInputElement>('[data-ogrid-cell-editor] input');
      expect(el).toBeInTheDocument();
      return el as HTMLInputElement;
    });
  }

  function type(input: HTMLInputElement, value: string, caret = value.length) {
    act(() => {
      fireEvent.change(input, { target: { value } });
      input.setSelectionRange(caret, caret);
      fireEvent.keyUp(input, { key: 'End' });
    });
  }

  describe('formula autocomplete', () => {
    it('lists matching functions as a combobox while a name is typed', async () => {
      const { container, grid } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=sumi');
      await waitFor(() => expect(optionNames()).toEqual(['SUMIF', 'SUMIFS']));
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(input.getAttribute('aria-controls')).toBe(listbox()?.id);
      const options = listbox()?.querySelectorAll('[role="option"]') ?? [];
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
      expect(options[0]?.getAttribute('aria-selected')).toBe('true');
      // The highlighted function's signature and description are shown.
      expect(listbox()?.parentElement?.textContent).toContain('Adds the cells that meet a criterion.');
    });

    it('moves with Up/Down and inserts NAME( with Tab, keeping the editor open', async () => {
      const { container, grid, onCellValueChanged } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=sumi');
      await waitFor(() => expect(listbox()).not.toBeNull());
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      await waitFor(() => expect(listbox()?.querySelectorAll('[role="option"]')[1]?.getAttribute('aria-selected')).toBe('true'));
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'Tab' });
      await waitFor(() => expect(input.value).toBe('=SUMIFS('));
      expect(input.selectionStart).toBe(8);
      expect(grid.querySelector('[data-ogrid-cell-editor] input')).toBe(input);
      expect(onCellValueChanged).not.toHaveBeenCalled();
      await waitFor(() => expect(listbox()).toBeNull());
    });

    it('inserts with Enter while the list is open; Enter commits once it is closed', async () => {
      const { container, grid } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=sums');
      await waitFor(() => expect(optionNames()).toEqual(['SUMSQ']));
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(input.value).toBe('=SUMSQ('));
      type(input, '=SUMSQ(A1,A2)');
      await waitFor(() => expect(listbox()).toBeNull());
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(grid.querySelector('[data-ogrid-cell-editor] input')).toBeNull());
      await waitFor(() => expect(cell(container, 'r0', 'b').textContent).toBe('13'));
    });

    it('Escape closes the list without cancelling the edit; typing reopens it', async () => {
      const { container, grid } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=co');
      await waitFor(() => expect(listbox()).not.toBeNull());
      fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => expect(listbox()).toBeNull());
      expect(grid.querySelector('[data-ogrid-cell-editor] input')).toBe(input);
      expect(input.getAttribute('aria-expanded')).toBe('false');
      type(input, '=cou');
      await waitFor(() => expect(optionNames()[0]).toBe('COUNT'));
    });

    it('inserts the clicked option', async () => {
      const { container, grid } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=1+ave');
      await waitFor(() => expect(optionNames()).toContain('AVERAGEIF'));
      const option = Array.from(listbox()?.querySelectorAll('[role="option"]') ?? []).find((o) => o.textContent?.endsWith('AVERAGEIF')) as HTMLElement;
      const mouseDown = fireEvent.mouseDown(option);
      expect(mouseDown).toBe(false); // default prevented: the editor keeps focus
      fireEvent.click(option);
      await waitFor(() => expect(input.value).toBe('=1+AVERAGEIF('));
    });

    it('lists custom functions and named ranges', async () => {
      const { container, grid } = renderGrid({ formulaFunctions: { DOUBLE }, namedRanges: { TaxRate: 'A1' } });
      const input = await openEditor(container, grid);
      type(input, '=dou');
      await waitFor(() => expect(optionNames()).toEqual(['DOUBLE']));
      expect(listbox()?.parentElement?.textContent).toContain('Doubles a number.');
      type(input, '=1+tax');
      await waitFor(() => expect(optionNames()).toEqual(['TaxRate']));
      // A fully typed name has nothing to insert: Enter commits.
      type(input, '=1+TaxRate');
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(grid.querySelector('[data-ogrid-cell-editor] input')).toBeNull());
    });

    it('shows nothing for plain text, and nothing when formulas are off', async () => {
      const { container, grid, unmount } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, 'sum');
      expect(listbox()).toBeNull();
      unmount();

      const off = renderGrid({ formulas: false });
      const plain = await openEditor(off.container, off.grid);
      type(plain, '=sum');
      expect(listbox()).toBeNull();
      expect(plain.getAttribute('role')).toBeNull();
    });
  });

  describe('formula argument hints', () => {
    it('shows the signature with the current argument bold, tracking nesting', async () => {
      const { container, grid } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=IF(A1>1,');
      await waitFor(() => expect(hint()?.textContent).toBe('IF(logical_test, value_if_true, [value_if_false])'));
      expect(hint()?.querySelector('b')?.textContent).toBe('value_if_true');
      expect(input.getAttribute('aria-describedby')).toBe(hint()?.id);

      type(input, '=IF(A1>1,ROUND(A1,');
      await waitFor(() => expect(hint()?.querySelector('b')?.textContent).toBe('num_digits'));

      type(input, '=IF(A1>1,ROUND(A1,0),', 21);
      await waitFor(() => expect(hint()?.querySelector('b')?.textContent).toBe('[value_if_false]'));
    });

    it('ignores commas inside strings', async () => {
      const { container, grid } = renderGrid();
      const input = await openEditor(container, grid);
      type(input, '=TEXTJOIN(", ", TRUE, ');
      await waitFor(() => expect(hint()?.querySelector('b')?.textContent).toBe('text1'));
    });
  });

  describe('formula bar assist', () => {
    it('autocompletes and hints in the formula bar; Enter still commits when closed', async () => {
      const { container } = renderGrid();
      fireEvent.pointerDown(cell(container, 'r1', 'b'));
      const bar = container.querySelector('input[aria-label="Formula input"]') as HTMLInputElement;
      fireEvent.click(bar);
      await waitFor(() => expect(document.activeElement).toBe(bar));
      type(bar, '=max');
      await waitFor(() => expect(optionNames()).toEqual(['MAX', 'MAXIFS']));
      expect(bar.getAttribute('aria-activedescendant')).toBe(listbox()?.querySelector('[role="option"]')?.id);
      fireEvent.keyDown(bar, { key: 'Tab' });
      await waitFor(() => expect(bar.value).toBe('=MAX('));
      await waitFor(() => expect(hint()?.querySelector('b')?.textContent).toBe('number1'));
      type(bar, '=MAX(A1,A2)');
      fireEvent.keyDown(bar, { key: 'Enter' });
      await waitFor(() => expect(cell(container, 'r1', 'b').textContent).toBe('3'));
      expect(hint()).toBeNull();
    });
  });
}
