import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { DataGridTable } from './DataGridTable';
import type { IOGridDataGridProps, IColumnDef, ICellValueChangedEvent, IRowSelectionChangeEvent } from '@alaarab/ogrid-vue';

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
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' } },
  { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' } },
];

const getRowId = (r: Row) => r.id;

const noop = () => {};

const meta: Meta<typeof DataGridTable> = {
  title: 'OGrid/Vue Vuetify/DataGridTable',
  component: DataGridTable,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof DataGridTable>;

export const Default: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const gridProps: IOGridDataGridProps<Row> = {
        items: rows,
        columns,
        getRowId,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status', 'owner']),
        filters: {},
        onFilterChange: noop,
        filterOptions: { status: ['Active', 'Closed', 'Planning'] },
        loadingFilterOptions: {},
      };
      return { gridProps };
    },
    template: '<DataGridTable :grid-props="gridProps" />',
  }),
};

export const Empty: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const gridProps: IOGridDataGridProps<Row> = {
        items: [],
        columns,
        getRowId,
        sortBy: undefined,
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status', 'owner']),
        filters: {},
        onFilterChange: noop,
        filterOptions: {},
        loadingFilterOptions: {},
        emptyState: {
          hasActiveFilters: false,
          onClearAll: noop,
        },
      };
      return { gridProps };
    },
    template: '<DataGridTable :grid-props="gridProps" />',
  }),
};

export const EmptyWithActiveFilters: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const gridProps: IOGridDataGridProps<Row> = {
        items: [],
        columns,
        getRowId,
        sortBy: undefined,
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status', 'owner']),
        filters: { status: { type: 'multiSelect', value: ['Active'] } },
        onFilterChange: noop,
        filterOptions: { status: ['Active', 'Closed', 'Planning'] },
        loadingFilterOptions: {},
        emptyState: {
          hasActiveFilters: true,
          onClearAll: noop,
        },
      };
      return { gridProps };
    },
    template: '<DataGridTable :grid-props="gridProps" />',
  }),
};

export const WithPeopleFilter: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const gridProps: IOGridDataGridProps<Row> = {
        items: rows,
        columns,
        getRowId,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status', 'owner']),
        filters: {},
        onFilterChange: noop,
        filterOptions: { status: ['Active', 'Closed', 'Planning'] },
        loadingFilterOptions: {},
      };
      return { gridProps };
    },
    template: '<DataGridTable :grid-props="gridProps" />',
  }),
};

const columnsMinimal: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'status', name: 'Status' },
];
const columnsFull: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'status', name: 'Status' },
  { columnId: 'owner', name: 'Owner' },
];

