/**
 * Shared GridRow memoization tests.
 * Each UI package calls createRowMemoTests(DataGridTable) to run these.
 *
 * They check both halves of the row memo: rows that nothing changed for do not
 * re-render, and every input that changes a row's output (selection, editing,
 * formula recalcs, row-number column, popover editors) still repaints it.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { IColumnDef, ICellEditorProps, IOGridDataGridProps, IOGridProps } from '../types';
import { getRowId, type FixtureRow } from './fixtures';

const rows: FixtureRow[] = [
  { id: '1', name: 'Alpha', status: 'Active' },
  { id: '2', name: 'Beta', status: 'Closed' },
  { id: '3', name: 'Gamma', status: 'Active' },
  { id: '4', name: 'Delta', status: 'Closed' },
  { id: '5', name: 'Epsilon', status: 'Active' },
];

function getCell(container: HTMLElement, rowIndex: number, colIndex: number): HTMLElement {
  const cell = container.querySelector(`tbody [data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);
  if (!cell) throw new Error(`Cell not found at row=${rowIndex}, col=${colIndex}`);
  return cell as HTMLElement;
}

const visibleColumns = new Set(['name', 'status']);

function CustomPopoverEditor({ value }: ICellEditorProps<FixtureRow>) {
  return <div data-testid="custom-popover-editor">{String(value)}</div>;
}

export function createRowMemoTests(DataGridTable: React.ComponentType<IOGridDataGridProps<FixtureRow>>): void {
  describe('GridRow memoization', () => {
    let renders: Record<string, number>;
    const resetRenders = () => {
      renders = {};
    };

    // `name` counts how often each row's cells render; `status` has no
    // renderCell, so it shows the raw (or formula) value.
    const columns: IColumnDef<FixtureRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        editable: true,
        cellEditor: 'text',
        renderCell: (item) => {
          renders[item.id] = (renders[item.id] ?? 0) + 1;
          return <span data-testid={`name-${item.id}`}>{item.name}</span>;
        },
      },
      { columnId: 'status', name: 'Status', editable: true, cellEditor: 'text' },
    ];

    function element(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) {
      const props: IOGridDataGridProps<FixtureRow> = {
        items: rows,
        columns,
        getRowId,
        sortBy: undefined,
        sortDirection: 'asc',
        onColumnSort: () => {},
        visibleColumns,
        filters: {},
        onFilterChange: () => {},
        filterOptions: {},
        loadingFilterOptions: {},
        editable: true,
        onCellValueChanged: () => {},
        ...overrides,
      };
      return <DataGridTable {...props} />;
    }

    beforeEach(resetRenders);

    it('does not re-render rows when the grid re-renders with unchanged row inputs', () => {
      const { rerender } = render(element());
      resetRenders();
      // A new header callback re-renders the table, but nothing any row shows.
      rerender(element({ onColumnSort: () => {} }));
      expect(renders).toEqual({});
    });

    it('re-renders only the rows whose active cell / selection changed', async () => {
      const { container } = render(element());
      fireEvent.pointerDown(getCell(container, 0, 0));
      await waitFor(() => expect(getCell(container, 0, 0).getAttribute('data-active-cell')).toBe('true'));

      resetRenders();
      fireEvent.pointerDown(getCell(container, 3, 0));
      await waitFor(() => expect(getCell(container, 3, 0).getAttribute('data-active-cell')).toBe('true'));
      expect(getCell(container, 0, 0).getAttribute('data-active-cell')).toBeNull();
      // Rows 0 (lost the active cell) and 3 (gained it) repaint; the rest don't.
      expect(Object.keys(renders).sort()).toEqual(['1', '4']);
    });

    it('repaints a formula cell in an untouched row when formulaVersion changes', () => {
      let formulaValue = 'first';
      const formulaProps = {
        hasFormula: (col: number, row: number) => col === 1 && row === 4,
        getFormulaValue: () => formulaValue,
      };
      const { container, rerender } = render(element({ ...formulaProps, formulaVersion: 1 }));
      expect(getCell(container, 4, 1).textContent).toBe('first');

      formulaValue = 'recalculated';
      resetRenders();
      rerender(element({ ...formulaProps, formulaVersion: 2 }));
      expect(getCell(container, 4, 1).textContent).toBe('recalculated');
    });

    it('repaints the edited row when an inline edit opens and commits, leaving other rows alone', async () => {
      const onCellValueChanged = jest.fn();
      const { container, rerender } = render(element({ onCellValueChanged }));
      fireEvent.pointerDown(getCell(container, 2, 1));
      await waitFor(() => expect(getCell(container, 2, 1).getAttribute('data-active-cell')).toBe('true'));

      resetRenders();
      fireEvent.doubleClick(getCell(container, 2, 1));
      const input = await waitFor(() => {
        const el = container.querySelector('tbody tr:nth-child(3) input');
        expect(el).toBeTruthy();
        return el as HTMLInputElement;
      });
      expect(Object.keys(renders)).toEqual(['3']);

      fireEvent.change(input, { target: { value: 'Paused' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(onCellValueChanged).toHaveBeenCalled());
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'status', newValue: 'Paused', rowIndex: 2 });

      const next = rows.map((r) => (r.id === '3' ? { ...r, status: 'Paused' } : r));
      rerender(element({ onCellValueChanged, items: next }));
      await waitFor(() => expect(container.querySelector('tbody tr:nth-child(3) input')).toBeNull());
      expect(getCell(container, 2, 1).textContent).toBe('Paused');
    });

    it('repaints every row when the row-number column is toggled', () => {
      const { container, rerender } = render(element());
      expect(container.querySelectorAll('tbody tr').length).toBe(5);
      rerender(element({ showRowNumbers: true }));
      const numbers = Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.textContent ?? '');
      numbers.forEach((text, i) => expect(text.startsWith(String(i + 1))).toBe(true));
    });

    it('repaints cells when editing is switched on', () => {
      const { container, rerender } = render(element({ editable: false }));
      expect(getCell(container, 1, 1).hasAttribute('data-can-edit')).toBe(false);
      rerender(element({ editable: true }));
      expect(getCell(container, 1, 1).hasAttribute('data-can-edit')).toBe(true);
    });

    it('opens a custom popover cell editor', async () => {
      const popoverColumns: IColumnDef<FixtureRow>[] = [
        columns[0] as IColumnDef<FixtureRow>,
        { columnId: 'status', name: 'Status', editable: true, cellEditor: CustomPopoverEditor },
      ];
      const { container } = render(element({ columns: popoverColumns }));
      fireEvent.pointerDown(getCell(container, 1, 1));
      await waitFor(() => expect(getCell(container, 1, 1).getAttribute('data-active-cell')).toBe('true'));
      act(() => {
        fireEvent.doubleClick(getCell(container, 1, 1));
      });
      expect((await screen.findByTestId('custom-popover-editor')).textContent).toBe('Closed');
    });
  });
}

/** OGrid-level checks: the whole prop pipeline (useOGrid -> table -> rows), with the formula engine. */
export function createRowMemoOGridTests(OGrid: React.ComponentType<IOGridProps<FixtureRow>>): void {
  describe('OGrid row memoization', () => {
    let renders: Record<string, number>;
    beforeEach(() => {
      renders = {};
    });

    // No renderCell on name/status so formula results display; `id` counts row renders.
    const columns: IColumnDef<FixtureRow>[] = [
      { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
      { columnId: 'status', name: 'Status', editable: true, cellEditor: 'text' },
      {
        columnId: 'id',
        name: 'Id',
        renderCell: (item) => {
          renders[item.id] = (renders[item.id] ?? 0) + 1;
          return item.id;
        },
      },
    ];

    function element(overrides: Partial<IOGridProps<FixtureRow>> = {}) {
      const props = {
        data: rows,
        columns,
        getRowId,
        editable: true,
        onCellValueChanged: () => {},
        ...overrides,
      } as IOGridProps<FixtureRow>;
      return <OGrid {...props} />;
    }

    it('does not re-render rows when the host re-renders OGrid with new inline callbacks', () => {
      const { rerender } = render(element());
      renders = {};
      rerender(element({ onCellValueChanged: () => {}, onSelectionChange: () => {} }));
      expect(renders).toEqual({});
    });

    it('repaints a dependent formula cell in another row after a formula edit (K03)', async () => {
      const { container } = render(
        element({ formulas: true, initialFormulas: [{ col: 1, row: 4, formula: '=A1+1' }] }),
      );
      // formulas turn on the row-number column, so data column N has data-col-index N + 1.
      // Formula rows are records' indexes in `data` (sheet rows), not screen rows:
      // under the default Name sort, A1 (Alpha, data row 0) is on screen row 0 and
      // B5 (Epsilon, data row 4) is on screen row 3.
      const dependentRow = (): number =>
        Number(container.querySelector('tbody tr[data-row-id="5"] [data-row-index]')?.getAttribute('data-row-index'));
      expect(dependentRow()).toBe(3);
      fireEvent.pointerDown(getCell(container, 0, 1));
      await waitFor(() => expect(getCell(container, 0, 1).getAttribute('data-active-cell')).toBe('true'));
      fireEvent.doubleClick(getCell(container, 0, 1));
      const input = await waitFor(() => {
        const el = container.querySelector('tbody tr:nth-child(1) input');
        expect(el).toBeTruthy();
        return el as HTMLInputElement;
      });

      renders = {};
      fireEvent.change(input, { target: { value: '=100' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(getCell(container, dependentRow(), 2).textContent).toBe('101'));
      expect(getCell(container, 0, 1).textContent).toBe('100');
    });
  });
}
