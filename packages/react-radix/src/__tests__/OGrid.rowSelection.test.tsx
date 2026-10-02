import { render, fireEvent } from '@testing-library/react';
import { OGrid } from '../OGrid/OGrid';

type Row = { id: number; name: string };
const rows: Row[] = [
  { id: 5, name: 'Alice' },
  { id: 6, name: 'Bob' },
];
const columns = [{ columnId: 'name', name: 'Name' }];

describe('OGrid single row selection with numeric ids', () => {
  it('selects and deselects the clicked row, emitting the numeric id', () => {
    const onSelectionChange = jest.fn();
    const { container } = render(
      <OGrid<Row>
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        rowSelection="single"
        onSelectionChange={onSelectionChange}
      />
    );
    const row = container.querySelector('tr[data-row-id="5"]') as HTMLElement;
    fireEvent.click(row);
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      selectedRowIds: [5],
      selectedItems: [rows[0]],
    });
    expect(container.querySelector('tr[data-row-id="5"]')?.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(container.querySelector('tr[data-row-id="5"]') as HTMLElement);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ selectedRowIds: [], selectedItems: [] });
  });
});
