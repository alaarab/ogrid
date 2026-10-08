/**
 * Shared Find & Replace interaction tests.
 * Each UI package calls createFindReplaceTests(OGrid) to run these against its own panel.
 */
import * as React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import type { IColumnDef, IOGridProps, ICellValueChangedEvent } from '../types';

interface FruitRow {
  id: string;
  name: string;
  note: string;
  code: string;
}

const NAMES = ['Apple', 'Banana', 'apple pie', 'Cherry', 'Pineapple', 'Grape', 'Melon', 'Crab apple'];
const initialRows: FruitRow[] = NAMES.map((name, i) => ({ id: `r${i}`, name, note: `note ${i}`, code: `APP-${i}` }));

// Unsortable, so rows display in data order.
const columns: IColumnDef<FruitRow>[] = [
  { columnId: 'name', name: 'Name', editable: true, sortable: false },
  { columnId: 'note', name: 'Note', editable: true, sortable: false },
  // Read-only: matched by Find, skipped by Replace.
  { columnId: 'code', name: 'Code', sortable: false },
];

function activeCellText(container: HTMLElement): string | null {
  return container.querySelector('tbody [data-active-cell="true"]')?.textContent ?? null;
}

function bodyCell(container: HTMLElement, row: number, col: number): HTMLElement {
  return container.querySelector<HTMLElement>(`tbody [data-row-index="${row}"][data-col-index="${col}"]`) as HTMLElement;
}

