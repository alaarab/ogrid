import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataGridTable } from './DataGridTable';
import type { IColumnDef, ICellValueChangedEvent, ICellEditorProps, IRowSelectionChangeEvent } from '@alaarab/ogrid-react';
import { DatePickerEditor, RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } from '@alaarab/ogrid-react-inputs';

interface Row {
  id: string;
  name: string;
  status: string;
  owner: string;
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', status: 'Active', owner: 'alice@test.com' },
  { id: '2', name: 'Beta', status: 'Closed', owner: 'bob@test.com' },
  { id: '3', name: 'Gamma', status: 'Active', owner: 'carol@test.com' },
  { id: '4', name: 'Delta', status: 'Planning', owner: 'dave@test.com' },
];

const columns: IColumnDef<Row>[] = [
  {
    columnId: 'name',
    name: 'Name',
    sortable: true,
    filterable: { type: 'text' },
    renderCell: (item) => <span>{item.name}</span>,
  },
  {
    columnId: 'status',
    name: 'Status',
    sortable: true,
    filterable: { type: 'multiSelect', filterField: 'status' },
    renderCell: (item) => <span>{item.status}</span>,
  },
  {
    columnId: 'owner',
    name: 'Owner',
    sortable: true,
    filterable: { type: 'text' },
    renderCell: (item) => <span>{item.owner}</span>,
  },
];

const getRowId = (r: Row) => r.id;

const noop = () => {};

const meta: Meta<typeof DataGridTable<Row>> = {
  title: 'OGrid/React Radix/DataGridTable',
  component: DataGridTable as React.ComponentType,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof DataGridTable<Row>>;

export const Default: Story = {
  render: () => (
    <DataGridTable<Row>
      items={rows}
      columns={columns}
      getRowId={getRowId}
      sortBy="name"
      sortDirection="asc"
      onColumnSort={noop}
      visibleColumns={new Set(['name', 'status', 'owner'])}
      filters={{}}
      onFilterChange={noop}
      filterOptions={{ status: ['Active', 'Closed', 'Planning'] }}
      loadingFilterOptions={{}}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataGridTable<Row>
      items={[]}
      columns={columns}
      getRowId={getRowId}
      sortBy={undefined}
      sortDirection="asc"
      onColumnSort={noop}
      visibleColumns={new Set(['name', 'status', 'owner'])}
      filters={{}}
      onFilterChange={noop}
      filterOptions={{}}
      loadingFilterOptions={{}}
      emptyState={{
        hasActiveFilters: false,
        onClearAll: noop,
      }}
    />
  ),
};

export const EmptyWithActiveFilters: Story = {
  render: () => (
    <DataGridTable<Row>
      items={[]}
      columns={columns}
      getRowId={getRowId}
      sortBy={undefined}
      sortDirection="asc"
      onColumnSort={noop}
      visibleColumns={new Set(['name', 'status', 'owner'])}
      filters={{ status: { type: 'multiSelect', value: ['Active'] } }}
      onFilterChange={noop}
      filterOptions={{ status: ['Active', 'Closed', 'Planning'] }}
      loadingFilterOptions={{}}
      emptyState={{
        hasActiveFilters: true,
        onClearAll: noop,
      }}
    />
  ),
};

export const WithPeopleFilter: Story = {
  render: () => (
    <DataGridTable<Row>
      items={rows}
      columns={columns}
      getRowId={getRowId}
      sortBy="name"
      sortDirection="asc"
      onColumnSort={noop}
      visibleColumns={new Set(['name', 'status', 'owner'])}
      filters={{}}
      onFilterChange={noop}
      filterOptions={{ status: ['Active', 'Closed', 'Planning'] }}
      loadingFilterOptions={{}}
    />
  ),
};

const columnsMinimal: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', renderCell: (item) => item.name },
  { columnId: 'status', name: 'Status', renderCell: (item) => item.status },
];
const columnsFull: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', renderCell: (item) => item.name },
  { columnId: 'status', name: 'Status', renderCell: (item) => item.status },
  { columnId: 'owner', name: 'Owner', renderCell: (item) => item.owner },
];

