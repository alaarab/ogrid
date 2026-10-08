/**
 * Shared spreadsheet integration tests.
 * Each UI package calls createSpreadsheetTests(DataGridTable) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, IOGridDataGridProps } from '../types';
import { fixtureRows, getRowId, type FixtureRow } from './fixtures';

const twoColumnColumns: IColumnDef<FixtureRow>[] = [
  {
    columnId: 'name',
    name: 'Name',
    sortable: true,
    editable: true,
    cellEditor: 'text',
    renderCell: (item) => <span data-testid={`cell-name-${item.id}`}>{item.name}</span>,
  },
  {
    columnId: 'status',
    name: 'Status',
    sortable: true,
    editable: true,
    cellEditor: 'text',
    renderCell: (item) => <span data-testid={`cell-status-${item.id}`}>{item.status}</span>,
  },
];

/** Get all cell divs that have data-row-index and data-col-index (body cells only). */
function getBodyCells(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-row-index][data-col-index]')).filter(
    (el) => !(el.closest('[role="columnheader"]') ?? el.closest('thead'))
  ) as HTMLElement[];
}

/** Get cell at row and data-column index (col 0 = first data column). */
function getCellAt(container: HTMLElement, rowIndex: number, colIndex: number): HTMLElement {
  const cells = getBodyCells(container);
  const cell = cells.find(
    (c) => c.getAttribute('data-row-index') === String(rowIndex) && c.getAttribute('data-col-index') === String(colIndex)
  );
  if (!cell) throw new Error(`Cell not found at row=${rowIndex}, col=${colIndex}`);
  return cell;
}

/** The gridcell <td> that holds roving focus for a body cell. */
function getTdAt(container: HTMLElement, rowIndex: number, colIndex: number): HTMLElement {
  return getCellAt(container, rowIndex, colIndex).closest('td') as HTMLElement;
}

/** Body cells that are tab stops (roving tabindex: exactly one is expected). */
function getTabStops(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('tbody td[tabindex="0"]'));
}

/**
 * Dispatch a native-style `paste` event carrying `text` as text/plain.
 * happy-dom/jsdom may lack ClipboardEvent, so a plain Event gets `clipboardData`.
 * Returns false when the grid consumed the event (preventDefault).
 */
function firePaste(target: Element, text: string): boolean {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (format: string) => (format === 'text/plain' || format === 'text' ? text : '') },
  });
  return fireEvent(target, event);
}

/**
 * Dispatch a native-style `copy` or `cut` event with a writable clipboardData.
 * Returns what the grid put on it and whether it consumed the event (preventDefault).
 */
function fireCopyOrCut(target: Element, type: 'copy' | 'cut'): { data: Record<string, string>; setData: jest.Mock; consumed: boolean } {
  const data: Record<string, string> = {};
  const setData = jest.fn((format: string, value: string) => { data[format] = value; });
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { setData, getData: (format: string) => data[format] ?? '' },
  });
  const consumed = !fireEvent(target, event);
  return { data, setData, consumed };
}