export function createFindReplaceTests(OGrid: React.ComponentType<IOGridProps<FruitRow>>): void {
  /** OGrid over local state, applying every value change like a real host. */
  function Host(props: Partial<IOGridProps<FruitRow>> & { onChange?: (e: ICellValueChangedEvent<FruitRow>) => void }) {
    const { onChange, ...rest } = props;
    const [data, setData] = React.useState(initialRows);
    const onCellValueChanged = React.useCallback((e: ICellValueChangedEvent<FruitRow>) => {
      onChange?.(e);
      setData((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)));
    }, [onChange]);
    const gridProps = {
      data,
      columns,
      getRowId: (r: FruitRow) => r.id,
      editable: true,
      findReplace: true,
      onCellValueChanged,
      ...rest,
    } as IOGridProps<FruitRow>;
    return <OGrid {...gridProps} />;
  }

  function renderGrid(props: React.ComponentProps<typeof Host> = {}) {
    const utils = render(<Host {...props} />);
    const grid = utils.container.querySelector('[role="region"]') as HTMLElement;
    return { ...utils, grid };
  }

  /** Focus the grid on its first cell, then press a shortcut on it. */
  function focusGrid(container: HTMLElement, grid: HTMLElement) {
    fireEvent.pointerDown(bodyCell(container, 0, 0));
    grid.focus();
  }

  async function openFind(container: HTMLElement, grid: HTMLElement, key: 'f' | 'h' = 'f') {
    focusGrid(container, grid);
    fireEvent.keyDown(grid, { key, ctrlKey: true });
    return await screen.findByRole('textbox', { name: 'Find' });
  }

  describe('Find & Replace', () => {
    it.each(['f', 'h'] as const)('protects the selected cell while the lazy Ctrl+%s panel mounts and focuses Find', async (key) => {
      const { container, grid } = renderGrid();
      focusGrid(container, grid);
      fireEvent.keyDown(grid, { key, ctrlKey: true });
      // A keystroke can arrive before the deferred panel commits.
      fireEvent.keyDown(grid, { key: 'x' });
      expect(container.querySelector('tbody input')).toBeNull();
      const input = await screen.findByRole('textbox', { name: 'Find' });
      await waitFor(() => expect(input).toHaveFocus());
      fireEvent.change(input, { target: { value: 'apple' } });
      expect(bodyCell(container, 0, 0).textContent).toBe('Apple');
      expect((input as HTMLInputElement).value).toBe('apple');
    });

    it('Ctrl+F on the focused grid opens Find and focuses its input', async () => {
      const { container, grid } = renderGrid();
      const input = await openFind(container, grid);
      expect(screen.getByRole('search', { name: 'Find and replace' })).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(screen.queryByRole('textbox', { name: 'Replace with' })).toBeNull();
    });

    it('leaves Ctrl+F to the browser when the grid does not have focus', () => {
      renderGrid();
      const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(screen.queryByRole('search')).toBeNull();
    });

    it('does nothing without the findReplace prop', () => {
      const { container, grid } = renderGrid({ findReplace: false });
      focusGrid(container, grid);
      fireEvent.keyDown(grid, { key: 'f', ctrlKey: true });
      expect(screen.queryByRole('search')).toBeNull();
    });

    it('typing jumps to the first match, Enter / Shift+Enter walk the matches with wrapping', async () => {
      const { container, grid } = renderGrid();
      const input = await openFind(container, grid);
      fireEvent.change(input, { target: { value: 'apple' } });
      const status = screen.getByRole('status');
      // Name: Apple, apple pie, Pineapple, Crab apple; Code: APP-* doesn't contain "apple".
      await waitFor(() => expect(status.textContent).toBe('1 of 4'));
      await waitFor(() => expect(activeCellText(container)).toBe('Apple'));
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('apple pie'));
      expect(status.textContent).toBe('2 of 4');
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      await waitFor(() => expect(activeCellText(container)).toBe('Crab apple'));
      expect(status.textContent).toBe('4 of 4');
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('Apple'));
      // Focus stays in the panel while navigating.
      expect(document.activeElement).toBe(input);
    });

    it('highlights every match and reports no results', async () => {
      const { container, grid } = renderGrid();
      const input = await openFind(container, grid);
      fireEvent.change(input, { target: { value: 'apple' } });
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 4'));
      const css = Array.from(container.querySelectorAll('style')).map((s) => s.textContent).join('\n');
      const scope = grid.getAttribute('data-ogrid-find');
      expect(scope).toBeTruthy();
      expect(css).toContain(`[data-ogrid-find="${scope}"] [data-row-id="r4"] > [data-column-id="name"]`);
      expect(css).not.toContain('[data-row-id="r1"]');
      fireEvent.change(input, { target: { value: 'zzz' } });
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No results'));
    });

    it('match case and entire-cell options narrow the matches', async () => {
      const { container, grid } = renderGrid();
      const input = await openFind(container, grid);
      fireEvent.change(input, { target: { value: 'apple' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search options' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Match case' }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 3'));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Match entire cell contents' }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No results'));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Match case' }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 1'));
    });

    it('Escape closes the panel and returns focus to the grid', async () => {
      const { container, grid } = renderGrid();
      const input = await openFind(container, grid);
      fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('search')).toBeNull());
      expect(grid.contains(document.activeElement)).toBe(true);
    });

    it('jumps to the page that holds a match', async () => {
      const { container, grid } = renderGrid({ defaultPageSize: 3, pageSizeOptions: [3] });
      const input = await openFind(container, grid);
      fireEvent.change(input, { target: { value: 'melon' } });
      await waitFor(() => expect(activeCellText(container)).toBe('Melon'));
      expect(screen.getByRole('status').textContent).toBe('1 of 1');
      expect(container.querySelector('tbody tr[data-row-id="r0"]')).toBeNull();
    });

    it('Replace all edits every editable match as one undo step and reports skipped cells', async () => {
      const onChange = jest.fn();
      const { container, grid } = renderGrid({ onChange });
      const input = await openFind(container, grid, 'h');
      fireEvent.change(input, { target: { value: 'ap' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'AP' } });
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/of 13$/));
      fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
      // 4 names + Grape; the 8 read-only codes (APP-n) are skipped.
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Replaced 5 cells, 8 skipped'));
      expect(onChange).toHaveBeenCalledTimes(5);
      await waitFor(() => expect(bodyCell(container, 0, 0).textContent).toBe('APple'));
      expect(bodyCell(container, 5, 0).textContent).toBe('GrAPe');
      // One Ctrl+Z restores every replaced cell.
      fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(bodyCell(container, 0, 0).textContent).toBe('Apple'));
      expect(bodyCell(container, 5, 0).textContent).toBe('Grape');
      expect(bodyCell(container, 4, 0).textContent).toBe('Pineapple');
    });

    it('Replace changes the current match and moves to the next one', async () => {
      const { container, grid } = renderGrid();
      const input = await openFind(container, grid, 'h');
      fireEvent.change(input, { target: { value: 'apple' } });
      const replaceInput = screen.getByRole('textbox', { name: 'Replace with' });
      fireEvent.change(replaceInput, { target: { value: 'pear' } });
      await waitFor(() => expect(activeCellText(container)).toBe('Apple'));
      fireEvent.keyDown(replaceInput, { key: 'Enter' });
      await waitFor(() => expect(bodyCell(container, 0, 0).textContent).toBe('pear'));
      await waitFor(() => expect(activeCellText(container)).toBe('apple pie'));
      expect(screen.getByRole('status').textContent).toBe('Replaced 1 cell');
    });

    it('rejects replacements the column valueParser refuses', async () => {
      const parsedColumns = columns.map((c) =>
        c.columnId === 'name' ? { ...c, valueParser: ({ newValue }: { newValue: unknown }) => (String(newValue).includes('!') ? undefined : newValue) } : c
      );
      const onChange = jest.fn();
      const { container, grid } = renderGrid({ columns: parsedColumns, onChange });
      const input = await openFind(container, grid, 'h');
      fireEvent.change(input, { target: { value: 'Banana' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'Bad!' } });
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 1'));
      fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Replaced 0 cells, 1 skipped'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('skips cells hidden under a merged cell and lands on the anchor', async () => {
      // r0's note spans rows 0-2, hiding "note 1" and "note 2".
      const { container, grid } = renderGrid({ mergedCells: [{ rowId: 'r0', columnId: 'note', rowSpan: 3 }] });
      const input = await openFind(container, grid);
      fireEvent.change(input, { target: { value: 'note' } });
      // 8 notes minus the 2 covered ones.
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 6'));
      await waitFor(() => expect(activeCellText(container)).toBe('note 0'));
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(activeCellText(container)).toBe('note 3'));
    });

    it('Ctrl+H on a read-only grid opens Find only', async () => {
      const { container, grid } = renderGrid({ editable: false });
      await openFind(container, grid, 'h');
      expect(screen.queryByRole('textbox', { name: 'Replace with' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Toggle replace' })).toBeNull();
    });

    it('searches only the selection when asked', async () => {
      const { container, grid } = renderGrid();
      // Select rows 0-2 of the name column, then open Find.
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      fireEvent.pointerDown(bodyCell(container, 2, 0), { shiftKey: true });
      grid.focus();
      fireEvent.keyDown(grid, { key: 'f', ctrlKey: true });
      const input = await screen.findByRole('textbox', { name: 'Find' });
      fireEvent.change(input, { target: { value: 'apple' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search options' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('checkbox', { name: 'Within selection' }));
      });
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/ of 2$/));
    });
  });
}