export const DynamicColumns: Story = {
  render: function DynamicColumnsStory() {
    const [useFull, setUseFull] = React.useState(false);
    const currentColumns = useFull ? columnsFull : columnsMinimal;
    const visibleIds = currentColumns.map((c) => c.columnId);
    return (
      <div>
        <button type="button" onClick={() => setUseFull((v) => !v)} style={{ marginBottom: 8 }}>
          {useFull ? 'Show minimal (2 cols)' : 'Show full (3 cols)'}
        </button>
        <DataGridTable<Row>
          items={rows}
          columns={currentColumns}
          getRowId={getRowId}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(visibleIds)}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{ status: ['Active', 'Closed', 'Planning'] }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// --- Editable stories ---

interface EditableRow {
  id: string;
  name: string;
  status: string;
  approved: boolean;
}

const editableInitialRows: EditableRow[] = [
  { id: '1', name: 'Alpha', status: 'Active', approved: false },
  { id: '2', name: 'Beta', status: 'Closed', approved: true },
  { id: '3', name: 'Gamma', status: 'Planning', approved: false },
];

const editableColumns: IColumnDef<EditableRow>[] = [
  {
    columnId: 'name',
    name: 'Name',
    editable: true,
    cellEditor: 'text',
  },
  {
    columnId: 'status',
    name: 'Status',
    editable: true,
    cellEditor: 'select',
    cellEditorParams: { values: ['Active', 'Closed', 'Planning'] },
  },
  {
    columnId: 'approved',
    name: 'Approved',
    editable: true,
    cellEditor: 'checkbox',
    valueFormatter: (v) => (v === true ? 'Yes' : 'No'),
  },
];

export const EditableInline: Story = {
  render: function EditableInlineStory() {
    const [items, setItems] = React.useState<EditableRow[]>(editableInitialRows);
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<EditableRow>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);
    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Click a cell to edit. Use Enter to commit (text), blur or change (select/checkbox).
        </p>
        <DataGridTable<EditableRow>
          items={items}
          columns={editableColumns}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(['name', 'status', 'approved'])}
          editable
          onCellValueChanged={handleCellValueChanged}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{ status: ['Active', 'Closed', 'Planning'] }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

function NotesPopupEditor<T>({ value, onValueChange, onCommit, onCancel }: ICellEditorProps<T>) {
  const [local, setLocal] = React.useState(String(value ?? ''));
  return (
    <div style={{ padding: 8, minWidth: 200 }}>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          onValueChange(local);
          onCommit();
        }}
        rows={3}
        style={{ width: '100%', marginBottom: 8 }}
        data-testid="notes-editor"
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { onValueChange(local); onCommit(); }}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface RowWithNotes extends EditableRow {
  notes?: string;
}

const rowsWithNotesInitial: RowWithNotes[] = editableInitialRows.map((r) => ({ ...r, notes: '' }));

export const EditableCustomPopup: Story = {
  render: function EditableCustomPopupStory() {
    const [items, setItems] = React.useState<RowWithNotes[]>(rowsWithNotesInitial);
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<RowWithNotes>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);
    const cols: IColumnDef<RowWithNotes>[] = [
      { columnId: 'name', name: 'Name', renderCell: (item) => item.name },
      {
        columnId: 'notes',
        name: 'Notes',
        editable: true,
        cellEditor: NotesPopupEditor as React.ComponentType<ICellEditorProps<RowWithNotes>>,
        cellEditorPopup: true,
        renderCell: (item) => <span>{item.notes || '\u2014'}</span>,
      },
    ];
    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Click a cell in the Notes column to open the popup editor.
        </p>
        <DataGridTable<RowWithNotes>
          items={items}
          columns={cols}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(['name', 'notes'])}
          editable
          onCellValueChanged={handleCellValueChanged}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{}}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