export function createSpreadsheetTests(DataGridTable: React.ComponentType<IOGridDataGridProps<FixtureRow>>): void {
  function renderSpreadsheetGrid(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) {
    return render(renderSpreadsheetGridElement(overrides));
  }

  function renderSpreadsheetGridElement(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) {
    const defaultProps = {
      items: fixtureRows,
      columns: twoColumnColumns,
      getRowId,
      sortBy: undefined,
      sortDirection: 'asc' as const,
      onColumnSort: jest.fn(),
      visibleColumns: new Set(['name', 'status']),
      filters: {},
      onFilterChange: jest.fn(),
      filterOptions: { status: ['Active', 'Closed'] },
      loadingFilterOptions: {},
      editable: true,
      onCellValueChanged: jest.fn(),
    };
    return <DataGridTable {...defaultProps} {...overrides} />;
  }

  describe('DataGridTable spreadsheet features', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    describe('range selection', () => {
      it('selects a single cell on mousedown and marks it active', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        expect(cell).toBeTruthy();
        fireEvent.pointerDown(cell);
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
        });
      });

      it('extends selection when dragging from one cell to another', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        const cell11 = getCellAt(container, 1, 1);
        expect(cell00).toBeTruthy();
        expect(cell11).toBeTruthy();

        const originalElementFromPoint = document.elementFromPoint;
        document.elementFromPoint = (x: number, y: number) => {
          if (x === 50 && y === 50) return cell11;
          return originalElementFromPoint.call(document, x, y);
        };

        fireEvent.pointerDown(cell00, { clientX: 0, clientY: 0 });
        // Dispatch move/up on window directly  -  jsdom capture-phase listeners on window
        // may not fire for events dispatched on child nodes.
        act(() => {
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, clientY: 50, bubbles: true }));
        });
        act(() => {
          window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        });

        document.elementFromPoint = originalElementFromPoint;

        await waitFor(() => {
          const inRange = container.querySelectorAll('[data-in-range="true"]');
          expect(inRange.length).toBeGreaterThanOrEqual(2);
        });
      });

      it('extends selection on Shift+click to second cell', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        const cell10 = getCellAt(container, 1, 0);
        expect(cell00).toBeTruthy();
        expect(cell10).toBeTruthy();

        fireEvent.pointerDown(cell00);
        await waitFor(() => {
          expect(container.querySelector('[data-active-cell="true"]')).toBeInTheDocument();
        });

        fireEvent.pointerDown(cell10, { shiftKey: true });
        await waitFor(() => {
          const inRange = container.querySelectorAll('[data-in-range="true"]');
          expect(inRange.length).toBeGreaterThanOrEqual(2);
        });
      });

      it('Shift+click extends from the active cell (anchor) and keeps it active', async () => {
        const { container } = renderSpreadsheetGrid();
        const click = (row: number, col: number, shiftKey = false) => {
          const cell = getCellAt(container, row, col);
          fireEvent.pointerDown(cell, { shiftKey });
          fireEvent.click(cell, { shiftKey });
        };
        click(2, 1);
        click(0, 0, true);
        // Range now 0..2 x 0..1 with its top-left at (0,0); the anchor is still (2,1).
        click(1, 1, true);
        await waitFor(() => {
          const active = container.querySelector('[data-active-cell="true"]');
          expect(active?.getAttribute('data-row-index')).toBe('2');
          expect(active?.getAttribute('data-col-index')).toBe('1');
        });
        const inRange = Array.from(container.querySelectorAll('[data-in-range="true"]')).map(
          (el) => `${el.getAttribute('data-row-index')},${el.getAttribute('data-col-index')}`
        );
        expect(inRange.sort()).toEqual(['1,1', '2,1']);
      });

      it('single click selects cell but does not open editor', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        expect(cell).toBeTruthy();
        fireEvent.pointerDown(cell);
        fireEvent.click(cell);
        await waitFor(() => {
          expect(container.querySelector('[data-active-cell="true"]')).toBeInTheDocument();
        });
        const cellInput = cell.querySelector('input');
        const cellSelect = cell.querySelector('select');
        expect(cellInput).toBeNull();
        expect(cellSelect).toBeNull();
      });

      it('double-click opens editor on editable cell', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        expect(cell).toBeTruthy();
        fireEvent.pointerDown(cell);
        fireEvent.click(cell);
        fireEvent.doubleClick(cell);
        await waitFor(() => {
          const grid = container.querySelector('[role="region"]');
          const input = grid?.querySelector('input');
          expect(input).toBeInTheDocument();
        });
      });

      it('Enter opens editor when cell is selected', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        expect(grid).toBeTruthy();
        grid.focus();
        fireEvent.keyDown(grid, { key: 'Enter' });
        await waitFor(() => {
          const input = grid.querySelector('input');
          expect(input).toBeInTheDocument();
        });
      });

      it('F2 opens editor when cell is selected', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();
        fireEvent.keyDown(grid, { key: 'F2' });
        await waitFor(() => {
          const input = grid.querySelector('input');
          expect(input).toBeInTheDocument();
        });
      });

      it('Escape when editing closes editor', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();
        fireEvent.keyDown(grid, { key: 'Enter' });
        await waitFor(() => {
          expect(grid.querySelector('input')).toBeInTheDocument();
        });
        fireEvent.keyDown(grid, { key: 'Escape' });
        await waitFor(() => {
          expect(grid.querySelector('input')).toBeNull();
        });
      });

      it('Escape when not editing clears selection (no editor, no range)', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        await waitFor(() => {
          expect(container.querySelector('[data-active-cell="true"]')).toBeInTheDocument();
        });
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();
        fireEvent.keyDown(grid, { key: 'Escape' });
        expect(grid.querySelector('input')).toBeNull();
        await waitFor(() => {
          const inRange = container.querySelectorAll('[data-in-range="true"]');
          expect(inRange.length).toBe(0);
        });
      });
    });

    describe('cut', () => {
      it('a native cut event marks the cut range; the paste event that follows moves the value and clears the source', async () => {
        const onCellValueChanged = jest.fn();
        const writeText = jest.fn().mockResolvedValue(undefined);
        const readText = jest.fn().mockResolvedValue('FromReadText');
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText, readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        // Ctrl+X is left to the browser, which follows it with the cut event.
        expect(fireEvent.keyDown(grid, { key: 'x', ctrlKey: true })).toBe(true);
        let cut = { data: {} as Record<string, string>, consumed: false };
        await act(async () => {
          cut = fireCopyOrCut(grid, 'cut');
        });
        expect(cut.consumed).toBe(true);
        expect(cut.data['text/plain']).toBe('Alpha');
        expect(writeText).not.toHaveBeenCalled();
        // Nothing is cleared until the paste.
        expect(onCellValueChanged).not.toHaveBeenCalled();
        await waitFor(() => expect(container.querySelector('.ogrid-marching-ants')).toBeInTheDocument());

        fireEvent.pointerDown(getCellAt(container, 1, 0));
        await act(async () => {
          firePaste(grid, cut.data['text/plain'] ?? '');
        });

        const changes = onCellValueChanged.mock.calls.map((c: unknown[]) => {
          const e = c[0] as { rowIndex: number; columnId: string; newValue: unknown };
          return [e.rowIndex, e.columnId, e.newValue];
        });
        expect(changes).toEqual([[1, 'name', 'Alpha'], [0, 'name', '']]);
        expect(readText).not.toHaveBeenCalled();
        await waitFor(() => expect(container.querySelector('.ogrid-marching-ants')).toBeNull());
      });

      it('cut then paste onto the same cell keeps the pasted value', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        let text = '';
        await act(async () => {
          text = fireCopyOrCut(grid, 'cut').data['text/plain'] ?? '';
        });
        await act(async () => {
          firePaste(grid, text);
        });
        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalled());
        const values = onCellValueChanged.mock.calls.map((c: unknown[]) => (c[0] as { newValue: unknown }).newValue);
        expect(values).not.toContain('');
      });
    });

    describe('copy', () => {
      it('a native copy event puts the selected range on clipboardData as TSV and marks the copy range', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid();
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        fireEvent.pointerDown(getCellAt(container, 0, 1), { shiftKey: true });
        const grid = container.querySelector('[role="region"]') as HTMLElement;

        let copy = { data: {} as Record<string, string>, consumed: false };
        await act(async () => {
          copy = fireCopyOrCut(grid, 'copy');
        });

        expect(copy.consumed).toBe(true);
        expect(copy.data['text/plain']).toBe('Alpha\tActive');
        expect(writeText).not.toHaveBeenCalled();
        await waitFor(() => expect(container.querySelector('.ogrid-marching-ants')).toBeInTheDocument());
      });

      it('Ctrl+C keydown is not prevented and the copy event that follows copies exactly once', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid();
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        // The browser only fires `copy` when keydown was not prevented.
        expect(fireEvent.keyDown(grid, { key: 'c', ctrlKey: true })).toBe(true);
        expect(fireEvent.keyDown(grid, { key: 'c', metaKey: true })).toBe(true);
        let copy = { setData: jest.fn(), consumed: false };
        await act(async () => {
          copy = fireCopyOrCut(grid, 'copy');
        });
        await act(async () => { await Promise.resolve(); });

        expect(copy.consumed).toBe(true);
        // Once: one text/plain write (next to its text/html table).
        expect(copy.setData.mock.calls.filter(([format]) => format === 'text/plain')).toHaveLength(1);
        expect(copy.setData).toHaveBeenCalledWith('text/plain', 'Alpha');
        expect(writeText).not.toHaveBeenCalled();
      });

      it('without navigator.clipboard (plain http) a copy event still feeds the in-page paste fallback', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        await act(async () => {
          fireCopyOrCut(grid, 'copy');
        });
        fireEvent.pointerDown(getCellAt(container, 2, 1));
        await act(async () => {
          firePaste(grid, '');
        });
        expect(onCellValueChanged).toHaveBeenCalledTimes(1);
        expect(onCellValueChanged.mock.calls[0][0]).toEqual(expect.objectContaining({ rowIndex: 2, columnId: 'status', newValue: 'Alpha' }));
      });

      it('a copy or cut event inside an open cell editor is left to the editor', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        fireEvent.doubleClick(cell);
        const input = await waitFor(() => {
          const el = grid.querySelector('input');
          expect(el).toBeInTheDocument();
          return el as HTMLInputElement;
        });
        input.focus();

        const copy = fireCopyOrCut(input, 'copy');
        const cut = fireCopyOrCut(input, 'cut');

        for (const e of [copy, cut]) {
          expect(e.consumed).toBe(false);
          expect(e.setData).not.toHaveBeenCalled();
        }
        expect(onCellValueChanged).not.toHaveBeenCalled();
        expect(grid.querySelector('input')).toBeInTheDocument();
        expect(container.querySelector('.ogrid-marching-ants')).toBeNull();
      });
    });

    describe('paste', () => {
      it('a rejected clipboard read calls onClipboardError and pastes nothing', async () => {
        const onCellValueChanged = jest.fn();
        const onClipboardError = jest.fn();
        const readText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
        Object.defineProperty(navigator, 'clipboard', {
          value: { readText, writeText: jest.fn().mockResolvedValue(undefined) },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged, onClipboardError });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        // An earlier in-grid copy must not be pasted when the read fails.
        await act(async () => {
          fireCopyOrCut(grid, 'copy');
        });
        const cell10 = getCellAt(container, 1, 0);
        fireEvent.pointerDown(cell10);
        // The context menu is the programmatic (readText) paste path.
        fireEvent.contextMenu(cell10, { clientX: 100, clientY: 100 });
        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Paste'));

        await waitFor(() => expect(onClipboardError).toHaveBeenCalledTimes(1));
        expect(onCellValueChanged).not.toHaveBeenCalled();
      });

      it('pastes the text carried by a native paste event, once per cell, without reading navigator.clipboard', async () => {
        const onCellValueChanged = jest.fn();
        const readText = jest.fn().mockResolvedValue('FromReadText');
        Object.defineProperty(navigator, 'clipboard', {
          value: { readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        let consumed = true;
        await act(async () => {
          consumed = !firePaste(grid, 'Pasted1\tPasted2\nPasted3\tPasted4');
        });

        expect(consumed).toBe(true);
        expect(readText).not.toHaveBeenCalled();
        expect(onCellValueChanged).toHaveBeenCalledTimes(4);
        const values = onCellValueChanged.mock.calls.map((c: unknown[]) => (c[0] as { newValue: unknown }).newValue);
        expect(values).toEqual(['Pasted1', 'Pasted2', 'Pasted3', 'Pasted4']);
        expect(onCellValueChanged.mock.calls[0][0]).toEqual(expect.objectContaining({ rowIndex: 0, columnId: 'name' }));
        expect(onCellValueChanged.mock.calls[3][0]).toEqual(expect.objectContaining({ rowIndex: 1, columnId: 'status' }));
      });

      it('Ctrl+V keydown followed by its paste event pastes exactly once', async () => {
        const onCellValueChanged = jest.fn();
        const readText = jest.fn().mockResolvedValue('FromReadText');
        Object.defineProperty(navigator, 'clipboard', {
          value: { readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        // The browser only fires `paste` when keydown was not prevented.
        const keydownHandled = !fireEvent.keyDown(grid, { key: 'v', ctrlKey: true });
        expect(keydownHandled).toBe(false);
        await act(async () => {
          firePaste(grid, 'FromEvent');
        });
        // Give any stray readText-based paste a chance to land before asserting.
        await act(async () => { await Promise.resolve(); });

        expect(readText).not.toHaveBeenCalled();
        expect(onCellValueChanged).toHaveBeenCalledTimes(1);
        expect(onCellValueChanged.mock.calls[0][0]).toEqual(expect.objectContaining({ rowIndex: 0, columnId: 'name', newValue: 'FromEvent' }));
      });

      it('a paste event inside an open cell editor is left to the editor', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        fireEvent.doubleClick(cell);
        const input = await waitFor(() => {
          const el = grid.querySelector('input');
          expect(el).toBeInTheDocument();
          return el as HTMLInputElement;
        });
        input.focus();

        let consumed = true;
        await act(async () => {
          consumed = !firePaste(input, 'Hijacked');
        });

        expect(consumed).toBe(false);
        expect(onCellValueChanged).not.toHaveBeenCalled();
        // The editor is still open: the grid did not treat the paste as its own.
        expect(grid.querySelector('input')).toBeInTheDocument();
      });
    });

    describe('context menu', () => {
      it('shows context menu on right-click with Undo, Redo, Copy, Cut, Paste, Select all; does not open editor', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        expect(cell00).toBeTruthy();

        fireEvent.contextMenu(cell00, { clientX: 100, clientY: 100 });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
          expect(screen.getByRole('menu')).toHaveAttribute('aria-label', 'Grid context menu');
          expect(screen.getByText('Undo')).toBeInTheDocument();
          expect(screen.getByText('Redo')).toBeInTheDocument();
          expect(screen.getByText('Copy')).toBeInTheDocument();
          expect(screen.getByText('Cut')).toBeInTheDocument();
          expect(screen.getByText('Paste')).toBeInTheDocument();
          expect(screen.getByText('Select all')).toBeInTheDocument();
        });
        const grid = container.querySelector('[role="region"]');
        expect(grid?.querySelector('input')).toBeNull();
      });

      it('shows context menu on right-click on a cell (Excel-like)', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        expect(cell00).toBeTruthy();

        fireEvent.contextMenu(cell00, { clientX: 50, clientY: 50 });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
          expect(screen.getByText('Undo')).toBeInTheDocument();
          expect(screen.getByText('Redo')).toBeInTheDocument();
          expect(screen.getByText('Copy')).toBeInTheDocument();
          expect(screen.getByText('Cut')).toBeInTheDocument();
          expect(screen.getByText('Paste')).toBeInTheDocument();
          expect(screen.getByText('Select all')).toBeInTheDocument();
        });
      });

      it('does not show context menu when right-clicking the grid wrapper (only cells)', async () => {
        const { container } = renderSpreadsheetGrid();
        const grid = container.querySelector('[role="region"]');
        expect(grid).toBeTruthy();

        fireEvent.contextMenu(grid as Element, { clientX: 100, clientY: 100 });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });

      it('shows context menu on Shift+F10 when a cell is selected', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        expect(grid).toBeTruthy();
        grid.focus();

        fireEvent.keyDown(grid, { key: 'F10', shiftKey: true });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
          expect(screen.getByText('Undo')).toBeInTheDocument();
          expect(screen.getByText('Redo')).toBeInTheDocument();
          expect(screen.getByText('Copy')).toBeInTheDocument();
          expect(screen.getByText('Cut')).toBeInTheDocument();
          expect(screen.getByText('Paste')).toBeInTheDocument();
          expect(screen.getByText('Select all')).toBeInTheDocument();
        });
      });

      it('Select all selects all data cells', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.contextMenu(cell00, { clientX: 100, clientY: 100 });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        const selectAllButton = screen.getByText('Select all');
        fireEvent.click(selectAllButton);

        await waitFor(() => {
          const inRange = container.querySelectorAll('[data-in-range="true"]');
          expect(inRange.length).toBe(fixtureRows.length * 2);
        });
      });

      it('Copy from context menu copies to clipboard', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        fireEvent.contextMenu(cell00, { clientX: 100, clientY: 100 });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Copy'));

        // The menu has no native copy event, so it writes programmatically, once.
        await waitFor(() => {
          expect(writeText).toHaveBeenCalledTimes(1);
        });
        expect(writeText).toHaveBeenCalledWith('Alpha');
      });

      it('Cut from context menu copies to clipboard and sets cut buffer', async () => {
        let clipboardText = '';
        const writeText = jest.fn().mockImplementation((t: string) => { clipboardText = t; return Promise.resolve(); });
        const readText = jest.fn().mockImplementation(() => Promise.resolve(clipboardText));
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText, readText },
          configurable: true,
        });
        const onCellValueChanged = jest.fn();

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]');
        fireEvent.contextMenu(cell00, { clientX: 100, clientY: 100 });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cut'));

        await waitFor(() => {
          expect(writeText).toHaveBeenCalled();
        });

        fireEvent.pointerDown(getCellAt(container, 1, 0));
        await act(async () => {
          firePaste(grid as Element, clipboardText);
        });
        await waitFor(() => {
          const clearCalls = onCellValueChanged.mock.calls.filter((c: unknown[]) => (c[0] as { newValue: unknown }).newValue === '');
          expect(clearCalls.length).toBeGreaterThanOrEqual(1);
        });
      });

      it('Paste from context menu pastes at active cell', async () => {
        const onCellValueChanged = jest.fn();
        const readText = jest.fn().mockResolvedValue('PastedFromMenu');
        Object.defineProperty(navigator, 'clipboard', {
          value: { readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        fireEvent.contextMenu(cell00, { clientX: 100, clientY: 100 });

        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Paste'));

        // The menu has no native paste event to read from, so it uses readText.
        await waitFor(() => {
          expect(readText).toHaveBeenCalledTimes(1);
          expect(onCellValueChanged).toHaveBeenCalledTimes(1);
          const values = onCellValueChanged.mock.calls.map((c: unknown[]) => (c[0] as { newValue: unknown }).newValue);
          expect(values).toContain('PastedFromMenu');
        });
      });
    });

    describe('keyboard navigation with selection', () => {
      it('Arrow key moves active cell and collapses selection', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]');
        expect(grid).toBeTruthy();
        (grid as HTMLElement).focus();

        fireEvent.keyDown(grid as Element, { key: 'ArrowRight' });

        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-col-index')).toBe('1');
        });
      });

      it('Shift+Arrow extends selection', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]');
        (grid as HTMLElement).focus();

        fireEvent.keyDown(grid as Element, { key: 'ArrowDown', shiftKey: true });

        await waitFor(() => {
          const inRange = container.querySelectorAll('[data-in-range="true"]');
          expect(inRange.length).toBeGreaterThanOrEqual(2);
        });
      });

      it('Tab moves active cell right; at end of row wraps to next row', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        fireEvent.keyDown(grid, { key: 'Tab' });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('0');
          expect(active[0]!.getAttribute('data-col-index')).toBe('1');
        });

        fireEvent.keyDown(grid, { key: 'Tab' });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('1');
          expect(active[0]!.getAttribute('data-col-index')).toBe('0');
        });
      });

      it('Shift+Tab moves active cell left; at start of row wraps to previous row', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell10 = getCellAt(container, 1, 0);
        fireEvent.pointerDown(cell10);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        fireEvent.keyDown(grid, { key: 'Tab', shiftKey: true });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('0');
          expect(active[0]!.getAttribute('data-col-index')).toBe('1');
        });
      });

      it('Home moves to first column; Ctrl+Home moves to first cell', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell11 = getCellAt(container, 1, 1);
        fireEvent.pointerDown(cell11);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        fireEvent.keyDown(grid, { key: 'Home' });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('1');
          expect(active[0]!.getAttribute('data-col-index')).toBe('0');
        });

        fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('0');
          expect(active[0]!.getAttribute('data-col-index')).toBe('0');
        });
      });

      it('End moves to last column; Ctrl+End moves to last cell', async () => {
        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        fireEvent.keyDown(grid, { key: 'End' });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('0');
          expect(active[0]!.getAttribute('data-col-index')).toBe('1');
        });

        fireEvent.keyDown(grid, { key: 'End', ctrlKey: true });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0]!.getAttribute('data-row-index')).toBe('2');
          expect(active[0]!.getAttribute('data-col-index')).toBe('1');
        });
      });
    });

    describe('roving focus', () => {
      const getGrid = (container: HTMLElement) => container.querySelector('[role="region"]') as HTMLElement;

      it('makes exactly one body cell a tab stop: the first data cell before any cell is active', () => {
        const { container } = renderSpreadsheetGrid();
        expect(getTabStops(container)).toEqual([getTdAt(container, 0, 0)]);
        // 3 rows x 2 data columns: every other data cell is focusable but not tabbable.
        expect(container.querySelectorAll('tbody td[tabindex="-1"]').length).toBe(5);
        // The wrapper is not a second tab stop while a cell is one.
        expect(getGrid(container).tabIndex).toBe(-1);
      });

      it('focusing the tab-stop cell (Tab into the grid) makes it the active cell', async () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 0, 0).focus());
        await waitFor(() => {
          const active = container.querySelector('[data-active-cell="true"]');
          expect(active?.getAttribute('data-row-index')).toBe('0');
          expect(active?.getAttribute('data-col-index')).toBe('0');
        });
        expect(document.activeElement).toBe(getTdAt(container, 0, 0));
      });

      it('DOM focus and the tab stop follow arrow keys, Home/End and Tab', async () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 0, 0).focus());
        const press = (key: string, init: Record<string, unknown> = {}) =>
          act(() => { fireEvent.keyDown(document.activeElement as Element, { key, ...init }); });

        press('ArrowDown');
        expect(document.activeElement).toBe(getTdAt(container, 1, 0));
        press('ArrowRight');
        expect(document.activeElement).toBe(getTdAt(container, 1, 1));
        press('Home', { ctrlKey: true });
        expect(document.activeElement).toBe(getTdAt(container, 0, 0));
        press('End', { ctrlKey: true });
        expect(document.activeElement).toBe(getTdAt(container, 2, 1));
        press('Tab', { shiftKey: true });
        expect(document.activeElement).toBe(getTdAt(container, 2, 0));
        expect(getTabStops(container)).toEqual([getTdAt(container, 2, 0)]);
      });

      it('Shift+Arrow keeps focus on the active cell (the range anchor)', () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 0, 0).focus());
        act(() => { fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown', shiftKey: true }); });
        expect(container.querySelectorAll('[data-in-range="true"]').length).toBe(2);
        expect(document.activeElement).toBe(getTdAt(container, 0, 0));
      });

      it('clicking a cell moves DOM focus to it', () => {
        const { container } = renderSpreadsheetGrid();
        act(() => {
          fireEvent.pointerDown(getCellAt(container, 2, 1));
          fireEvent.click(getCellAt(container, 2, 1));
        });
        expect(document.activeElement).toBe(getTdAt(container, 2, 1));
        expect(getTabStops(container)).toEqual([getTdAt(container, 2, 1)]);
      });

      it('returns focus to the active cell after an edit commits (Enter) or cancels (Escape)', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        act(() => getTdAt(container, 1, 0).focus());
        const openEditor = async () => {
          act(() => { fireEvent.keyDown(document.activeElement as Element, { key: 'F2' }); });
          await waitFor(() => expect(getGrid(container).querySelector('input')).toBeInTheDocument());
          return getGrid(container).querySelector('input') as HTMLInputElement;
        };

        let input = await openEditor();
        fireEvent.change(input, { target: { value: 'Committed' } });
        act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
        await waitFor(() => expect(getGrid(container).querySelector('input')).toBeNull());
        expect(onCellValueChanged).toHaveBeenCalledTimes(1);
        const afterCommit = container.querySelector('[data-active-cell="true"]')?.closest('td');
        expect(afterCommit).toBeTruthy();
        expect(document.activeElement).toBe(afterCommit);

        input = await openEditor();
        act(() => { fireEvent.keyDown(input, { key: 'Escape' }); });
        await waitFor(() => expect(getGrid(container).querySelector('input')).toBeNull());
        expect(document.activeElement).toBe(container.querySelector('[data-active-cell="true"]')?.closest('td'));
      });

      it('Tab at the last cell is left to the browser so focus can leave the grid', () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 2, 1).focus());
        // Not prevented: the browser moves focus to the next tabbable element after the grid.
        expect(fireEvent.keyDown(getTdAt(container, 2, 1), { key: 'Tab' })).toBe(true);
        // Mid-grid Tab moves between cells instead.
        act(() => { fireEvent.keyDown(getTdAt(container, 2, 1), { key: 'Home', ctrlKey: true }); });
        expect(document.activeElement).toBe(getTdAt(container, 0, 0));
        expect(fireEvent.keyDown(getTdAt(container, 0, 0), { key: 'Tab' })).toBe(false);
      });

      it('copy and paste events fired at the focused cell are handled exactly once', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        act(() => getTdAt(container, 0, 0).focus());
        let copy = { data: {} as Record<string, string>, setData: jest.fn(), consumed: false };
        await act(async () => {
          copy = fireCopyOrCut(document.activeElement as Element, 'copy');
        });
        expect(copy.consumed).toBe(true);
        // Once: one text/plain write (next to its text/html table).
        expect(copy.setData.mock.calls.filter(([format]) => format === 'text/plain')).toHaveLength(1);
        expect(copy.data['text/plain']).toBe('Alpha');

        act(() => { fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' }); });
        let consumed = false;
        await act(async () => {
          consumed = !firePaste(document.activeElement as Element, 'Pasted');
        });
        expect(consumed).toBe(true);
        expect(onCellValueChanged).toHaveBeenCalledTimes(1);
        expect(onCellValueChanged.mock.calls[0][0]).toEqual(expect.objectContaining({ rowIndex: 1, columnId: 'name', newValue: 'Pasted' }));
      });

      it('Escape clears the active cell but focus and the tab stop stay on that cell', () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 1, 1).focus());
        act(() => { fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' }); });
        expect(container.querySelector('[data-active-cell="true"]')).toBeNull();
        expect(document.activeElement).toBe(getTdAt(container, 1, 1));
        expect(getTabStops(container)).toEqual([getTdAt(container, 1, 1)]);
      });

      it('makes the wrapper the tab stop when the grid has no rows', () => {
        const { container } = renderSpreadsheetGrid({ items: [] });
        expect(getTabStops(container)).toEqual([]);
        expect(getGrid(container).tabIndex).toBe(0);
      });

      it('moves focus from the wrapper into the active cell after a header control hands focus back', () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 0, 1).focus());
        act(() => getGrid(container).focus());
        act(() => { fireEvent.keyDown(getGrid(container), { key: 'ArrowDown' }); });
        expect(document.activeElement).toBe(getTdAt(container, 1, 1));
      });

      describe('with a scaled windowed source (rows scrolled out of the DOM)', () => {
        // happy-dom has no layout; give elements a size so the virtualizer renders a window.
        const sizes = { clientHeight: 360, offsetHeight: 360, offsetWidth: 800 };
        const originals = Object.keys(sizes).map((key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
        beforeAll(() => {
          for (const [key, value] of Object.entries(sizes)) {
            Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value });
          }
        });
        afterAll(() => {
          for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
            else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
          }
        });

        // 2M rows is past the ~890k-row point where the spacer height is scaled.
        const ROW_COUNT = 2_000_000;
        function windowedSource() {
          const loadedRows: FixtureRow[] = [];
          loadedRows.length = ROW_COUNT;
          for (let i = 0; i < 40; i++) loadedRows[i] = { id: String(i), name: `Row ${i}`, status: 'Active' };
          return {
            rowCount: ROW_COUNT,
            loadedRows,
            getRow: (i: number) => (loadedRows[i] ? { status: 'loaded' as const, row: loadedRows[i] as FixtureRow } : { status: 'loading' as const }),
            requestWindow: jest.fn(),
            retryRow: jest.fn(),
          };
        }
        const scrollTo = async (wrapper: HTMLElement, top: number) => {
          await act(async () => {
            wrapper.scrollTop = top;
            fireEvent.scroll(wrapper);
            await new Promise((r) => setTimeout(r, 50));
          });
        };

        it('keeps focus on the wrapper while the focused row is away and returns it to the cell', async () => {
          const { container } = renderSpreadsheetGrid({ items: [], windowed: windowedSource() });
          const wrapper = getGrid(container);
          act(() => getTdAt(container, 2, 0).focus());
          expect(document.activeElement).toBe(getTdAt(container, 2, 0));

          await scrollTo(wrapper, 16_000_000);
          expect(container.querySelector('[data-row-index="2"]')).toBeNull();
          // Placeholder rows only: no cell is a tab stop, so the wrapper is, and it holds focus.
          expect(getTabStops(container)).toEqual([]);
          expect(wrapper.tabIndex).toBe(0);
          expect(document.activeElement).toBe(wrapper);

          await scrollTo(wrapper, 0);
          await waitFor(() => expect(document.activeElement).toBe(getTdAt(container, 2, 0)));
          expect(wrapper.tabIndex).toBe(-1);
          expect(getTabStops(container)).toEqual([getTdAt(container, 2, 0)]);
        });
      });

      describe('with a row checkbox column', () => {
        // Column 0 is the checkbox cell; data columns start at data-col-index 1.
        const renderWithCheckboxes = (overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) => {
          const onSelectionChange = jest.fn();
          const utils = renderSpreadsheetGrid({ rowSelection: 'multiple', onSelectionChange, ...overrides });
          return { ...utils, onSelectionChange };
        };
        const press = (key: string, init: Record<string, unknown> = {}) =>
          act(() => { fireEvent.keyDown(document.activeElement as Element, { key, ...init }); });
        const selectedIds = (fn: jest.Mock): string[] => {
          const event = fn.mock.calls[fn.mock.calls.length - 1]?.[0] as { selectedRowIds: string[] } | undefined;
          return [...(event?.selectedRowIds ?? [])].sort();
        };

        it('row checkboxes are not tab stops; the header select-all checkbox still is', () => {
          const { container } = renderWithCheckboxes();
          const rowBoxes = Array.from(container.querySelectorAll<HTMLElement>('tbody [role="checkbox"], tbody input[type="checkbox"]'));
          expect(rowBoxes).toHaveLength(3);
          for (const box of rowBoxes) expect(box.tabIndex).toBe(-1);
          const selectAll = container.querySelector<HTMLElement>('thead [role="checkbox"], thead input[type="checkbox"]');
          expect(selectAll?.tabIndex).toBe(0);
          // One tab stop in the body: the first data cell, not a checkbox cell.
          expect(getTabStops(container)).toEqual([getTdAt(container, 0, 1)]);
        });

        it('ArrowLeft from the first data column reaches the checkbox cell, and focus follows', () => {
          const { container } = renderWithCheckboxes();
          act(() => getTdAt(container, 1, 1).focus());
          press('ArrowLeft');
          expect(document.activeElement).toBe(getTdAt(container, 1, 0));
          expect(getTabStops(container)).toEqual([getTdAt(container, 1, 0)]);
          // No data range while the checkbox cell is active.
          expect(container.querySelectorAll('[data-in-range="true"]').length).toBe(0);
          press('ArrowLeft');
          expect(document.activeElement).toBe(getTdAt(container, 1, 0));
          press('ArrowDown');
          expect(document.activeElement).toBe(getTdAt(container, 2, 0));
          press('ArrowUp', { ctrlKey: true });
          expect(document.activeElement).toBe(getTdAt(container, 0, 0));
          press('ArrowRight');
          expect(document.activeElement).toBe(getTdAt(container, 0, 1));
          expect(container.querySelector('[data-active-cell="true"]')).toBe(getCellAt(container, 0, 1));
        });

        it('Tab from the checkbox cell goes to the first data cell; Shift+Tab from the first row leaves the grid', () => {
          const { container } = renderWithCheckboxes();
          act(() => getTdAt(container, 0, 1).focus());
          press('ArrowLeft');
          expect(document.activeElement).toBe(getTdAt(container, 0, 0));
          // Not prevented: the browser moves focus to whatever precedes the grid body.
          expect(fireEvent.keyDown(getTdAt(container, 0, 0), { key: 'Tab', shiftKey: true })).toBe(true);
          press('Tab');
          expect(document.activeElement).toBe(getTdAt(container, 0, 1));
          // Shift+Tab from the first data cell also leaves (the checkbox cell is not in Tab order).
          expect(fireEvent.keyDown(getTdAt(container, 0, 1), { key: 'Tab', shiftKey: true })).toBe(true);
        });

        it('Space on the checkbox cell toggles its row; Shift+Space selects the range from the last toggled row', () => {
          const { container, onSelectionChange } = renderWithCheckboxes();
          act(() => getTdAt(container, 0, 1).focus());
          press('ArrowLeft');
          press(' ');
          expect(selectedIds(onSelectionChange)).toEqual(['1']);
          press(' ');
          expect(selectedIds(onSelectionChange)).toEqual([]);
          press(' ');
          press('ArrowDown');
          press('ArrowDown');
          press(' ', { shiftKey: true });
          expect(selectedIds(onSelectionChange)).toEqual(['1', '2', '3']);
          // Focus stays on the checkbox cell, not the checkbox control.
          expect(document.activeElement).toBe(getTdAt(container, 2, 0));
        });

        it('Shift+Space in a data cell still toggles just the active row', () => {
          const { container, onSelectionChange } = renderWithCheckboxes();
          act(() => getTdAt(container, 0, 1).focus());
          press(' ');
          expect(onSelectionChange).not.toHaveBeenCalled();
          press('ArrowDown');
          press(' ', { shiftKey: true });
          expect(selectedIds(onSelectionChange)).toEqual(['2']);
        });

        it('copy, paste and Delete on the checkbox cell leave the data alone', async () => {
          Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
          const onCellValueChanged = jest.fn();
          const { container } = renderWithCheckboxes({ onCellValueChanged });
          act(() => getTdAt(container, 1, 1).focus());
          press('ArrowLeft');
          let copy = { data: {} as Record<string, string>, setData: jest.fn(), consumed: false };
          await act(async () => {
            copy = fireCopyOrCut(document.activeElement as Element, 'copy');
          });
          expect(copy.setData).not.toHaveBeenCalled();
          await act(async () => {
            firePaste(document.activeElement as Element, 'Pasted');
          });
          press('Delete');
          expect(onCellValueChanged).not.toHaveBeenCalled();
        });
      });

      it('does not announce cell moves through an aria-live region (focus is announced instead)', () => {
        const { container } = renderSpreadsheetGrid();
        act(() => getTdAt(container, 0, 0).focus());
        act(() => { fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' }); });
        const live = Array.from(container.querySelectorAll('[aria-live]')).map((el) => el.textContent);
        expect(live.join('')).not.toContain('row 2');
      });
    });

    describe('cell editing commit', () => {
      it('Enter commits the editor value and fires onCellValueChanged', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell = getCellAt(container, 0, 0);
        const grid = container.querySelector('[role="region"]') as HTMLElement;

        // Open editor via double-click
        fireEvent.pointerDown(cell);
        fireEvent.click(cell);
        fireEvent.doubleClick(cell);

        await waitFor(() => {
          expect(grid.querySelector('input')).toBeInTheDocument();
        });

        const input = grid.querySelector('input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'NewValue' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
          expect(onCellValueChanged).toHaveBeenCalled();
          const call = onCellValueChanged.mock.calls[0][0];
          expect(call.newValue).toBe('NewValue');
          expect(call.columnId).toBe('name');
        });
      });

      it('Escape discards the editor value without firing onCellValueChanged', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell = getCellAt(container, 0, 0);
        const grid = container.querySelector('[role="region"]') as HTMLElement;

        // Open editor
        fireEvent.pointerDown(cell);
        fireEvent.click(cell);
        fireEvent.doubleClick(cell);

        await waitFor(() => {
          expect(grid.querySelector('input')).toBeInTheDocument();
        });

        const input = grid.querySelector('input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Discarded' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        await waitFor(() => {
          expect(grid.querySelector('input')).toBeNull();
        });
        // onCellValueChanged should NOT be called for Escape
        expect(onCellValueChanged).not.toHaveBeenCalled();
      });

      it('blur commits the editor value for text cells', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell = getCellAt(container, 0, 0);
        const grid = container.querySelector('[role="region"]') as HTMLElement;

        // Open editor
        fireEvent.pointerDown(cell);
        fireEvent.click(cell);
        fireEvent.doubleClick(cell);

        await waitFor(() => {
          expect(grid.querySelector('input')).toBeInTheDocument();
        });

        const input = grid.querySelector('input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'BlurCommit' } });
        fireEvent.blur(input);

        await waitFor(() => {
          expect(onCellValueChanged).toHaveBeenCalled();
          const call = onCellValueChanged.mock.calls[0][0];
          expect(call.newValue).toBe('BlurCommit');
        });
      });

      it('Delete key on selected cell clears value', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell = getCellAt(container, 0, 0);
        const grid = container.querySelector('[role="region"]') as HTMLElement;

        fireEvent.pointerDown(cell);
        grid.focus();
        fireEvent.keyDown(grid, { key: 'Delete' });

        await waitFor(() => {
          expect(onCellValueChanged).toHaveBeenCalled();
          const call = onCellValueChanged.mock.calls[0][0];
          expect(call.newValue).toBe('');
        });
      });
    });

    describe('fill-down (Ctrl+D)', () => {
      it('fills selection range down from source cell value on Ctrl+D', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });

        // Select cell at row 0, col 0
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        // Extend selection down to row 2 via Shift+ArrowDown twice
        fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
        fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });

        await waitFor(() => {
          const inRange = container.querySelectorAll('[data-in-range="true"]');
          expect(inRange.length).toBeGreaterThanOrEqual(2);
        });

        await act(async () => {
          fireEvent.keyDown(grid, { key: 'd', ctrlKey: true });
        });

        await waitFor(() => {
          expect(onCellValueChanged).toHaveBeenCalled();
          const calls = onCellValueChanged.mock.calls;
          // At least one row below should have been filled with a value
          expect(calls.length).toBeGreaterThanOrEqual(1);
        });
      });

      it('does nothing on Ctrl+D when no selection range exists', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });

        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        await act(async () => {
          fireEvent.keyDown(grid, { key: 'd', ctrlKey: true });
        });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        expect(onCellValueChanged).not.toHaveBeenCalled();
      });

      it('does nothing on Ctrl+D when a single cell is selected (no range to fill)', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });

        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);

        await waitFor(() => {
          expect(container.querySelector('[data-active-cell="true"]')).toBeInTheDocument();
        });

        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        // Only a single cell is selected  -  Ctrl+D fills nothing (source == target)
        await act(async () => {
          fireEvent.keyDown(grid, { key: 'd', ctrlKey: true });
        });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });

        // No additional cells to fill  -  onCellValueChanged not called
        expect(onCellValueChanged).not.toHaveBeenCalled();
      });
    });

    describe('fill handle drag (axis lock)', () => {
      const threeColumns: IColumnDef<FixtureRow>[] = [
        ...twoColumnColumns,
        { columnId: 'id', name: 'Id', editable: true, cellEditor: 'text' },
      ];

      /** Select (row, col), optionally Shift+click to extend, and wait for the fill handle. */
      async function selectForFill(container: HTMLElement, from: [number, number], to?: [number, number]) {
        fireEvent.pointerDown(getCellAt(container, from[0], from[1]));
        act(() => {
          window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        });
        if (to) fireEvent.pointerDown(getCellAt(container, to[0], to[1]), { shiftKey: true });
        await waitFor(() => {
          expect(container.querySelector('[aria-label="Fill handle"]')).toBeInTheDocument();
        });
        return container.querySelector('[aria-label="Fill handle"]') as HTMLElement;
      }

      /**
       * Drag the fill handle over each (row, col) in `path`, then release.
       * `document.elementFromPoint` is stubbed so pointer position N resolves to path[N].
       */
      function dragFillHandle(container: HTMLElement, handle: HTMLElement, path: [number, number][], release: PointerEventInit = {}) {
        const originalElementFromPoint = document.elementFromPoint;
        document.elementFromPoint = (x: number, _y: number) => {
          const step = path[x];
          if (!step) throw new Error(`No drag step for pointer position ${x}`);
          return getCellAt(container, step[0], step[1]);
        };
        try {
          fireEvent.pointerDown(handle, { button: 0 });
          path.forEach((_, i) => {
            act(() => {
              window.dispatchEvent(new PointerEvent('pointermove', { clientX: i, clientY: 0, bubbles: true }));
            });
          });
          act(() => {
            window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...release }));
          });
        } finally {
          document.elementFromPoint = originalElementFromPoint;
        }
      }

      const filled = (fn: jest.Mock) =>
        fn.mock.calls.map(([e]) => `${e.rowIndex}:${e.columnId}=${e.newValue}`).sort();

      it('a row-dominant diagonal drag fills down only, keeping the source column', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const handle = await selectForFill(container, [0, 0]);

        // 2 rows down, 1 column right: rows win.
        dragFillHandle(container, handle, [[2, 1]]);

        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(2));
        expect(filled(onCellValueChanged)).toEqual(['1:name=Alpha', '2:name=Alpha']);
        // The committed selection is the fill range: rows 0-2 of the source column.
        await waitFor(() => {
          expect(container.querySelectorAll('[data-in-range="true"]').length).toBe(3);
        });
      });

      it('a column-dominant diagonal drag fills across only, keeping the source row', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({
          onCellValueChanged,
          columns: threeColumns,
          visibleColumns: new Set(['name', 'status', 'id']),
        });
        const handle = await selectForFill(container, [0, 0]);

        // 1 row down, 2 columns right: columns win.
        dragFillHandle(container, handle, [[1, 2]]);

        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(2));
        expect(filled(onCellValueChanged)).toEqual(['0:id=Alpha', '0:status=Alpha']);
      });

      it('a straight drag down a column fills that column', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const handle = await selectForFill(container, [1, 1]);

        dragFillHandle(container, handle, [[2, 1]]);

        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
        expect(filled(onCellValueChanged)).toEqual(['2:status=Closed']);
      });

      it('a straight drag across a row fills that row', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const handle = await selectForFill(container, [1, 0]);

        dragFillHandle(container, handle, [[1, 1]]);

        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
        expect(filled(onCellValueChanged)).toEqual(['1:status=Beta']);
      });

      it('dragging back inside the source block fills nothing and keeps the source selection', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        // Two-cell source: rows 0-1 of the name column.
        const handle = await selectForFill(container, [0, 0], [1, 0]);

        // Out to row 2, then back onto the source's last cell.
        dragFillHandle(container, handle, [[2, 0], [1, 0]]);

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
        expect(onCellValueChanged).not.toHaveBeenCalled();
        expect(container.querySelectorAll('[data-in-range="true"]').length).toBe(2);
      });
    });

    describe('fill series and paste special (Excel)', () => {
      const seriesRows: FixtureRow[] = [
        { id: '1', name: 'Item 1', status: 'Mon' },
        { id: '2', name: 'Item 2', status: '' },
        { id: '3', name: 'Item 3', status: '' },
      ];
      const changes = (fn: jest.Mock) =>
        fn.mock.calls.map(([e]) => `${e.rowIndex}:${e.columnId}=${e.newValue}`).sort();

      async function fillHandleAt(container: HTMLElement, row: number, col: number) {
        fireEvent.pointerDown(getCellAt(container, row, col));
        act(() => {
          window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        });
        await waitFor(() => expect(container.querySelector('[aria-label="Fill handle"]')).toBeInTheDocument());
        return container.querySelector('[aria-label="Fill handle"]') as HTMLElement;
      }

      function dragTo(container: HTMLElement, handle: HTMLElement, row: number, col: number, release: PointerEventInit = {}) {
        const original = document.elementFromPoint;
        document.elementFromPoint = () => getCellAt(container, row, col);
        try {
          fireEvent.pointerDown(handle, { button: 0 });
          act(() => {
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1, clientY: 1, bubbles: true }));
          });
          act(() => {
            window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...release }));
          });
        } finally {
          document.elementFromPoint = original;
        }
      }

      it('dragging the fill handle continues a weekday series; Ctrl held at release copies instead', async () => {
        const onCellValueChanged = jest.fn();
        const { container, unmount } = renderSpreadsheetGrid({ onCellValueChanged, items: seriesRows });
        dragTo(container, await fillHandleAt(container, 0, 1), 2, 1);
        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(2));
        expect(changes(onCellValueChanged)).toEqual(['1:status=Tue', '2:status=Wed']);
        unmount();

        const onCtrl = jest.fn();
        const second = renderSpreadsheetGrid({ onCellValueChanged: onCtrl, items: seriesRows });
        dragTo(second.container, await fillHandleAt(second.container, 0, 1), 2, 1, { ctrlKey: true });
        await waitFor(() => expect(onCtrl).toHaveBeenCalledTimes(2));
        expect(changes(onCtrl)).toEqual(['1:status=Mon', '2:status=Mon']);
      });

      it('dragging up continues a text-number series backward', async () => {
        const onCellValueChanged = jest.fn();
        const rows: FixtureRow[] = [
          { id: '1', name: '', status: '' },
          { id: '2', name: '', status: '' },
          { id: '3', name: 'Item 7', status: '' },
        ];
        const { container } = renderSpreadsheetGrid({ onCellValueChanged, items: rows });
        dragTo(container, await fillHandleAt(container, 2, 0), 0, 0);
        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(2));
        expect(changes(onCellValueChanged)).toEqual(['0:name=Item 5', '1:name=Item 6']);
      });

      it('double-clicking the fill handle fills down to the end of the adjacent column', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged, items: seriesRows });
        const handle = await fillHandleAt(container, 0, 1);
        fireEvent.doubleClick(handle);
        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(2));
        expect(changes(onCellValueChanged)).toEqual(['1:status=Tue', '2:status=Wed']);
        // The filled range becomes the selection; no editor opened.
        await waitFor(() => expect(container.querySelectorAll('[data-in-range="true"]').length).toBe(3));
        expect(container.querySelector('tbody input')).toBeNull();
      });

      it('a single pasted value fills every cell of the selection', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        fireEvent.pointerDown(getCellAt(container, 2, 1), { shiftKey: true });
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        await act(async () => {
          firePaste(grid, 'X');
        });
        expect(changes(onCellValueChanged)).toEqual([
          '0:name=X', '0:status=X', '1:name=X', '1:status=X', '2:name=X', '2:status=X',
        ]);
      });

      it('a block pastes once when the selection is not an exact multiple of it', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        fireEvent.pointerDown(getCellAt(container, 2, 0), { shiftKey: true });
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        await act(async () => {
          firePaste(grid, 'A\nB');
        });
        expect(changes(onCellValueChanged)).toEqual(['0:name=A', '1:name=B']);
      });

      it('a copy also puts an HTML table on the clipboard, and an HTML-only paste is read as a table', async () => {
        const onCellValueChanged = jest.fn();
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        fireEvent.pointerDown(getCellAt(container, 1, 1), { shiftKey: true });
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        let copied: Record<string, string> = {};
        await act(async () => {
          copied = fireCopyOrCut(grid, 'copy').data;
        });
        expect(copied['text/html']).toBe(
          '<table><tbody><tr><td>Alpha</td><td>Active</td></tr><tr><td>Beta</td><td>Closed</td></tr></tbody></table>'
        );

        fireEvent.pointerDown(getCellAt(container, 2, 0));
        const event = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', {
          value: { getData: (format: string) => (format === 'text/html' ? '<table><tr><td>H1</td><td>H2</td></tr></table>' : '') },
        });
        await act(async () => {
          fireEvent(grid, event);
        });
        expect(changes(onCellValueChanged)).toEqual(['2:name=H1', '2:status=H2']);
      });

      it('the context menu offers Paste values only, which stores formula text as a plain value', async () => {
        const onCellValueChanged = jest.fn();
        const readText = jest.fn().mockResolvedValue('=A1');
        Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell = getCellAt(container, 1, 0);
        fireEvent.pointerDown(cell);
        fireEvent.contextMenu(cell, { clientX: 100, clientY: 100 });
        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Paste values only'));
        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalledTimes(1));
        expect(changes(onCellValueChanged)).toEqual(['1:name==A1']);
      });
    });

    describe('cellSelection=false disables all selection', () => {
      it('does not show active cell highlight or range on mousedown', async () => {
        const { container } = renderSpreadsheetGrid({ cellSelection: false });
        const cell = getCellAt(container, 0, 0);
        expect(cell).toBeTruthy();
        fireEvent.pointerDown(cell);

        // Short wait to confirm no state update occurs
        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
        const inRange = container.querySelectorAll('[data-in-range="true"]');
        expect(inRange.length).toBe(0);
      });

      it('does not show context menu on right-click of a cell', async () => {
        const { container } = renderSpreadsheetGrid({ cellSelection: false });
        const cell = getCellAt(container, 0, 0);
        expect(cell).toBeTruthy();

        fireEvent.contextMenu(cell, { clientX: 100, clientY: 100 });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });

      it('does not respond to keyboard navigation', async () => {
        const { container } = renderSpreadsheetGrid({ cellSelection: false });
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);
        const grid = container.querySelector('[role="region"]') as HTMLElement;
        grid.focus();

        fireEvent.keyDown(grid, { key: 'ArrowDown' });

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
        const inRange = container.querySelectorAll('[data-in-range="true"]');
        expect(inRange.length).toBe(0);
      });

      it('does not show fill handle on cell click', async () => {
        const { container } = renderSpreadsheetGrid({ cellSelection: false });
        const cell = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell);

        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
        const fillHandle = container.querySelector('[aria-label="Fill handle"]');
        expect(fillHandle).toBeNull();
      });

      it('still allows double-click to edit when editable', async () => {
        const { container } = renderSpreadsheetGrid({ cellSelection: false });
        const cell = getCellAt(container, 0, 0);
        expect(cell).toBeTruthy();
        fireEvent.doubleClick(cell);
        await waitFor(() => {
          const grid = container.querySelector('[role="region"]');
          const input = grid?.querySelector('input');
          expect(input).toBeInTheDocument();
        });
      });
    });
  });
}
