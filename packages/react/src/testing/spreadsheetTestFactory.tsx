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
      it('cut then paste clears source cells and calls onCellValueChanged with empty string', async () => {
        const onCellValueChanged = jest.fn();
        // The clipboard returns what the cut wrote (cut cells are only cleared when the
        // pasted text is the cut's own text).
        let clipboardText = '';
        const writeText = jest.fn().mockImplementation((t: string) => { clipboardText = t; return Promise.resolve(); });
        const readText = jest.fn().mockImplementation(() => Promise.resolve(clipboardText));
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText, readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]');
        expect(grid).toBeTruthy();

        await act(async () => {
          fireEvent.keyDown(grid as Element, { key: 'x', ctrlKey: true });
        });

        await waitFor(() => {
          expect(writeText).toHaveBeenCalled();
        });

        // Paste somewhere else: pasting onto the cut cell itself keeps the
        // pasted value (the paste wins), so nothing would be cleared. Ctrl+V
        // arrives as the browser's paste event carrying what the cut wrote.
        fireEvent.pointerDown(getCellAt(container, 1, 0));
        await act(async () => {
          firePaste(grid as Element, clipboardText);
        });

        await waitFor(() => {
          const clearCalls = onCellValueChanged.mock.calls.filter((c: unknown[]) => (c[0] as { newValue: unknown }).newValue === '');
          expect(clearCalls.length).toBeGreaterThanOrEqual(1);
        });
        expect(readText).not.toHaveBeenCalled();
      });

      it('cut then paste onto the same cell keeps the pasted value', async () => {
        const onCellValueChanged = jest.fn();
        let clipboardText = '';
        const writeText = jest.fn().mockImplementation((t: string) => { clipboardText = t; return Promise.resolve(); });
        const readText = jest.fn().mockImplementation(() => Promise.resolve(clipboardText));
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText, readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        fireEvent.pointerDown(getCellAt(container, 0, 0));
        const grid = container.querySelector('[role="region"]');
        await act(async () => {
          fireEvent.keyDown(grid as Element, { key: 'x', ctrlKey: true });
        });
        await waitFor(() => expect(writeText).toHaveBeenCalled());
        await act(async () => {
          firePaste(grid as Element, clipboardText);
        });
        await waitFor(() => expect(onCellValueChanged).toHaveBeenCalled());
        const values = onCellValueChanged.mock.calls.map((c: unknown[]) => (c[0] as { newValue: unknown }).newValue);
        expect(values).not.toContain('');
      });
    });

    describe('copy', () => {
      it('copies selected range to clipboard as TSV on Ctrl+C', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid();
        const cell00 = getCellAt(container, 0, 0);
        const cell01 = getCellAt(container, 0, 1);
        fireEvent.pointerDown(cell00);
        fireEvent.pointerDown(cell01, { shiftKey: true });
        const grid = container.querySelector('[role="region"]');
        expect(grid).toBeTruthy();

        await act(async () => {
          fireEvent.keyDown(grid as Element, { key: 'c', ctrlKey: true });
        });

        await waitFor(() => {
          expect(writeText).toHaveBeenCalled();
          const tsv = writeText.mock.calls[0][0];
          expect(tsv).toContain('Alpha');
          expect(tsv).toContain('Active');
        });
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
          fireEvent.keyDown(grid, { key: 'c', ctrlKey: true });
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

        await waitFor(() => {
          expect(writeText).toHaveBeenCalled();
        });
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
      function dragFillHandle(container: HTMLElement, handle: HTMLElement, path: [number, number][]) {
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
            window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
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
