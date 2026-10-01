import { act, render, screen, fireEvent } from '@testing-library/react';
import type { IColumnDef, IColumnGroupDef } from '@alaarab/ogrid-react';
import { DataGridTable } from '../DataGridTable/DataGridTable';

type Row = { id: string; name: string; status: string };
const rows: Row[] = [
  { id: '1', name: 'Alpha', status: 'Active' },
  { id: '2', name: 'Beta', status: 'Closed' },
];
const name: IColumnDef<Row> = { columnId: 'name', name: 'Name', sortable: true, renderCell: (r) => <span>{r.name}</span> };
const status: IColumnDef<Row> = { columnId: 'status', name: 'Status', sortable: true, renderCell: (r) => <span>{r.status}</span> };

function renderTable(overrides: Record<string, unknown> = {}) {
  return render(
    <DataGridTable
      items={rows}
      columns={[name, status] as (IColumnDef<Row> | IColumnGroupDef<Row>)[]}
      getRowId={(r: Row) => r.id}
      sortBy={undefined}
      sortDirection="asc"
      onColumnSort={jest.fn()}
      visibleColumns={new Set(['name', 'status'])}
      filters={{}}
      onFilterChange={jest.fn()}
      filterOptions={{}}
      loadingFilterOptions={{}}
      {...overrides}
    />
  );
}

describe('DataGridTable leading sticky columns (radix)', () => {
  it('offsets the row-number column past the checkbox column and left-pins past both', () => {
    const { container } = renderTable({ rowSelection: 'multiple', showRowNumbers: true, pinnedColumns: { name: 'left' } });
    const rowNum = container.querySelector('tbody td:nth-child(2)') as HTMLElement;
    expect(rowNum.style.left).toBe('48px');
    const pinned = container.querySelector('tbody td[data-column-id="name"]') as HTMLElement;
    // checkbox (48) + row number (50)
    expect(pinned.style.left).toBe('98px');
    const rowNumHeader = container.querySelector('thead th:nth-child(2)') as HTMLElement;
    expect(rowNumHeader.style.left).toBe('48px');
  });

  it('holds the column-letter spacers to the checkbox/row-number widths the offsets assume', () => {
    // An unsized spacer picks up the 80px cell min-width and widens the column past the offsets.
    const { container } = renderTable({ rowSelection: 'multiple', showRowNumbers: true, showColumnLetters: true });
    const spacers = container.querySelectorAll('thead tr:first-child th');
    expect((spacers[0] as HTMLElement).style.minWidth).toBe('48px');
    expect((spacers[1] as HTMLElement).style.minWidth).toBe('50px');
  });

  it('row-number column sticks at 0 when there is no checkbox column', () => {
    const { container } = renderTable({ showRowNumbers: true, pinnedColumns: { name: 'left' } });
    const rowNum = container.querySelector('tbody td:first-child') as HTMLElement;
    expect(rowNum.style.left).toBe('0px');
    const pinned = container.querySelector('tbody td[data-column-id="name"]') as HTMLElement;
    expect(pinned.style.left).toBe('50px');
  });
});

describe('DataGridTable header menu layering and sort indicator', () => {
  it('layers the portaled header options menu above the fullscreen grid (z-index 9999)', () => {
    renderTable();
    fireEvent.click(screen.getByLabelText('Name column options') as HTMLElement);
    const item = screen.getByText('Sort ascending');
    const menu = item.closest('[style*="position: fixed"]') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.style.zIndex).toBe('var(--ogrid-z-popover, 10001)');
  });

  it('closes the header menu on scroll only when its header has moved', () => {
    renderTable();
    const trigger = screen.getByLabelText('Name column options') as HTMLElement;
    fireEvent.click(trigger);
    expect(screen.queryByText('Sort ascending')).not.toBeNull();
    // A scroll that leaves the header in place (focus on open, unrelated scroller) keeps it open.
    act(() => { window.dispatchEvent(new Event('scroll')); });
    expect(screen.queryByText('Sort ascending')).not.toBeNull();
    // Once the header moves, the fixed-position menu would be detached: close it.
    trigger.getBoundingClientRect = () => ({ top: -40, left: 0, bottom: -10, right: 30, width: 30, height: 30, x: 0, y: -40, toJSON: () => ({}) });
    act(() => { window.dispatchEvent(new Event('scroll')); });
    expect(screen.queryByText('Sort ascending')).toBeNull();
  });

  it('shows a sort arrow only on the sorted column', () => {
    const { container } = renderTable({ sortBy: 'name', sortDirection: 'desc' });
    const indicators = container.querySelectorAll('[data-sort-indicator]');
    expect(indicators).toHaveLength(1);
    expect(indicators[0]?.getAttribute('data-sort-indicator')).toBe('desc');
    expect(indicators[0]?.closest('th')?.getAttribute('data-column-id')).toBe('name');
  });
});