export const EditablePerRow: Story = {
  render: function EditablePerRowStory() {
    const [items, setItems] = React.useState<EditableRow[]>(editableInitialRows);
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<EditableRow>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);
    const cols: IColumnDef<EditableRow>[] = [
      {
        columnId: 'name',
        name: 'Name',
        editable: (item) => item.status !== 'Closed',
        cellEditor: 'text',
        renderCell: (item) => <span>{item.name}</span>,
      },
      {
        columnId: 'status',
        name: 'Status',
        editable: (item) => item.status !== 'Closed',
        cellEditor: 'select',
        cellEditorParams: { values: ['Active', 'Closed', 'Planning'] },
        renderCell: (item) => <span>{item.status}</span>,
      },
      {
        columnId: 'approved',
        name: 'Approved',
        editable: (item) => item.status !== 'Closed',
        cellEditor: 'checkbox',
        valueFormatter: (v) => (v === true ? 'Yes' : 'No'),
        renderCell: (item) => <span>{item.approved ? 'Yes' : 'No'}</span>,
      },
    ];
    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Only rows with status &ne; &quot;Closed&quot; are editable. Beta (Closed) cannot be edited.
        </p>
        <DataGridTable<EditableRow>
          items={items}
          columns={cols}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(['name', 'status', 'approved'])}
          editable
          onCellValueChanged={handleCellValueChanged}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{ status: ['Active', 'Closed', 'Planning'] }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// ─────────────────────────────────────────────────
// Row Selection stories
// ─────────────────────────────────────────────────

interface SpreadsheetRow {
  id: string;
  name: string;
  department: string;
  salary: number;
  startDate: string;
  status: string;
  email: string;
}

const spreadsheetRows: SpreadsheetRow[] = [
  { id: '1', name: 'Alice Johnson', department: 'Engineering', salary: 125000, startDate: '2021-03-15', status: 'Active', email: 'alice@company.com' },
  { id: '2', name: 'Bob Smith', department: 'Marketing', salary: 95000, startDate: '2020-07-01', status: 'Active', email: 'bob@company.com' },
  { id: '3', name: 'Carol Williams', department: 'Engineering', salary: 140000, startDate: '2019-11-20', status: 'Active', email: 'carol@company.com' },
  { id: '4', name: 'Dave Brown', department: 'Sales', salary: 85000, startDate: '2022-01-10', status: 'On Leave', email: 'dave@company.com' },
  { id: '5', name: 'Eve Davis', department: 'Engineering', salary: 155000, startDate: '2018-05-22', status: 'Active', email: 'eve@company.com' },
  { id: '6', name: 'Frank Miller', department: 'Marketing', salary: 88000, startDate: '2023-02-14', status: 'Active', email: 'frank@company.com' },
  { id: '7', name: 'Grace Lee', department: 'Sales', salary: 92000, startDate: '2021-08-30', status: 'Active', email: 'grace@company.com' },
  { id: '8', name: 'Henry Wilson', department: 'Engineering', salary: 130000, startDate: '2020-04-12', status: 'Inactive', email: 'henry@company.com' },
  { id: '9', name: 'Iris Taylor', department: 'HR', salary: 78000, startDate: '2022-09-05', status: 'Active', email: 'iris@company.com' },
  { id: '10', name: 'Jack Anderson', department: 'Engineering', salary: 145000, startDate: '2019-06-18', status: 'Active', email: 'jack@company.com' },
];