export const DynamicColumns: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const useFull = ref(false);
      const gridProps = ref<IOGridDataGridProps<Row>>({
        items: rows,
        columns: columnsMinimal,
        getRowId,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status']),
        filters: {},
        onFilterChange: noop,
        filterOptions: { status: ['Active', 'Closed', 'Planning'] },
        loadingFilterOptions: {},
      });

      const toggleColumns = () => {
        useFull.value = !useFull.value;
        const currentColumns = useFull.value ? columnsFull : columnsMinimal;
        const visibleIds = currentColumns.map((c) => c.columnId);
        gridProps.value = {
          ...gridProps.value,
          columns: currentColumns,
          visibleColumns: new Set(visibleIds),
        };
      };

      return { gridProps, useFull, toggleColumns };
    },
    template: `
      <div>
        <button type="button" @click="toggleColumns" style="margin-bottom: 8px">
          {{ useFull ? 'Show minimal (2 cols)' : 'Show full (3 cols)' }}
        </button>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
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
  { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
  { columnId: 'status', name: 'Status', editable: true, cellEditor: 'select', cellEditorParams: { values: ['Active', 'Closed', 'Planning'] } },
  { columnId: 'approved', name: 'Approved', editable: true, cellEditor: 'checkbox', valueFormatter: (v) => (v === true ? 'Yes' : 'No') },
];

export const EditableInline: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const items = ref<EditableRow[]>(editableInitialRows);
      const handleCellValueChanged = (e: ICellValueChangedEvent<EditableRow>) => {
        items.value = items.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const gridProps = ref<IOGridDataGridProps<EditableRow>>({
        items: items.value,
        columns: editableColumns,
        getRowId: (r: EditableRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status', 'approved']),
        editable: true,
        onCellValueChanged: handleCellValueChanged,
        filters: {},
        onFilterChange: noop,
        filterOptions: { status: ['Active', 'Closed', 'Planning'] },
        loadingFilterOptions: {},
      });

      // Update items in gridProps when they change
      const updateGridProps = () => {
        gridProps.value = { ...gridProps.value, items: items.value };
      };

      return { gridProps, items, updateGridProps };
    },
    watch: {
      items: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Click a cell to edit. Use Enter to commit (text), blur or change (select/checkbox).
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

interface RowWithNotes extends EditableRow {
  notes?: string;
}

const rowsWithNotesInitial: RowWithNotes[] = editableInitialRows.map((r) => ({ ...r, notes: '' }));

export const EditableCustomPopup: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const items = ref<RowWithNotes[]>(rowsWithNotesInitial);
      const handleCellValueChanged = (e: ICellValueChangedEvent<RowWithNotes>) => {
        items.value = items.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const cols: IColumnDef<RowWithNotes>[] = [
        { columnId: 'name', name: 'Name' },
        {
          columnId: 'notes',
          name: 'Notes',
          editable: true,
          cellEditor: 'text', // Note: Custom popup editor would need to be defined in Vue, using text for simplicity
          cellEditorPopup: true,
        },
      ];

      const gridProps = ref<IOGridDataGridProps<RowWithNotes>>({
        items: items.value,
        columns: cols,
        getRowId: (r: RowWithNotes) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'notes']),
        editable: true,
        onCellValueChanged: handleCellValueChanged,
        filters: {},
        onFilterChange: noop,
        filterOptions: {},
        loadingFilterOptions: {},
      });

      const updateGridProps = () => {
        gridProps.value = { ...gridProps.value, items: items.value };
      };

      return { gridProps, items, updateGridProps };
    },
    watch: {
      items: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Click a cell in the Notes column to open the popup editor.
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

export const EditablePerRow: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const items = ref<EditableRow[]>(editableInitialRows);
      const handleCellValueChanged = (e: ICellValueChangedEvent<EditableRow>) => {
        items.value = items.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const cols: IColumnDef<EditableRow>[] = [
        { columnId: 'name', name: 'Name', editable: (item: EditableRow) => item.status !== 'Closed', cellEditor: 'text' },
        { columnId: 'status', name: 'Status', editable: (item: EditableRow) => item.status !== 'Closed', cellEditor: 'select', cellEditorParams: { values: ['Active', 'Closed', 'Planning'] } },
        { columnId: 'approved', name: 'Approved', editable: (item: EditableRow) => item.status !== 'Closed', cellEditor: 'checkbox', valueFormatter: (v) => (v === true ? 'Yes' : 'No') },
      ];

      const gridProps = ref<IOGridDataGridProps<EditableRow>>({
        items: items.value,
        columns: cols,
        getRowId: (r: EditableRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(['name', 'status', 'approved']),
        editable: true,
        onCellValueChanged: handleCellValueChanged,
        filters: {},
        onFilterChange: noop,
        filterOptions: { status: ['Active', 'Closed', 'Planning'] },
        loadingFilterOptions: {},
      });

      const updateGridProps = () => {
        gridProps.value = { ...gridProps.value, items: items.value };
      };

      return { gridProps, items, updateGridProps };
    },
    watch: {
      items: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Only rows with status ≠ "Closed" are editable. Beta (Closed) cannot be edited.
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
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
  render: () => ({
    components: { DataGridTable },
    setup() {
      const selected = ref<Set<string>>(new Set());
      const handleSelectionChange = (e: IRowSelectionChangeEvent<SpreadsheetRow>) => {
        selected.value = new Set(e.selectedRowIds);
      };

      const gridProps: IOGridDataGridProps<SpreadsheetRow> = {
        items: spreadsheetRows,
        columns: spreadsheetColumns,
        getRowId: (r: SpreadsheetRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(spreadsheetColumns.map((c) => c.columnId)),
        rowSelection: 'multiple',
        selectedRows: selected.value,
        onSelectionChange: handleSelectionChange,
        statusBar: true,
        filters: {},
        onFilterChange: noop,
        filterOptions: {
          department: ['Engineering', 'Marketing', 'Sales', 'HR'],
          status: ['Active', 'On Leave', 'Inactive'],
        },
        loadingFilterOptions: {},
      };

      return { gridProps, selected };
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Multi-select with checkboxes. Hold <strong>Shift</strong> to select a range.
          Selected: <strong>{{ selected.size }}</strong> row(s).
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

export const SingleRowSelection: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const selected = ref<Set<string>>(new Set());
      const handleSelectionChange = (e: IRowSelectionChangeEvent<SpreadsheetRow>) => {
        selected.value = new Set(e.selectedRowIds);
      };

      const selectedItem = ref<SpreadsheetRow | undefined>(undefined);
      const updateSelectedItem = () => {
        selectedItem.value = spreadsheetRows.find((r) => selected.value.has(r.id));
      };

      const gridProps: IOGridDataGridProps<SpreadsheetRow> = {
        items: spreadsheetRows,
        columns: spreadsheetColumns,
        getRowId: (r: SpreadsheetRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(spreadsheetColumns.map((c) => c.columnId)),
        rowSelection: 'single',
        selectedRows: selected.value,
        onSelectionChange: (e: IRowSelectionChangeEvent<SpreadsheetRow>) => {
          handleSelectionChange(e);
          updateSelectedItem();
        },
        statusBar: true,
        filters: {},
        onFilterChange: noop,
        filterOptions: {
          department: ['Engineering', 'Marketing', 'Sales', 'HR'],
          status: ['Active', 'On Leave', 'Inactive'],
        },
        loadingFilterOptions: {},
      };

      return { gridProps, selected, selectedItem };
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Single-select: click a row to select it.
          <template v-if="selectedItem">
            Selected: <strong>{{ selectedItem.name }}</strong>
          </template>
          <template v-else>
            No row selected.
          </template>
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

// ─────────────────────────────────────────────────
// Keyboard Navigation story
// ─────────────────────────────────────────────────

export const KeyboardNavigation: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const items = ref(spreadsheetRows);
      const handleCellValueChanged = (e: ICellValueChangedEvent<SpreadsheetRow>) => {
        items.value = items.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const editableCols: IColumnDef<SpreadsheetRow>[] = [
        { columnId: 'name', name: 'Employee Name', sortable: true, editable: true, cellEditor: 'text', minWidth: 160 },
        { columnId: 'department', name: 'Department', sortable: true, editable: true, cellEditor: 'select', cellEditorParams: { values: ['Engineering', 'Marketing', 'Sales', 'HR'] } },
        {
          columnId: 'salary',
          name: 'Salary',
          sortable: true,
          minWidth: 100,
          valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : '',
          cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
        },
        { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, editable: true, minWidth: 110 },
        { columnId: 'status', name: 'Status', sortable: true, editable: true, cellEditor: 'select', cellEditorParams: { values: ['Active', 'On Leave', 'Inactive'] } },
        { columnId: 'email', name: 'Email', sortable: true, editable: true, cellEditor: 'text', minWidth: 180 },
      ];

      const gridProps = ref<IOGridDataGridProps<SpreadsheetRow>>({
        items: items.value,
        columns: editableCols,
        getRowId: (r: SpreadsheetRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(editableCols.map((c) => c.columnId)),
        editable: true,
        onCellValueChanged: handleCellValueChanged,
        rowSelection: 'multiple',
        statusBar: true,
        filters: {},
        onFilterChange: noop,
        filterOptions: {},
        loadingFilterOptions: {},
      });

      const updateGridProps = () => {
        gridProps.value = { ...gridProps.value, items: items.value };
      };

      return { gridProps, items, updateGridProps };
    },
    watch: {
      items: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Use <strong>Arrow keys</strong> to navigate cells, <strong>Tab</strong>/<strong>Shift+Tab</strong> to move between cells,
          <strong>Enter</strong> or <strong>F2</strong> to edit, <strong>Escape</strong> to cancel.
          <strong>Home</strong>/<strong>End</strong> to jump, <strong>Ctrl+Home</strong>/<strong>Ctrl+End</strong> for first/last cell.
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

// ─────────────────────────────────────────────────
// Status Bar story
// ─────────────────────────────────────────────────

export const WithStatusBar: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const gridProps: IOGridDataGridProps<SpreadsheetRow> = {
        items: spreadsheetRows,
        columns: spreadsheetColumns,
        getRowId: (r: SpreadsheetRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(spreadsheetColumns.map((c) => c.columnId)),
        statusBar: {
          totalCount: spreadsheetRows.length,
          filteredCount: spreadsheetRows.length,
          selectedCount: 0,
        },
        filters: {},
        onFilterChange: noop,
        filterOptions: {
          department: ['Engineering', 'Marketing', 'Sales', 'HR'],
          status: ['Active', 'On Leave', 'Inactive'],
        },
        loadingFilterOptions: {},
      };
      return { gridProps };
    },
    template: `
      <div>
        <p style="margin-bottom: 8px; font-size: 14px">
          Status bar at the bottom shows row count, filtered count, and selected count.
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

