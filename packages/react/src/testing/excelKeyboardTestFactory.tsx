/**
 * Shared Excel keyboard and selection tests: type-to-replace, Enter/Tab inside
 * a selection, whole row/column selection from the sheet headers, the name box
 * and F4 reference cycling. Each UI package calls createExcelKeyboardTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, IOGridProps, IMergedCell } from '../types';

interface SheetRow {
  id: string;
  a: string;
  b: string;
  c: string;
}

const rows: SheetRow[] = ['r0', 'r1', 'r2', 'r3'].map((id, i) => ({ id, a: `a${i}`, b: `b${i}`, c: `c${i}` }));

const columns: IColumnDef<SheetRow>[] = (['a', 'b', 'c'] as const).map((key) => ({
  columnId: key,
  name: key.toUpperCase(),
  editable: true,
  cellEditor: 'text' as const,
}));

function cellAt(container: HTMLElement, rowId: string, columnId: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"] [data-row-index]`);
  if (!el) throw new Error(`no cell ${rowId}/${columnId}`);
  return el;
}

function activeCellText(container: HTMLElement): string | null {
  return container.querySelector('tbody [data-active-cell="true"]')?.textContent ?? null;
}

function selectedCellCount(container: HTMLElement): number {
  return container.querySelectorAll('tbody td[aria-selected="true"]').length;
}

function fireCopy(target: Element): string {
  const data: Record<string, string> = {};
  const event = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { setData: (format: string, value: string) => { data[format] = value; }, getData: () => '' },
  });
  fireEvent(target, event);
  return data['text/plain'] ?? '';
}

async function editorInput(grid: HTMLElement): Promise<HTMLInputElement> {
  return waitFor(() => {
    const el = grid.querySelector<HTMLInputElement>('[data-ogrid-cell-editor] input');
    expect(el).toBeInTheDocument();
    return el as HTMLInputElement;
  });
}

export function createExcelKeyboardTests(OGrid: React.ComponentType<IOGridProps<SheetRow>>): void {
  function renderGrid(overrides: Partial<IOGridProps<SheetRow>> = {}) {
    const onCellValueChanged = jest.fn();
    const props = {
      data: rows,
      columns,
      getRowId: (r: SheetRow) => r.id,
      editable: true,
      onCellValueChanged,
      ...overrides,
    } as IOGridProps<SheetRow>;
    const utils = render(<OGrid {...props} />);
    const grid = utils.container.querySelector('[role="region"]') as HTMLElement;
    const click = (rowId: string, columnId: string, init: { shiftKey?: boolean } = {}) => {
      fireEvent.pointerDown(cellAt(utils.container, rowId, columnId), init);
      grid.focus();
    };
    return { ...utils, grid, click, onCellValueChanged: (overrides.onCellValueChanged as jest.Mock | undefined) ?? onCellValueChanged };
  }

  describe('Excel keyboard and selection', () => {
    it('typing on a selected cell replaces its content (type-to-replace)', async () => {
      const { grid, click, onCellValueChanged } = renderGrid();
      click('r1', 'b');
      fireEvent.keyDown(grid, { key: 'x' });
      const input = await editorInput(grid);
      expect(input.value).toBe('x');
      fireEvent.change(input, { target: { value: 'xy' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'b', oldValue: 'b1', newValue: 'xy' });
    });

    it('Ctrl+letter does not start editing; F2 opens with the current value', async () => {
      const { grid, click } = renderGrid();
      click('r1', 'b');
      fireEvent.keyDown(grid, { key: 'x', ctrlKey: true });
      expect(grid.querySelector('[data-ogrid-cell-editor] input')).toBeNull();
      fireEvent.keyDown(grid, { key: 'F2' });
      expect((await editorInput(grid)).value).toBe('b1');
    });

    it('Shift+Enter in the editor commits and moves up', async () => {
      const { container, grid, click, onCellValueChanged } = renderGrid();
      click('r2', 'a');
      fireEvent.keyDown(grid, { key: 'z' });
      const input = await editorInput(grid);
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(activeCellText(container)).toBe('a1'));
    });

    it('Enter walks a multi-cell selection and keeps it; an edit inside it commits and steps on', async () => {
      const { container, grid, click, onCellValueChanged } = renderGrid();
      click('r0', 'a');
      click('r1', 'b', { shiftKey: true });
      await waitFor(() => expect(selectedCellCount(container)).toBe(4));
      fireEvent.keyDown(grid, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('a1'));
      fireEvent.keyDown(grid, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('b0'));
      // Type into the active cell; Enter commits and moves to the next cell of the range.
      fireEvent.keyDown(grid, { key: 'q' });
      const input = await editorInput(grid);
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(activeCellText(container)).toBe('b1'));
      expect(selectedCellCount(container)).toBe(4);
    });

    it('Tab walks a multi-cell selection row by row', async () => {
      const { container, grid, click } = renderGrid();
      click('r0', 'a');
      click('r1', 'b', { shiftKey: true });
      fireEvent.keyDown(grid, { key: 'Tab' });
      await waitFor(() => expect(activeCellText(container)).toBe('b0'));
      fireEvent.keyDown(grid, { key: 'Tab' });
      await waitFor(() => expect(activeCellText(container)).toBe('a1'));
      expect(selectedCellCount(container)).toBe(4);
    });

    it('Shift+End extends to the end of the row', async () => {
      const { container, grid, click } = renderGrid();
      click('r2', 'a');
      fireEvent.keyDown(grid, { key: 'End', shiftKey: true });
      await waitFor(() => expect(selectedCellCount(container)).toBe(3));
      expect(fireCopy(grid)).toBe('a2\tb2\tc2');
    });

    it('Ctrl+R fills the selection right from its left column', async () => {
      const { grid, click, onCellValueChanged } = renderGrid();
      click('r0', 'a');
      click('r1', 'c', { shiftKey: true });
      fireEvent.keyDown(grid, { key: 'r', ctrlKey: true });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(4));
      const writes = onCellValueChanged.mock.calls.map((c) => [c[0].columnId, c[0].newValue]);
      expect(writes).toEqual([['b', 'a0'], ['c', 'a0'], ['b', 'a1'], ['c', 'a1']]);
    });

    it('clicking a column letter selects the column; copy and Delete act on all of it', async () => {
      const { container, grid, onCellValueChanged } = renderGrid({ cellReferences: true });
      const letterB = container.querySelector<HTMLElement>('thead [data-col-header-index="1"]') as HTMLElement;
      expect(letterB.textContent).toBe('B');
      fireEvent.pointerDown(letterB, { button: 0 });
      await waitFor(() => expect(selectedCellCount(container)).toBe(rows.length));
      expect(fireCopy(grid)).toBe('b0\r\nb1\r\nb2\r\nb3');
      // Shift+click C extends the column selection.
      fireEvent.pointerDown(container.querySelector('thead [data-col-header-index="2"]') as HTMLElement, { button: 0, shiftKey: true });
      await waitFor(() => expect(selectedCellCount(container)).toBe(rows.length * 2));
      fireEvent.keyDown(grid, { key: 'Delete' });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(rows.length * 2));
    });

    it('clicking a row number selects the row; Shift+click extends', async () => {
      const { container, grid } = renderGrid({ cellReferences: true });
      const rowHeader = (i: number) => container.querySelector(`tbody [data-row-header-index="${i}"]`) as HTMLElement;
      fireEvent.pointerDown(rowHeader(1), { button: 0 });
      await waitFor(() => expect(selectedCellCount(container)).toBe(3));
      expect(fireCopy(grid)).toBe('a1\tb1\tc1');
      fireEvent.pointerDown(rowHeader(2), { button: 0, shiftKey: true });
      await waitFor(() => expect(selectedCellCount(container)).toBe(6));
    });

    it('Ctrl+Space selects the column and Shift+Space the row (no row selection)', async () => {
      const { container, grid, click } = renderGrid();
      click('r1', 'b');
      fireEvent.keyDown(grid, { key: ' ', ctrlKey: true });
      await waitFor(() => expect(selectedCellCount(container)).toBe(rows.length));
      click('r1', 'b');
      fireEvent.keyDown(grid, { key: ' ', shiftKey: true });
      await waitFor(() => expect(selectedCellCount(container)).toBe(3));
    });

    it('whole-column selection grows to merged cells it touches', async () => {
      const merge: IMergedCell = { rowId: 'r1', columnId: 'a', colSpan: 2 };
      const { container } = renderGrid({ cellReferences: true, mergedCells: [merge] });
      fireEvent.pointerDown(container.querySelector('thead [data-col-header-index="1"]') as HTMLElement, { button: 0 });
      // The merge on r1 spans A:B, so the selection grows to columns A:B for every
      // row (Excel); the merged td counts once: 4 rows x 2 columns - 1.
      await waitFor(() => expect(selectedCellCount(container)).toBe(rows.length * 2 - 1));
      expect(container.querySelector('tbody tr[data-row-id="r1"] td[data-merged]')?.getAttribute('aria-selected')).toBe('true');
    });

    it('the name box jumps to a typed cell or range; invalid input is flagged; Escape reverts', async () => {
      const { container } = renderGrid({ cellReferences: true, namedRanges: { Top: 'A1:A2' } });
      const nameBox = container.querySelector('input[aria-label="Active cell reference"]') as HTMLInputElement;
      fireEvent.change(nameBox, { target: { value: 'b2:c3' } });
      fireEvent.keyDown(nameBox, { key: 'Enter' });
      await waitFor(() => expect(selectedCellCount(container)).toBe(4));
      expect(activeCellText(container)).toBe('b1');
      await waitFor(() => expect(nameBox.value).toBe('B2'));
      fireEvent.change(nameBox, { target: { value: 'top' } });
      fireEvent.keyDown(nameBox, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('a0'));
      fireEvent.change(nameBox, { target: { value: 'nonsense!' } });
      fireEvent.keyDown(nameBox, { key: 'Enter' });
      expect(nameBox.getAttribute('aria-invalid')).toBe('true');
      fireEvent.keyDown(nameBox, { key: 'Escape' });
      await waitFor(() => expect(nameBox.value).toBe('A1'));
    });

    it('F4 cycles the reference at the caret in the inline editor', async () => {
      const { grid, click } = renderGrid({ formulas: true });
      click('r0', 'c');
      fireEvent.keyDown(grid, { key: '=' });
      const input = await editorInput(grid);
      fireEvent.change(input, { target: { value: '=A1+B1' } });
      input.setSelectionRange(2, 2);
      act(() => { fireEvent.keyDown(input, { key: 'F4' }); });
      await waitFor(() => expect(input.value).toBe('=$A$1+B1'));
      act(() => { fireEvent.keyDown(input, { key: 'F4' }); });
      await waitFor(() => expect(input.value).toBe('=A$1+B1'));
    });

    it('F4 cycles the reference in the formula bar, and its name box navigates', async () => {
      const { container, click } = renderGrid({ formulas: true });
      click('r0', 'c');
      const bar = container.querySelector('input[aria-label="Formula input"]') as HTMLInputElement;
      fireEvent.click(bar);
      fireEvent.change(bar, { target: { value: '=SUM(A1:B2)' } });
      bar.setSelectionRange(7, 7);
      fireEvent.keyDown(bar, { key: 'F4' });
      await waitFor(() => expect(bar.value).toBe('=SUM($A$1:$B$2)'));
      fireEvent.keyDown(bar, { key: 'Escape' });
      const nameBox = container.querySelector('[aria-label="Formula bar"] input[aria-label="Active cell reference"]') as HTMLInputElement;
      fireEvent.change(nameBox, { target: { value: 'B3' } });
      fireEvent.keyDown(nameBox, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('b2'));
    });
  });
}
