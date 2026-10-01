import { render, screen, fireEvent } from '@testing-library/react';
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

describe('DataGridTable leading sticky columns (fluent)', () => {
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

  it('row-number column sticks at 0 when there is no checkbox column', () => {
    const { container } = renderTable({ showRowNumbers: true, pinnedColumns: { name: 'left' } });
    const rowNum = container.querySelector('tbody td:first-child') as HTMLElement;
    expect(rowNum.style.left).toBe('0px');
    const pinned = container.querySelector('tbody td[data-column-id="name"]') as HTMLElement;
    expect(pinned.style.left).toBe('50px');
  });

  it('makes the checkbox and row-number cells sticky inline (Fluent injects position: relative)', () => {
    const { container } = renderTable({ rowSelection: 'multiple', showRowNumbers: true });
    const checkbox = container.querySelector('tbody td:first-child') as HTMLElement;
    expect(checkbox.style.position).toBe('sticky');
    expect(checkbox.style.left).toBe('0px');
    const rowNum = container.querySelector('tbody td:nth-child(2)') as HTMLElement;
    expect(rowNum.style.position).toBe('sticky');
    const headerCheckbox = container.querySelector('thead th:first-child') as HTMLElement;
    expect(headerCheckbox.style.position).toBe('sticky');
  });
});

describe('DataGridTable grouped headers with an ungrouped leading column (Fluent)', () => {
  it('keeps every leaf under its own column and pads the vacated upper row', () => {
    const a: IColumnDef<Row> = { columnId: 'a', name: 'A', renderCell: () => null };
    const b: IColumnDef<Row> = { columnId: 'b', name: 'B', renderCell: () => null };
    const { container } = renderTable({
      columns: [name, { headerName: 'Group', children: [a, b] }],
      visibleColumns: new Set(['name', 'a', 'b']),
    });
    const headerRows = container.querySelectorAll('thead tr');
    expect(headerRows).toHaveLength(2);
    // Upper row: empty placeholder above Name, then the group spanning A and B.
    const upper = Array.from(headerRows[0]!.children);
    expect(upper).toHaveLength(2);
    expect(upper[0]!.textContent).toBe('');
    expect(upper[1]!.textContent).toBe('Group');
    expect(upper[1]!.getAttribute('colspan')).toBe('2');
    // Leaf row: Name, A, B in order.
    const leaves = Array.from(headerRows[1]!.querySelectorAll('[data-column-id]')).map((el) => el.getAttribute('data-column-id'));
    expect(leaves).toEqual(['name', 'a', 'b']);
    expect(headerRows[1]!.children).toHaveLength(3);
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

  it('shows a sort arrow only on the sorted column', () => {
    const { container } = renderTable({ sortBy: 'name', sortDirection: 'desc' });
    const indicators = container.querySelectorAll('[data-sort-indicator]');
    expect(indicators).toHaveLength(1);
    expect(indicators[0]?.getAttribute('data-sort-indicator')).toBe('desc');
    expect(indicators[0]?.closest('th')?.getAttribute('data-column-id')).toBe('name');
  });
});