// ─────────────────────────────────────────────────
// Pinned Columns story
// ─────────────────────────────────────────────────

export const PinnedColumns: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
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

      const gridProps: IOGridDataGridProps<SpreadsheetRow> = {
        items: spreadsheetRows,
        columns: pinnedCols,
        getRowId: (r: SpreadsheetRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(pinnedCols.map((c) => c.columnId)),
        statusBar: true,
        filters: {},
        onFilterChange: noop,
        filterOptions: {},
        loadingFilterOptions: {},
      };

      return { gridProps };
    },
    template: `
      <div style="max-width: 600px">
        <p style="margin-bottom: 8px; font-size: 14px">
          The <strong>Employee Name</strong> column is pinned to the left. Scroll horizontally to see it stay fixed.
        </p>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};

// ─────────────────────────────────────────────────
// Full Spreadsheet Experience
// ─────────────────────────────────────────────────

export const SpreadsheetExperience: Story = {
  render: () => ({
    components: { DataGridTable },
    setup() {
      const items = ref(spreadsheetRows);
      const selected = ref<Set<string>>(new Set());

      const handleCellValueChanged = (e: ICellValueChangedEvent<SpreadsheetRow>) => {
        items.value = items.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const handleSelectionChange = (e: IRowSelectionChangeEvent<SpreadsheetRow>) => {
        selected.value = new Set(e.selectedRowIds);
      };

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
          cellStyle: (item: SpreadsheetRow) => ({
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

      const gridProps = ref<IOGridDataGridProps<SpreadsheetRow>>({
        items: items.value,
        columns: fullCols,
        getRowId: (r: SpreadsheetRow) => r.id,
        sortBy: 'name',
        sortDirection: 'asc',
        onColumnSort: noop,
        visibleColumns: new Set(fullCols.map((c) => c.columnId)),
        editable: true,
        onCellValueChanged: handleCellValueChanged,
        rowSelection: 'multiple',
        selectedRows: selected.value,
        onSelectionChange: handleSelectionChange,
        statusBar: {
          totalCount: items.value.length,
          selectedCount: selected.value.size,
        },
        filters: {},
        onFilterChange: noop,
        filterOptions: {
          department: ['Engineering', 'Marketing', 'Sales', 'HR'],
          status: ['Active', 'On Leave', 'Inactive'],
        },
        loadingFilterOptions: {},
      });

      const updateGridProps = () => {
        gridProps.value = {
          ...gridProps.value,
          items: items.value,
          selectedRows: selected.value,
          statusBar: {
            totalCount: items.value.length,
            selectedCount: selected.value.size,
          },
        };
      };

      return { gridProps, items, selected, updateGridProps };
    },
    watch: {
      items: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
      selected: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: `
      <div style="max-width: 900px">
        <div style="margin-bottom: 12px">
          <h3 style="margin: 0 0 4px 0; font-size: 16px">Employee Directory</h3>
          <p style="margin: 0; font-size: 13px; color: rgba(0,0,0,0.6)">
            Full spreadsheet experience: row selection, keyboard navigation, inline editing, column pinning, status bar.
            Selected: <strong>{{ selected.size }}</strong> | Total: <strong>{{ items.length }}</strong>
          </p>
        </div>
        <DataGridTable :grid-props="gridProps" />
      </div>
    `,
  }),
};
