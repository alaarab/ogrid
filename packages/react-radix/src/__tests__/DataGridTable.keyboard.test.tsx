import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { IColumnDef, IOGridDataGridProps } from '@alaarab/ogrid-react';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { InlineCellEditor } from '../DataGridTable/InlineCellEditor';

interface Row {
  id: string;
  name: string;
  status: string;
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', status: 'Active' },
  { id: '2', name: 'Beta', status: 'Closed' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', editable: true, filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', editable: true },
];

function renderGrid(overrides: Partial<IOGridDataGridProps<Row>> = {}) {
  const onCellValueChanged = jest.fn();
  const props: IOGridDataGridProps<Row> = {
    items: rows,
    columns,
    getRowId: (r) => r.id,
    sortBy: undefined,
    sortDirection: 'asc',
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['name', 'status']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: {},
    loadingFilterOptions: {},
    editable: true,
    onCellValueChanged,
    ...overrides,
  };
  const utils = render(<DataGridTable {...props} />);
  const cell = (row: number, col: number) =>
    utils.container.querySelector(`[data-row-index="${row}"][data-col-index="${col}"]`) as HTMLElement;
  return { ...utils, onCellValueChanged, cell };
}

describe('Radix DataGridTable keyboard event targets', () => {
  it('Backspace typed in the text filter input leaves the selected cells unchanged', async () => {
    const { cell, onCellValueChanged } = renderGrid();
    fireEvent.pointerDown(cell(0, 0));
    fireEvent.pointerDown(cell(0, 1), { shiftKey: true });

    fireEvent.click(screen.getByRole('button', { name: 'Filter Name' }));
    const input = await screen.findByPlaceholderText('Enter search term...');
    fireEvent.change(input, { target: { value: 'Al' } });
    fireEvent.keyDown(input, { key: 'Backspace' });
    fireEvent.keyDown(input, { key: 'Delete' });
    fireEvent.keyDown(input, { key: 'x', ctrlKey: true });

    expect(onCellValueChanged).not.toHaveBeenCalled();

    // Control: the same key on the grid itself does clear the selection.
    fireEvent.keyDown(cell(0, 0), { key: 'Backspace' });
    expect(onCellValueChanged).toHaveBeenCalled();
  });

  it('focuses the boolean checkbox editor so Space can toggle it', async () => {
    const onCommit = jest.fn();
    render(
      <InlineCellEditor<Row>
        value={false}
        item={rows[0]}
        column={columns[0]}
        rowIndex={0}
        editorType="checkbox"
        onCommit={onCommit}
        onCancel={jest.fn()}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    await waitFor(() => expect(document.activeElement).toBe(checkbox));
  });

  it('rich select editor cancels when focus leaves it', async () => {
    const onCancel = jest.fn();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    render(
      <InlineCellEditor<Row>
        value="Active"
        item={rows[0]}
        column={{ columnId: 'status', name: 'Status', cellEditorParams: { values: ['Active', 'Closed'] } }}
        rowIndex={0}
        editorType="richSelect"
        onCommit={jest.fn()}
        onCancel={onCancel}
      />
    );
    const search = screen.getByPlaceholderText('Search...');
    act(() => { search.focus(); });
    act(() => { outside.focus(); });
    fireEvent.blur(search);
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });
});
