/**
 * Shared merged-cell and frozen-row tests.
 * Each UI package calls createMergedCellsTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { IColumnDef, IOGridProps, IMergedCell } from '../types';

interface SheetRow {
  id: string;
  a: string;
  b: string;
  c: string;
  d: string;
}

const rows: SheetRow[] = ['r0', 'r1', 'r2', 'r3', 'r4'].map((id, i) => ({
  id,
  a: `a${i}`,
  b: `b${i}`,
  c: `c${i}`,
  d: `d${i}`,
}));

const columns: IColumnDef<SheetRow>[] = (['a', 'b', 'c', 'd'] as const).map((key) => ({
  columnId: key,
  name: key.toUpperCase(),
  sortable: true,
  editable: true,
  cellEditor: 'text' as const,
}));

/** Merge rows 1-2 x columns b-c (data columns 1-2). */
const BLOCK: IMergedCell = { rowId: 'r1', columnId: 'b', rowSpan: 2, colSpan: 2 };

function bodyCell(container: HTMLElement, row: number, col: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`tbody [data-row-index="${row}"][data-col-index="${col}"]`);
}

function activeCellText(container: HTMLElement): string | null {
  return container.querySelector('tbody [data-active-cell="true"]')?.textContent ?? null;
}

function bodyRowTexts(container: HTMLElement): string[][] {
  return Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map((tr) =>
    Array.from(tr.querySelectorAll('td[data-column-id]')).map((td) => td.textContent ?? '')
  );
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

export function createMergedCellsTests(OGrid: React.ComponentType<IOGridProps<SheetRow>>): void {
  function renderGrid(overrides: Partial<IOGridProps<SheetRow>> = {}) {
    const props = {
      data: rows,
      columns,
      getRowId: (r: SheetRow) => r.id,
      editable: true,
      onCellValueChanged: jest.fn(),
      mergedCells: [BLOCK],
      ...overrides,
    } as IOGridProps<SheetRow>;
    const utils = render(<OGrid {...props} />);
    const grid = utils.container.querySelector('[role="region"]') as HTMLElement;
    return { ...utils, grid, props };
  }

  describe('merged cells', () => {
    it('renders the anchor across its span and skips the cells it covers', () => {
      const { container } = renderGrid();
      expect(bodyRowTexts(container)).toEqual([
        ['a0', 'b0', 'c0', 'd0'],
        ['a1', 'b1', 'd1'],
        ['a2', 'd2'],
        ['a3', 'b3', 'c3', 'd3'],
        ['a4', 'b4', 'c4', 'd4'],
      ]);
      const anchor = bodyCell(container, 1, 1)?.closest('td');
      expect(anchor?.getAttribute('rowspan')).toBe('2');
      expect(anchor?.getAttribute('colspan')).toBe('2');
    });

    it('arrow keys move over a merged block as one cell', async () => {
      const { container, grid } = renderGrid();
      fireEvent.pointerDown(bodyCell(container, 1, 0) as HTMLElement);
      grid.focus();
      fireEvent.keyDown(grid, { key: 'ArrowRight' });
      await waitFor(() => expect(activeCellText(container)).toBe('b1'));
      fireEvent.keyDown(grid, { key: 'ArrowRight' });
      await waitFor(() => expect(activeCellText(container)).toBe('d1'));
      // Into the block from below lands on its anchor; down again leaves past its end.
      fireEvent.pointerDown(bodyCell(container, 3, 2) as HTMLElement);
      fireEvent.keyDown(grid, { key: 'ArrowUp' });
      await waitFor(() => expect(activeCellText(container)).toBe('b1'));
      fireEvent.keyDown(grid, { key: 'ArrowDown' });
      await waitFor(() => expect(activeCellText(container)).toBe('b3'));
    });

    it('Tab skips the covered cells', async () => {
      const { container, grid } = renderGrid();
      fireEvent.pointerDown(bodyCell(container, 1, 1) as HTMLElement);
      grid.focus();
      fireEvent.keyDown(grid, { key: 'Tab' });
      await waitFor(() => expect(activeCellText(container)).toBe('d1'));
    });

    it('range selection grows to whole merges, and copy writes the anchor value once', async () => {
      const { container, grid } = renderGrid();
      fireEvent.pointerDown(bodyCell(container, 2, 0) as HTMLElement);
      // Shift+click the block: the range takes rows 1-2 x columns a-c.
      fireEvent.pointerDown(bodyCell(container, 1, 1) as HTMLElement, { shiftKey: true });
      await waitFor(() => expect(container.querySelectorAll('tbody td[aria-selected="true"]')).toHaveLength(3));
      expect(fireCopy(grid)).toBe('a1\tb1\t\r\na2\t\t');
    });

    it('editing a merged cell edits its anchor', async () => {
      const onCellValueChanged = jest.fn();
      const { container, grid } = renderGrid({ onCellValueChanged });
      fireEvent.pointerDown(bodyCell(container, 1, 1) as HTMLElement);
      grid.focus();
      fireEvent.keyDown(grid, { key: 'Enter' });
      const input = await waitFor(() => {
        const el = grid.querySelector('input');
        expect(el).toBeInTheDocument();
        return el as HTMLInputElement;
      });
      fireEvent.change(input, { target: { value: 'merged' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'b', newValue: 'merged', item: rows[1] });
      // Enter-commit moves below the whole block.
      await waitFor(() => expect(activeCellText(container)).toBe('b3'));
    });

    it('clips a merge to the current page and drops one whose anchor is not shown', () => {
      const { container } = renderGrid({
        defaultPageSize: 2,
        pageSizeOptions: [2],
        mergedCells: [
          { rowId: 'r1', columnId: 'a', rowSpan: 3, colSpan: 2 },
          { rowId: 'r3', columnId: 'c', rowSpan: 2 },
        ],
      });
      expect(bodyRowTexts(container)).toEqual([
        ['a0', 'b0', 'c0', 'd0'],
        ['a1', 'c1', 'd1'],
      ]);
      const anchor = bodyCell(container, 1, 0)?.closest('td');
      expect(anchor?.getAttribute('rowspan')).toBeNull();
      expect(anchor?.getAttribute('colspan')).toBe('2');
    });

    it('keeps merges that cross the pinned columns inside their side', () => {
      const { container } = renderGrid({
        columns: columns.map((c) => (c.columnId === 'a' ? { ...c, pinned: 'left' as const } : c)),
        mergedCells: [{ rowId: 'r0', columnId: 'a', colSpan: 3, rowSpan: 2 }],
      });
      expect(bodyRowTexts(container).slice(0, 2)).toEqual([
        ['a0', 'b0', 'c0', 'd0'],
        ['b1', 'c1', 'd1'],
      ]);
      expect(bodyCell(container, 0, 0)?.closest('td')?.getAttribute('colspan')).toBeNull();
    });
  });

  describe('frozen rows', () => {
    it('makes the first N rows sticky and leaves the rest scrolling', () => {
      const { container } = renderGrid({ mergedCells: undefined, frozenRows: 2 });
      const bodyRows = Array.from(container.querySelectorAll<HTMLElement>('tbody tr[data-row-id]'));
      expect(bodyRows.map((tr) => tr.hasAttribute('data-frozen-row'))).toEqual([true, true, false, false, false]);
      const frozenCell = bodyRows[0]?.querySelector<HTMLElement>('td[data-column-id]');
      const scrollingCell = bodyRows[2]?.querySelector<HTMLElement>('td[data-column-id]');
      expect(frozenCell?.style.position).toBe('sticky');
      expect(scrollingCell?.style.position).not.toBe('sticky');
    });

    it('frozen pinned cells stick on both axes', () => {
      const { container } = renderGrid({
        mergedCells: undefined,
        frozenRows: 1,
        columns: columns.map((c) => (c.columnId === 'a' ? { ...c, pinned: 'left' as const } : c)),
      });
      const pinned = container.querySelector<HTMLElement>('tbody tr[data-frozen-row] td[data-column-id="a"]');
      expect(pinned?.style.position).toBe('sticky');
      expect(pinned?.style.top).toContain('--ogrid-frozen-top');
      expect(pinned?.style.left).not.toBe('');
    });

    it('always renders the frozen rows under virtual scrolling', () => {
      const many = Array.from({ length: 200 }, (_, i) => ({ id: `v${i}`, a: `a${i}`, b: '', c: '', d: '' }));
      const { container } = renderGrid({
        data: many,
        mergedCells: undefined,
        frozenRows: 2,
        virtualScroll: { enabled: true, rowHeight: 30, threshold: 10, paginate: false },
      });
      const frozen = Array.from(container.querySelectorAll('tbody tr[data-frozen-row]'));
      expect(frozen.map((tr) => tr.getAttribute('data-row-id'))).toEqual(['v0', 'v1']);
    });
  });
}