const spreadsheetColumns: IColumnDef<SpreadsheetRow>[] = [
  { columnId: 'name', name: 'Employee Name', sortable: true, minWidth: 160, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', sortable: true, filterable: { type: 'multiSelect' } },
  {
    columnId: 'salary',
    name: 'Salary',
    sortable: true,
    minWidth: 100,
    valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : '',
    cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  },
  { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, minWidth: 110 },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect' } },
  { columnId: 'email', name: 'Email', sortable: true, minWidth: 180 },
];

export const MultiRowSelection: Story = {
  render: function MultiRowSelectionStory() {
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Multi-select with checkboxes. Hold <strong>Shift</strong> to select a range.
          Selected: <strong>{selected.size}</strong> row(s).
        </p>
        <DataGridTable<SpreadsheetRow>
          items={spreadsheetRows}
          columns={spreadsheetColumns}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(spreadsheetColumns.map((c) => c.columnId))}
          rowSelection="multiple"
          selectedRows={selected}
          onSelectionChange={(e: IRowSelectionChangeEvent<SpreadsheetRow>) => setSelected(new Set(e.selectedRowIds))}
          statusBar
          filters={{}}
          onFilterChange={noop}
          filterOptions={{
            department: ['Engineering', 'Marketing', 'Sales', 'HR'],
            status: ['Active', 'On Leave', 'Inactive'],
          }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

export const SingleRowSelection: Story = {
  render: function SingleRowSelectionStory() {
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const selectedItem = spreadsheetRows.find((r) => selected.has(r.id));
    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Single-select: click a row to select it.
          {selectedItem ? (
            <> Selected: <strong>{selectedItem.name}</strong></>
          ) : (
            <> No row selected.</>
          )}
        </p>
        <DataGridTable<SpreadsheetRow>
          items={spreadsheetRows}
          columns={spreadsheetColumns}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(spreadsheetColumns.map((c) => c.columnId))}
          rowSelection="single"
          selectedRows={selected}
          onSelectionChange={(e: IRowSelectionChangeEvent<SpreadsheetRow>) => setSelected(new Set(e.selectedRowIds))}
          statusBar
          filters={{}}
          onFilterChange={noop}
          filterOptions={{
            department: ['Engineering', 'Marketing', 'Sales', 'HR'],
            status: ['Active', 'On Leave', 'Inactive'],
          }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// ─────────────────────────────────────────────────
// Keyboard Navigation story
// ─────────────────────────────────────────────────

export const KeyboardNavigation: Story = {
  render: function KeyboardNavigationStory() {
    const [items, setItems] = React.useState(spreadsheetRows);
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<SpreadsheetRow>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);

    const editableCols: IColumnDef<SpreadsheetRow>[] = [
      { columnId: 'name', name: 'Employee Name', sortable: true, editable: true, cellEditor: 'text', minWidth: 160 },
      {
        columnId: 'department',
        name: 'Department',
        sortable: true,
        editable: true,
        cellEditor: 'select',
        cellEditorParams: { values: ['Engineering', 'Marketing', 'Sales', 'HR'] },
      },
      {
        columnId: 'salary',
        name: 'Salary',
        sortable: true,
        minWidth: 100,
        valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : '',
        cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
      },
      { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, editable: true, minWidth: 110 },
      {
        columnId: 'status',
        name: 'Status',
        sortable: true,
        editable: true,
        cellEditor: 'select',
        cellEditorParams: { values: ['Active', 'On Leave', 'Inactive'] },
      },
      { columnId: 'email', name: 'Email', sortable: true, editable: true, cellEditor: 'text', minWidth: 180 },
    ];

    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Use <strong>Arrow keys</strong> to navigate cells, <strong>Tab</strong>/<strong>Shift+Tab</strong> to move between cells,{' '}
          <strong>Enter</strong> or <strong>F2</strong> to edit, <strong>Escape</strong> to cancel.{' '}
          <strong>Home</strong>/<strong>End</strong> to jump, <strong>Ctrl+Home</strong>/<strong>Ctrl+End</strong> for first/last cell.
        </p>
        <DataGridTable<SpreadsheetRow>
          items={items}
          columns={editableCols}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(editableCols.map((c) => c.columnId))}
          editable
          onCellValueChanged={handleCellValueChanged}
          rowSelection="multiple"
          statusBar
          filters={{}}
          onFilterChange={noop}
          filterOptions={{}}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// ─────────────────────────────────────────────────
// Status Bar story
// ─────────────────────────────────────────────────

export const WithStatusBar: Story = {
  render: () => (
    <div>
      <p style={{ marginBottom: 8, fontSize: 14 }}>
        Status bar at the bottom shows row count, filtered count, and selected count.
      </p>
      <DataGridTable<SpreadsheetRow>
        items={spreadsheetRows}
        columns={spreadsheetColumns}
        getRowId={(r) => r.id}
        sortBy="name"
        sortDirection="asc"
        onColumnSort={noop}
        visibleColumns={new Set(spreadsheetColumns.map((c) => c.columnId))}
        statusBar={{
          totalCount: spreadsheetRows.length,
          filteredCount: spreadsheetRows.length,
          selectedCount: 0,
        }}
        filters={{}}
        onFilterChange={noop}
        filterOptions={{
          department: ['Engineering', 'Marketing', 'Sales', 'HR'],
          status: ['Active', 'On Leave', 'Inactive'],
        }}
        loadingFilterOptions={{}}
      />
    </div>
  ),
};

// ─────────────────────────────────────────────────
// Pinned Columns story
// ─────────────────────────────────────────────────

export const PinnedColumns: Story = {
  render: function PinnedColumnsStory() {
    const pinnedCols: IColumnDef<SpreadsheetRow>[] = [
      { columnId: 'name', name: 'Employee Name', sortable: true, minWidth: 160, pinned: 'left' },
      { columnId: 'department', name: 'Department', sortable: true, minWidth: 120 },
      {
        columnId: 'salary',
        name: 'Salary',
        sortable: true,
        minWidth: 100,
        valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : '',
      },
      { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, minWidth: 120 },
      { columnId: 'status', name: 'Status', sortable: true, minWidth: 100 },
      { columnId: 'email', name: 'Email', sortable: true, minWidth: 200 },
    ];

    return (
      <div style={{ maxWidth: 600 }}>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          The <strong>Employee Name</strong> column is pinned to the left. Scroll horizontally to see it stay fixed.
        </p>
        <DataGridTable<SpreadsheetRow>
          items={spreadsheetRows}
          columns={pinnedCols}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(pinnedCols.map((c) => c.columnId))}
          statusBar
          filters={{}}
          onFilterChange={noop}
          filterOptions={{}}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// ─────────────────────────────────────────────────
// Full Spreadsheet Experience
// ─────────────────────────────────────────────────

export const SpreadsheetExperience: Story = {
  render: function SpreadsheetExperienceStory() {
    const [items, setItems] = React.useState(spreadsheetRows);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<SpreadsheetRow>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);

    const fullCols: IColumnDef<SpreadsheetRow>[] = [
      {
        columnId: 'name',
        name: 'Employee Name',
        sortable: true,
        editable: true,
        cellEditor: 'text',
        minWidth: 160,
        filterable: { type: 'text' },
        pinned: 'left',
      },
      {
        columnId: 'department',
        name: 'Department',
        sortable: true,
        editable: true,
        cellEditor: 'select',
        cellEditorParams: { values: ['Engineering', 'Marketing', 'Sales', 'HR'] },
        filterable: { type: 'multiSelect' },
      },
      {
        columnId: 'salary',
        name: 'Salary',
        sortable: true,
        editable: true,
        cellEditor: 'text',
        minWidth: 100,
        valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? ''),
        cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
      },
      {
        columnId: 'startDate',
        name: 'Start Date',
        type: 'date',
        sortable: true,
        editable: true,
        minWidth: 120,
        filterable: { type: 'date' },
      },
      {
        columnId: 'status',
        name: 'Status',
        sortable: true,
        editable: true,
        cellEditor: 'select',
        cellEditorParams: { values: ['Active', 'On Leave', 'Inactive'] },
        filterable: { type: 'multiSelect' },
        cellStyle: (item) => ({
          color: item.status === 'Active' ? '#107c10' : item.status === 'Inactive' ? '#d13438' : '#ca5010',
          fontWeight: 600,
        }),
      },
      {
        columnId: 'email',
        name: 'Email',
        sortable: true,
        editable: true,
        cellEditor: 'text',
        minWidth: 200,
      },
    ];

    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>Employee Directory</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ogrid-muted, #616161)' }}>
            Full spreadsheet experience: row selection, keyboard navigation, inline editing, column pinning, status bar.
            Selected: <strong>{selected.size}</strong> | Total: <strong>{items.length}</strong>
          </p>
        </div>
        <DataGridTable<SpreadsheetRow>
          items={items}
          columns={fullCols}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(fullCols.map((c) => c.columnId))}
          editable
          onCellValueChanged={handleCellValueChanged}
          rowSelection="multiple"
          selectedRows={selected}
          onSelectionChange={(e: IRowSelectionChangeEvent<SpreadsheetRow>) => setSelected(new Set(e.selectedRowIds))}
          statusBar={{
            totalCount: items.length,
            selectedCount: selected.size,
          }}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{
            department: ['Engineering', 'Marketing', 'Sales', 'HR'],
            status: ['Active', 'On Leave', 'Inactive'],
          }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// ─────────────────────────────────────────────────
// DatePickerEditor story
// ─────────────────────────────────────────────────

interface DatePickerRow {
  id: string;
  name: string;
  startDate: string;
  status: string;
}

const datePickerRows: DatePickerRow[] = [
  { id: '1', name: 'Project Alpha', startDate: '2024-03-15', status: 'Active' },
  { id: '2', name: 'Project Beta', startDate: '2024-06-01', status: 'Planning' },
  { id: '3', name: 'Project Gamma', startDate: '2024-09-22', status: 'Active' },
  { id: '4', name: 'Project Delta', startDate: '2025-01-10', status: 'On Hold' },
];

export const DatePickerEditorStory: Story = {
  name: 'DatePickerEditor',
  render: function DatePickerEditorStory() {
    const [items, setItems] = React.useState<DatePickerRow[]>(datePickerRows);
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<DatePickerRow>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.columnId]: e.newValue } : row
        )
      );
    }, []);

    const cols: IColumnDef<DatePickerRow>[] = [
      {
        columnId: 'name',
        name: 'Project Name',
        editable: true,
        cellEditor: 'text',
        minWidth: 160,
      },
      {
        columnId: 'startDate',
        name: 'Start Date',
        type: 'date',
        editable: true,
        cellEditor: DatePickerEditor as React.ComponentType<ICellEditorProps<DatePickerRow>>,
        cellEditorPopup: true,
        minWidth: 140,
      },
      {
        columnId: 'status',
        name: 'Status',
        editable: true,
        cellEditor: 'select',
        cellEditorParams: { values: ['Active', 'Planning', 'On Hold', 'Completed'] },
      },
    ];

    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Click a cell in the <strong>Start Date</strong> column to open the premium DatePicker popup.
          Other columns use the default inline text and select editors.
        </p>
        <DataGridTable<DatePickerRow>
          items={items}
          columns={cols}
          getRowId={(r) => r.id}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(['name', 'startDate', 'status'])}
          editable
          onCellValueChanged={handleCellValueChanged}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{ status: ['Active', 'Planning', 'On Hold', 'Completed'] }}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};

