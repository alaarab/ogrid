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

export function createSpreadsheetTests(DataGridTable: React.ComponentType<IOGridDataGridProps<FixtureRow>>): void {
  function renderSpreadsheetGrid(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) {
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
    return render(<DataGridTable {...defaultProps} {...overrides} />);
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
        const writeText = jest.fn().mockResolvedValue(undefined);
        const readText = jest.fn().mockResolvedValue('PastedValue');
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

        await act(async () => {
          fireEvent.keyDown(grid as Element, { key: 'v', ctrlKey: true });
        });

        await waitFor(() => {
          expect(readText).toHaveBeenCalled();
          const clearCalls = onCellValueChanged.mock.calls.filter((c: unknown[]) => (c[0] as { newValue: unknown }).newValue === '');
          expect(clearCalls.length).toBeGreaterThanOrEqual(1);
        });
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
      it('pastes from clipboard and calls onCellValueChanged for each cell', async () => {
        const onCellValueChanged = jest.fn();
        const readText = jest.fn().mockResolvedValue('Pasted1\tPasted2\nPasted3\tPasted4');
        Object.defineProperty(navigator, 'clipboard', {
          value: { readText },
          configurable: true,
        });

        const { container } = renderSpreadsheetGrid({ onCellValueChanged });
        const cell00 = getCellAt(container, 0, 0);
        fireEvent.pointerDown(cell00);
        const grid = container.querySelector('[role="region"]');
        expect(grid).toBeTruthy();

        await act(async () => {
          fireEvent.keyDown(grid as Element, { key: 'v', ctrlKey: true });
        });

        await waitFor(() => {
          expect(readText).toHaveBeenCalled();
          expect(onCellValueChanged).toHaveBeenCalled();
          const calls = onCellValueChanged.mock.calls;
          expect(calls.length).toBeGreaterThanOrEqual(2);
          const values = calls.map((c: unknown[]) => (c[0] as { newValue: unknown }).newValue);
          expect(values).toContain('Pasted1');
          expect(values).toContain('Pasted2');
        });
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
        const writeText = jest.fn().mockResolvedValue(undefined);
        const readText = jest.fn().mockResolvedValue('X');
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

        fireEvent.keyDown(grid as Element, { key: 'v', ctrlKey: true });
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

        await waitFor(() => {
          expect(readText).toHaveBeenCalled();
          expect(onCellValueChanged).toHaveBeenCalled();
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
          expect(active[0].getAttribute('data-col-index')).toBe('1');
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
          expect(active[0].getAttribute('data-row-index')).toBe('0');
          expect(active[0].getAttribute('data-col-index')).toBe('1');
        });

        fireEvent.keyDown(grid, { key: 'Tab' });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0].getAttribute('data-row-index')).toBe('1');
          expect(active[0].getAttribute('data-col-index')).toBe('0');
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
          expect(active[0].getAttribute('data-row-index')).toBe('0');
          expect(active[0].getAttribute('data-col-index')).toBe('1');
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
          expect(active[0].getAttribute('data-row-index')).toBe('1');
          expect(active[0].getAttribute('data-col-index')).toBe('0');
        });

        fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0].getAttribute('data-row-index')).toBe('0');
          expect(active[0].getAttribute('data-col-index')).toBe('0');
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
          expect(active[0].getAttribute('data-row-index')).toBe('0');
          expect(active[0].getAttribute('data-col-index')).toBe('1');
        });

        fireEvent.keyDown(grid, { key: 'End', ctrlKey: true });
        await waitFor(() => {
          const active = container.querySelectorAll('[data-active-cell="true"]');
          expect(active.length).toBe(1);
          expect(active[0].getAttribute('data-row-index')).toBe('2');
          expect(active[0].getAttribute('data-col-index')).toBe('1');
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
