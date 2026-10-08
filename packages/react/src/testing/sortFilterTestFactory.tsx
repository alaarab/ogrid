/**
 * Shared OGrid tests for multi-level sorting (header click, Shift+click,
 * "Add to sort", sortModel props, data sources) and number/condition filters.
 * Each UI package calls createSortFilterTests(OGrid).
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { IColumnDef, IDataSource, IFetchParams, IFilters, IOGridProps, ISortModelItem } from '../types';

export interface SortFilterRow {
  id: number;
  name: string;
  dept: string;
  score: number | null;
}

const rows: SortFilterRow[] = [
  { id: 1, name: 'Alice', dept: 'Sales', score: 70 },
  { id: 2, name: 'Bob', dept: 'Eng', score: 90 },
  { id: 3, name: 'Cara', dept: 'Sales', score: 85 },
  { id: 4, name: 'Dan', dept: 'Eng', score: 60 },
  { id: 5, name: 'Eve', dept: 'Ops', score: null },
];

const columns: IColumnDef<SortFilterRow>[] = [
  {
    columnId: 'name',
    name: 'Name',
    sortable: true,
    filterable: { type: 'condition' },
    renderCell: (item) => <span data-testid="sf-name">{item.name}</span>,
  },
  { columnId: 'dept', name: 'Dept', sortable: true },
  { columnId: 'score', name: 'Score', type: 'numeric', sortable: true, filterable: { type: 'number' } },
];

type Props = IOGridProps<SortFilterRow>;

export function createSortFilterTests(OGrid: React.ComponentType<Props>): void {
  function renderGrid(overrides: Partial<Props> = {}) {
    const props = {
      data: rows,
      columns,
      getRowId: (r: SortFilterRow) => r.id,
      defaultPageSize: 25,
      defaultSortBy: '',
      ...overrides,
    } as Props;
    return render(<OGrid {...props} />);
  }

  const names = () => screen.queryAllByTestId('sf-name').map((el) => el.textContent);
  const label = (container: HTMLElement, columnId: string) => {
    const el = container.querySelector(`th[data-column-id="${columnId}"] [data-header-label]`);
    if (!el) throw new Error(`no header label for ${columnId}`);
    return el as HTMLElement;
  };
  const priorities = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('th[data-column-id]'))
      .filter((th) => th.querySelector('[data-sort-priority]'))
      .map((th) => `${th.getAttribute('data-column-id')}:${th.querySelector('[data-sort-priority]')?.textContent}`);

  describe('multi-level sort', () => {
    it('a header label click sorts ascending, a second click descending', () => {
      const { container } = renderGrid();
      fireEvent.click(label(container, 'score'));
      expect(names()).toEqual(['Eve', 'Dan', 'Alice', 'Cara', 'Bob']);
      fireEvent.click(label(container, 'score'));
      expect(names()).toEqual(['Bob', 'Cara', 'Alice', 'Dan', 'Eve']);
      expect(container.querySelector('th[data-column-id="score"]')?.getAttribute('aria-sort')).toBe('descending');
    });

    it('Shift+click adds a secondary level with priority numbers; a plain click resets to one level', () => {
      const onSortModelChange = jest.fn();
      const { container } = renderGrid({ onSortModelChange });
      fireEvent.click(label(container, 'dept'));
      expect(priorities(container)).toEqual([]);
      fireEvent.click(label(container, 'score'), { shiftKey: true });
      // Eng (Dan 60, Bob 90), Ops (Eve), Sales (Alice 70, Cara 85)
      expect(names()).toEqual(['Dan', 'Bob', 'Eve', 'Alice', 'Cara']);
      expect(priorities(container)).toEqual(['dept:1', 'score:2']);
      expect(onSortModelChange).toHaveBeenLastCalledWith([
        { field: 'dept', direction: 'asc' },
        { field: 'score', direction: 'asc' },
      ]);

      // Shift+click again flips that level only.
      fireEvent.click(label(container, 'score'), { shiftKey: true });
      expect(names()).toEqual(['Bob', 'Dan', 'Eve', 'Cara', 'Alice']);
      // Primary keeps aria-sort; the secondary level is visual only.
      expect(container.querySelector('th[data-column-id="dept"]')?.getAttribute('aria-sort')).toBe('ascending');

      fireEvent.click(label(container, 'name'));
      expect(priorities(container)).toEqual([]);
      expect(names()).toEqual(['Alice', 'Bob', 'Cara', 'Dan', 'Eve']);
      expect(onSortModelChange).toHaveBeenLastCalledWith([{ field: 'name', direction: 'asc' }]);
    });

    it('the hidden-column gap marker and column-letter selection do not sort', () => {
      const onSortModelChange = jest.fn();
      const { container } = renderGrid({
        onSortModelChange,
        allowHiding: true,
        cellReferences: true,
        visibleColumns: new Set(['name', 'score']),
      });
      const marker = screen.getByRole('button', { name: /Unhide hidden column/ });
      fireEvent.pointerDown(marker);
      fireEvent.click(marker);
      const letter = container.querySelector('th[data-col-header-index="1"]') as HTMLElement;
      fireEvent.pointerDown(letter);
      fireEvent.click(letter);
      expect(onSortModelChange).not.toHaveBeenCalled();
      expect(names()).toEqual(['Alice', 'Bob', 'Cara', 'Dan', 'Eve']);
      // The label itself still sorts.
      fireEvent.click(label(container, 'score'));
      expect(onSortModelChange).toHaveBeenCalledTimes(1);
    });

    it('"Add to sort" in the column menu appends a level', () => {
      const { container } = renderGrid({ defaultSortBy: 'dept' });
      fireEvent.click(screen.getByRole('button', { name: 'Score column options' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add to sort' }));
      expect(priorities(container)).toEqual(['dept:1', 'score:2']);
      expect(names()).toEqual(['Dan', 'Bob', 'Eve', 'Alice', 'Cara']);
    });

    it('a sorted column\'s menu has no "Add to sort"', () => {
      renderGrid({ defaultSortBy: 'dept' });
      fireEvent.click(screen.getByRole('button', { name: 'Dept column options' }));
      expect(screen.queryByRole('menuitem', { name: 'Add to sort' })).toBeNull();
    });

    it('a controlled sortModel drives the order and reports changes', () => {
      const onSortModelChange = jest.fn();
      const onSortChange = jest.fn();
      const model: ISortModelItem[] = [{ field: 'dept', direction: 'desc' }, { field: 'score', direction: 'desc' }];
      const { container } = renderGrid({ sortModel: model, onSortModelChange, onSortChange });
      expect(names()).toEqual(['Cara', 'Alice', 'Eve', 'Bob', 'Dan']);
      expect(priorities(container)).toEqual(['dept:1', 'score:2']);
      fireEvent.click(label(container, 'name'), { shiftKey: true });
      expect(onSortModelChange).toHaveBeenLastCalledWith([...model, { field: 'name', direction: 'asc' }]);
      expect(onSortChange).toHaveBeenLastCalledWith({ field: 'dept', direction: 'desc' });
      // Controlled: nothing moves until the host passes the new model.
      expect(names()).toEqual(['Cara', 'Alice', 'Eve', 'Bob', 'Dan']);
    });

    it('defaultSortModel seeds a multi-level sort', () => {
      renderGrid({ defaultSortModel: [{ field: 'dept', direction: 'asc' }, { field: 'name', direction: 'desc' }] });
      expect(names()).toEqual(['Dan', 'Bob', 'Eve', 'Cara', 'Alice']);
    });

    it('passes every sort level and condition filters to a data source', async () => {
      const calls: IFetchParams[] = [];
      const dataSource: IDataSource<SortFilterRow> = {
        fetchPage: async (params) => {
          calls.push(params);
          return { items: rows, totalCount: rows.length };
        },
      };
      const filters: IFilters = {
        score: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'greaterThan', value: 65 }] } },
      };
      const props = {
        dataSource,
        columns,
        getRowId: (r: SortFilterRow) => r.id,
        defaultSortModel: [{ field: 'dept', direction: 'asc' }, { field: 'score', direction: 'desc' }],
        filters,
      } as Props;
      render(<OGrid {...props} />);
      await waitFor(() => expect(calls.length).toBeGreaterThan(0));
      const last = calls[calls.length - 1] as IFetchParams;
      expect(last.sort).toEqual({ field: 'dept', direction: 'asc' });
      expect(last.sortModel).toEqual([{ field: 'dept', direction: 'asc' }, { field: 'score', direction: 'desc' }]);
      expect(last.filters).toEqual(filters);
    });
  });

  describe('number and condition filters', () => {
    const openFilter = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Filter ${name}` }));
    const popover = () => {
      const select = screen.getByRole('combobox', { name: /condition 1$/i });
      return within(select.closest('[data-ogrid-condition]')?.parentElement?.parentElement as HTMLElement);
    };

    it('filters by a number condition, marks the filter active, and clears', () => {
      const onFiltersChange = jest.fn();
      renderGrid({ onFiltersChange });
      const trigger = screen.getByRole('button', { name: 'Filter Score' });
      const inactiveClass = trigger.className;
      openFilter('Score');
      fireEvent.change(screen.getByRole('combobox', { name: 'Score condition 1' }), { target: { value: 'greaterThanOrEqual' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Score condition 1 value' }), { target: { value: '85' } });
      fireEvent.click(popover().getByRole('button', { name: 'Apply' }));
      expect(names()).toEqual(['Bob', 'Cara']);
      expect(onFiltersChange).toHaveBeenLastCalledWith({
        score: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'greaterThanOrEqual', value: 85 }] } },
      });
      expect(screen.getByRole('button', { name: 'Filter Score' }).className).not.toBe(inactiveClass);

      openFilter('Score');
      fireEvent.click(popover().getByRole('button', { name: 'Clear' }));
      expect(names()).toHaveLength(5);
      expect(onFiltersChange).toHaveBeenLastCalledWith({});
    });

    it('combines two conditions with OR, and supports between and blanks', () => {
      renderGrid();
      openFilter('Score');
      fireEvent.change(screen.getByRole('combobox', { name: 'Score condition 1' }), { target: { value: 'between' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Score condition 1 from' }), { target: { value: '60' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Score condition 1 to' }), { target: { value: '70' } });
      fireEvent.click(screen.getByRole('radio', { name: 'Or' }));
      fireEvent.change(screen.getByRole('combobox', { name: 'Score condition 2' }), { target: { value: 'blank' } });
      fireEvent.click(popover().getByRole('button', { name: 'Apply' }));
      expect(names()).toEqual(['Alice', 'Dan', 'Eve']);
    });

    it('top N keeps the N largest values', () => {
      renderGrid();
      openFilter('Score');
      fireEvent.change(screen.getByRole('combobox', { name: 'Score condition 1' }), { target: { value: 'top' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Score condition 1 value' }), { target: { value: '2' } });
      fireEvent.click(popover().getByRole('button', { name: 'Apply' }));
      expect(names()).toEqual(['Bob', 'Cara']);
    });

    it('text conditions on a `condition` column (Enter applies)', () => {
      renderGrid();
      openFilter('Name');
      const op = screen.getByRole('combobox', { name: 'Name condition 1' });
      expect(within(op).getByRole('option', { name: 'Begins with' })).toBeInTheDocument();
      expect(within(op).queryByRole('option', { name: 'Top N' })).toBeNull();
      fireEvent.change(op, { target: { value: 'endsWith' } });
      const input = screen.getByRole('textbox', { name: 'Name condition 1 value' });
      fireEvent.change(input, { target: { value: 'E' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(names()).toEqual(['Alice', 'Eve']);
    });

    it('shows an applied filter when reopened', () => {
      renderGrid({
        filters: { score: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'lessThan', value: 75 }] } } },
      });
      expect(names()).toEqual(['Alice', 'Dan']);
      openFilter('Score');
      expect((screen.getByRole('combobox', { name: 'Score condition 1' }) as HTMLSelectElement).value).toBe('lessThan');
      expect((screen.getByRole('spinbutton', { name: 'Score condition 1 value' }) as HTMLInputElement).value).toBe('75');
    });
  });
}
