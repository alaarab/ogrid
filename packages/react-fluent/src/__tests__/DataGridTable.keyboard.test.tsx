import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { IColumnDef, IOGridDataGridProps } from '@alaarab/ogrid-react';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { InlineCellEditor } from '../DataGridTable/InlineCellEditor';

interface Row {
  id: string;
  owner: string;
  due: string;
}

const rows: Row[] = [
  { id: '1', owner: 'alice@example.com', due: '2024-01-01' },
  { id: '2', owner: 'bob@example.com', due: '2024-02-01' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'owner', name: 'Owner', editable: true, filterable: { type: 'people' } },
  { columnId: 'due', name: 'Due', editable: true, filterable: { type: 'date' } },
];

function renderGrid() {
  const onCellValueChanged = jest.fn();
  const props: IOGridDataGridProps<Row> = {
    items: rows,
    columns,
    getRowId: (r) => r.id,
    sortBy: undefined,
    sortDirection: 'asc',
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['owner', 'due']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: {},
    loadingFilterOptions: {},
    peopleSearch: jest.fn().mockResolvedValue([]),
    editable: true,
    onCellValueChanged,
  };
  const utils = render(
    <FluentProvider theme={webLightTheme}>
      <DataGridTable {...props} />
    </FluentProvider>
  );
  const cell = (row: number, col: number) =>
    utils.container.querySelector(`[data-row-index="${row}"][data-col-index="${col}"]`) as HTMLElement;
  // Select both columns of row 0 so a stray Backspace would clear real data.
  fireEvent.pointerDown(cell(0, 0));
  fireEvent.pointerDown(cell(0, 1), { shiftKey: true });
  return { onCellValueChanged, cell };
}

describe('Fluent DataGridTable keyboard event targets', () => {
  it('Backspace typed in the people filter input leaves the selected cells unchanged', async () => {
    const { onCellValueChanged, cell } = renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Filter Owner' }));
    const input = await screen.findByPlaceholderText('Search for a person...');
    fireEvent.keyDown(input, { key: 'Backspace' });
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(onCellValueChanged).not.toHaveBeenCalled();

    // Control: the same key on the grid itself does clear the selection.
    fireEvent.keyDown(cell(0, 0), { key: 'Backspace' });
    expect(onCellValueChanged).toHaveBeenCalled();
  });

  it('Backspace typed in the date filter inputs leaves the selected cells unchanged', async () => {
    const { onCellValueChanged } = renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Filter Due' }));
    await waitFor(() => expect(document.querySelectorAll('input[type="date"]').length).toBe(2));
    for (const input of Array.from(document.querySelectorAll('input[type="date"]'))) {
      fireEvent.keyDown(input, { key: 'Backspace' });
      fireEvent.keyDown(input, { key: 'Delete' });
    }
    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('focuses the boolean checkbox editor so Space can toggle it', async () => {
    render(
      <FluentProvider theme={webLightTheme}>
        <InlineCellEditor<Row>
          value={false}
          item={rows[0]}
          column={columns[0]}
          rowIndex={0}
          editorType="checkbox"
          onCommit={jest.fn()}
          onCancel={jest.fn()}
        />
      </FluentProvider>
    );
    const checkbox = screen.getByRole('checkbox');
    await waitFor(() => expect(document.activeElement).toBe(checkbox));
  });
});