// ─────────────────────────────────────────────────
// Premium Inputs (Rating, ColorPicker, Slider, Tags)
// ─────────────────────────────────────────────────

interface PremiumInputsItem {
  id: number;
  name: string;
  rating: number;
  color: string;
  progress: number;
  tags: string;
}

const premiumInputsInitialData: PremiumInputsItem[] = [
  { id: 1, name: 'Project Alpha', rating: 4, color: '#FF6B6B', progress: 75, tags: 'React, TypeScript' },
  { id: 2, name: 'Project Beta', rating: 3, color: '#4D96FF', progress: 45, tags: 'Vue, Python' },
  { id: 3, name: 'Project Gamma', rating: 5, color: '#6BCB77', progress: 90, tags: 'Angular, Java' },
  { id: 4, name: 'Project Delta', rating: 2, color: '#FFD93D', progress: 30, tags: 'React, Node' },
  { id: 5, name: 'Project Epsilon', rating: 4, color: '#A66DD4', progress: 60, tags: 'Go, Docker' },
  { id: 6, name: 'Project Zeta', rating: 1, color: '#FF8E72', progress: 15, tags: 'Python, ML' },
  { id: 7, name: 'Project Eta', rating: 5, color: '#00B894', progress: 95, tags: 'Rust, WASM' },
  { id: 8, name: 'Project Theta', rating: 3, color: '#0984E3', progress: 50, tags: 'React, GraphQL' },
];

export const PremiumInputs: Story = {
  name: 'PremiumInputsStory',
  render: function PremiumInputsStory() {
    const [items, setItems] = React.useState<PremiumInputsItem[]>(premiumInputsInitialData);

    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<PremiumInputsItem>) => {
      setItems((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.columnId]: e.newValue } : row
        )
      );
    }, []);

    const cols: IColumnDef<PremiumInputsItem>[] = [
      { columnId: 'name', name: 'Project', sortable: true, editable: true, defaultWidth: 160 },
      {
        columnId: 'rating',
        name: 'Rating',
        editable: true,
        cellEditor: RatingEditor as React.ComponentType<ICellEditorProps<PremiumInputsItem>>,
        cellEditorPopup: true,
        cellEditorParams: { maxStars: 5 },
        defaultWidth: 100,
      },
      {
        columnId: 'color',
        name: 'Color',
        editable: true,
        cellEditor: ColorPickerEditor as React.ComponentType<ICellEditorProps<PremiumInputsItem>>,
        cellEditorPopup: true,
        defaultWidth: 100,
      },
      {
        columnId: 'progress',
        name: 'Progress',
        editable: true,
        cellEditor: SliderEditor as React.ComponentType<ICellEditorProps<PremiumInputsItem>>,
        cellEditorPopup: true,
        cellEditorParams: { min: 0, max: 100, step: 5 },
        valueFormatter: (v: unknown) => v != null ? `${v}%` : '',
        defaultWidth: 100,
      },
      {
        columnId: 'tags',
        name: 'Tags',
        editable: true,
        cellEditor: TagsEditor as React.ComponentType<ICellEditorProps<PremiumInputsItem>>,
        cellEditorPopup: true,
        cellEditorParams: {
          suggestions: ['React', 'Angular', 'Vue', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'Node', 'Docker', 'GraphQL', 'ML', 'WASM'],
        },
        defaultWidth: 180,
      },
    ];

    return (
      <div>
        <p style={{ marginBottom: 8, fontSize: 14 }}>
          Click a cell to open a premium popup editor. <strong>Rating</strong>  -  star picker.{' '}
          <strong>Color</strong>  -  swatch grid + hex input. <strong>Progress</strong>  -  range slider.{' '}
          <strong>Tags</strong>  -  multi-value chip editor with autocomplete.
        </p>
        <DataGridTable<PremiumInputsItem>
          items={items}
          columns={cols}
          getRowId={(r) => String(r.id)}
          sortBy="name"
          sortDirection="asc"
          onColumnSort={noop}
          visibleColumns={new Set(['name', 'rating', 'color', 'progress', 'tags'])}
          editable
          cellSelection
          statusBar
          onCellValueChanged={handleCellValueChanged}
          filters={{}}
          onFilterChange={noop}
          filterOptions={{}}
          loadingFilterOptions={{}}
        />
      </div>
    );
  },
};
