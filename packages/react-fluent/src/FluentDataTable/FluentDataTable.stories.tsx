import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OGrid } from './FluentDataTable';
import type { IColumnDef, ICellValueChangedEvent, ISideBarDef } from '@alaarab/ogrid-react';

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: string;
  owner: string;
  budget: number;
  startDate: string;
  active: boolean;
}

const STATUSES = ['Active', 'Planning', 'On Hold', 'Completed', 'Cancelled'];
const OWNERS = ['Alice Johnson', 'Bob Smith', 'Carol Lee', 'David Kim', 'Eve Torres'];

function makeProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `proj-${i + 1}`,
    name: `Project ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ''}`,
    status: STATUSES[i % STATUSES.length],
    owner: OWNERS[i % OWNERS.length],
    budget: Math.round((10000 + Math.random() * 90000) * 100) / 100,
    startDate: new Date(2024, i % 12, 1 + (i % 28)).toISOString().slice(0, 10),
    active: i % 3 !== 0,
  }));
}

const columns: IColumnDef<Project>[] = [
  {
    columnId: 'name',
    name: 'Project Name',
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
  {
    columnId: 'budget',
    name: 'Budget',
    sortable: true,
    compare: (a, b) => a.budget - b.budget,
    renderCell: (item) => <span>${item.budget.toLocaleString()}</span>,
  },
  {
    columnId: 'startDate',
    name: 'Start Date',
    type: 'date',
    sortable: true,
    filterable: { type: 'date' },
  },
  {
    columnId: 'active',
    name: 'Active',
    type: 'boolean',
    sortable: true,
  },
];

const getRowId = (p: Project) => p.id;

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof OGrid<Project>> = {
  title: 'OGrid/Fluent/OGrid',
  component: OGrid as React.ComponentType,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof OGrid<Project>>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  render: () => (
    <div>
      <h2 style={{ margin: '0 0 8px 0' }}>Projects</h2>
      <OGrid<Project>
        data={makeProjects(50)}
        columns={columns}
        getRowId={getRowId}
        entityLabelPlural="projects"
        defaultPageSize={10}
      />
    </div>
  ),
};

export const SmallDataSet: Story = {
  render: () => (
    <OGrid<Project>
      data={makeProjects(5)}
      columns={columns}
      getRowId={getRowId}
      entityLabelPlural="projects"
      defaultPageSize={10}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <OGrid<Project>
      data={[]}
      columns={columns}
      getRowId={getRowId}
      entityLabelPlural="projects"
    />
  ),
};

export const DefaultSortDescending: Story = {
  render: () => (
    <OGrid<Project>
      data={makeProjects(30)}
      columns={columns}
      getRowId={getRowId}
      entityLabelPlural="projects"
      defaultSortBy="budget"
      defaultSortDirection="desc"
    />
  ),
};

export const Editable: Story = {
  render: function EditableStory() {
    const [data, setData] = React.useState(() => makeProjects(5));
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<Project>) => {
      setData((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);
    const editableColumns: IColumnDef<Project>[] = [
      {
        columnId: 'name',
        name: 'Project Name',
        sortable: true,
        filterable: { type: 'text' },
        editable: true,
        cellEditor: 'text',
        renderCell: (item) => <span>{item.name}</span>,
      },
      {
        columnId: 'status',
        name: 'Status',
        sortable: true,
        filterable: { type: 'multiSelect', filterField: 'status' },
        editable: true,
        cellEditor: 'select',
        cellEditorParams: { values: STATUSES },
        renderCell: (item) => <span>{item.status}</span>,
      },
      {
        columnId: 'owner',
        name: 'Owner',
        sortable: true,
        filterable: { type: 'text' },
        renderCell: (item) => <span>{item.owner}</span>,
      },
      {
        columnId: 'budget',
        name: 'Budget',
        sortable: true,
        compare: (a, b) => a.budget - b.budget,
        renderCell: (item) => <span>${item.budget.toLocaleString()}</span>,
      },
      {
        columnId: 'startDate',
        name: 'Start Date',
        type: 'date',
        sortable: true,
        filterable: { type: 'date' },
        editable: true,
      },
      {
        columnId: 'active',
        name: 'Active',
        type: 'boolean',
        sortable: true,
        editable: true,
      },
    ];
    return (
      <div>
        <h2 style={{ margin: '0 0 8px 0' }}>Projects (editable name &amp; status)</h2>
        <OGrid<Project>
          data={data}
          columns={editableColumns}
          getRowId={getRowId}
          entityLabelPlural="projects"
          editable
          onCellValueChanged={handleCellValueChanged}
        />
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Spreadsheet Experience (OGrid) — same behavior as DataGridTable Spreadsheet Experience
// Single click = select cell; double-click or Enter/F2 = edit. Drag & Shift+click = range. Right-click = context menu.
// ---------------------------------------------------------------------------

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

export const SpreadsheetExperience: Story = {
  render: function SpreadsheetExperienceStory() {
    const [data, setData] = React.useState(spreadsheetRows);
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<SpreadsheetRow>) => {
      setData((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);

    const spreadsheetColumns: IColumnDef<SpreadsheetRow>[] = [
      { columnId: 'name', name: 'Employee Name', sortable: true, editable: true, cellEditor: 'text', minWidth: 160, filterable: { type: 'text' }, pinned: 'left' },
      { columnId: 'department', name: 'Department', sortable: true, editable: true, cellEditor: 'select', cellEditorParams: { values: ['Engineering', 'Marketing', 'Sales', 'HR'] }, filterable: { type: 'multiSelect' } },
      { columnId: 'salary', name: 'Salary', sortable: true, editable: true, cellEditor: 'text', minWidth: 100, valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? ''), cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } },
      { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true },
      { columnId: 'status', name: 'Status', sortable: true, editable: true, cellEditor: 'select', cellEditorParams: { values: ['Active', 'On Leave', 'Inactive'] }, filterable: { type: 'multiSelect' }, cellStyle: (item) => ({ color: item.status === 'Active' ? '#107c10' : item.status === 'Inactive' ? '#d13438' : '#ca5010', fontWeight: 600 }) },
      { columnId: 'email', name: 'Email', sortable: true, editable: true, cellEditor: 'text', minWidth: 200 },
    ];

    return (
      <div style={{ maxWidth: 900 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Employee Directory (OGrid)</h2>
        <OGrid<SpreadsheetRow>
          data={data}
          columns={spreadsheetColumns}
          getRowId={(r) => r.id}
          entityLabelPlural="employees"
          editable
          onCellValueChanged={handleCellValueChanged}
          rowSelection="multiple"
          statusBar
          defaultPageSize={25}
        />
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ogrid-muted, #616161)' }}>
          Spreadsheet behavior: single click = select; double-click or Enter/F2 = edit; drag or Shift+click = range; right-click = context menu (Copy, Cut, Paste, Select all).
        </p>
      </div>
    );
  },
};

export const SideBar: Story = {
  render: () => (
    <OGrid<Project>
      data={makeProjects(20)}
      columns={columns}
      getRowId={getRowId}
      entityLabelPlural="projects"
      sideBar
      columnChooser="sidebar"
      statusBar
      defaultPageSize={10}
    />
  ),
};

export const SideBarLeftPosition: Story = {
  render: () => {
    const sideBarDef: ISideBarDef = {
      position: 'left',
      defaultPanel: 'filters',
    };
    return (
      <OGrid<Project>
        data={makeProjects(20)}
        columns={columns}
        getRowId={getRowId}
        entityLabelPlural="projects"
        sideBar={sideBarDef}
        columnChooser="sidebar"
        defaultPageSize={10}
      />
    );
  },
};

export const ToolbarWithSecondaryRow: Story = {
  render: () => (
    <OGrid<Project>
      data={makeProjects(20)}
      columns={columns}
      getRowId={getRowId}
      entityLabelPlural="projects"
      columnChooser="toolbar"
      pagination
      defaultPageSize={10}
      toolbar={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <strong>Projects</strong>
          <button type="button" style={{ padding: '2px 8px', fontSize: 12 }}>Export</button>
        </div>
      }
      toolbarBelow={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ogrid-muted, #666)', marginRight: 4 }}>Active filters:</span>
          <span style={{ padding: '2px 8px', background: 'var(--ogrid-border, #e0e0e0)', borderRadius: 12 }}>
            Status: Active &times;
          </span>
          <span style={{ padding: '2px 8px', background: 'var(--ogrid-border, #e0e0e0)', borderRadius: 12 }}>
            Department: Engineering &times;
          </span>
        </div>
      }
    />
  ),
};

// ---------------------------------------------------------------------------
// Playground — fully interactive with Storybook controls
// ---------------------------------------------------------------------------

const playgroundColumns: IColumnDef<Project>[] = [
  {
    columnId: 'name',
    name: 'Project Name',
    sortable: true,
    filterable: { type: 'text' },
    editable: true,
    cellEditor: 'text',
    pinned: 'left',
    minWidth: 150,
  },
  {
    columnId: 'status',
    name: 'Status',
    sortable: true,
    filterable: { type: 'multiSelect', filterField: 'status' },
    editable: true,
    cellEditor: 'richSelect',
    cellEditorParams: { values: STATUSES },
  },
  {
    columnId: 'owner',
    name: 'Owner',
    sortable: true,
    filterable: { type: 'text' },
    editable: true,
    cellEditor: 'text',
  },
  {
    columnId: 'budget',
    name: 'Budget',
    type: 'numeric',
    sortable: true,
    editable: true,
    cellEditor: 'text',
    compare: (a, b) => a.budget - b.budget,
    valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? ''),
  },
  {
    columnId: 'startDate',
    name: 'Start Date',
    type: 'date',
    sortable: true,
    filterable: { type: 'date' },
    editable: true,
  },
  {
    columnId: 'active',
    name: 'Active',
    type: 'boolean',
    sortable: true,
    editable: true,
  },
];

interface PlaygroundArgs {
  rowCount: number;
  statusBar: boolean;
  columnChooser: boolean | 'toolbar' | 'sidebar';
  sideBar: boolean;
  sideBarPosition: 'left' | 'right';
  sideBarDefaultPanel: string;
  rowSelection: string;
  editable: boolean;
  cellSelection: boolean;
  layoutMode: 'content' | 'fill';
  suppressHorizontalScroll: boolean;
  freezeRows: number;
  freezeCols: number;
  defaultPageSize: number;
  defaultSortBy: string;
  defaultSortDirection: 'asc' | 'desc';
  entityLabelPlural: string;
  showCustomToolbar: boolean;
  showToolbarBelow: boolean;
  pageSizeOptions: string;
}

export const Playground: StoryObj<PlaygroundArgs> = {
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 200, step: 5 } },
    statusBar: { control: 'boolean' },
    columnChooser: {
      control: 'select',
      options: [true, false, 'toolbar', 'sidebar'],
    },
    sideBar: { control: 'boolean' },
    sideBarPosition: {
      control: 'radio',
      options: ['left', 'right'],
      if: { arg: 'sideBar' },
    },
    sideBarDefaultPanel: {
      control: 'select',
      options: ['none', 'columns', 'filters'],
      if: { arg: 'sideBar' },
    },
    rowSelection: {
      control: 'select',
      options: ['none', 'single', 'multiple'],
    },
    editable: { control: 'boolean' },
    cellSelection: { control: 'boolean' },
    layoutMode: { control: 'radio', options: ['content', 'fill'] },
    suppressHorizontalScroll: { control: 'boolean' },
    freezeRows: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    freezeCols: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    defaultPageSize: { control: 'select', options: [10, 25, 50, 100] },
    defaultSortBy: {
      control: 'select',
      options: ['none', 'name', 'status', 'owner', 'budget', 'startDate', 'active'],
    },
    defaultSortDirection: { control: 'radio', options: ['asc', 'desc'] },
    entityLabelPlural: { control: 'text' },
    showCustomToolbar: { control: 'boolean' },
    showToolbarBelow: { control: 'boolean' },
    pageSizeOptions: {
      control: 'text',
      description: 'Comma-separated page size options (e.g. "10,25,50,100")',
    },
  },
  args: {
    rowCount: 50,
    statusBar: true,
    columnChooser: true,
    sideBar: false,
    sideBarPosition: 'right',
    sideBarDefaultPanel: 'none',
    rowSelection: 'multiple',
    editable: true,
    cellSelection: true,
    layoutMode: 'fill',
    suppressHorizontalScroll: false,
    freezeRows: 1,
    freezeCols: 0,
    defaultPageSize: 10,
    defaultSortBy: 'name',
    defaultSortDirection: 'asc',
    entityLabelPlural: 'projects',
    showCustomToolbar: false,
    showToolbarBelow: false,
    pageSizeOptions: '10,25,50,100',
  },
  render: function PlaygroundStory(args) {
    const [data, setData] = React.useState(() => makeProjects(args.rowCount));
    const prevRowCount = React.useRef(args.rowCount);
    React.useEffect(() => {
      if (prevRowCount.current !== args.rowCount) {
        prevRowCount.current = args.rowCount;
        setData(makeProjects(args.rowCount));
      }
    }, [args.rowCount]);

    const handleCellValueChanged = React.useCallback(
      (e: ICellValueChangedEvent<Project>) => {
        setData((prev) =>
          prev.map((row) =>
            row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row,
          ),
        );
      },
      [],
    );

    const sideBarDef: ISideBarDef | undefined = args.sideBar
      ? {
          position: args.sideBarPosition,
          defaultPanel:
            args.sideBarDefaultPanel === 'none'
              ? undefined
              : (args.sideBarDefaultPanel as 'columns' | 'filters'),
        }
      : undefined;

    const pageSizeOpts = args.pageSizeOptions
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    return (
      <OGrid<Project>
        data={data}
        columns={playgroundColumns}
        getRowId={getRowId}
        entityLabelPlural={args.entityLabelPlural}
        statusBar={args.statusBar}
        columnChooser={args.columnChooser}
        sideBar={sideBarDef}
        rowSelection={
          args.rowSelection === 'none'
            ? undefined
            : (args.rowSelection as 'single' | 'multiple')
        }
        editable={args.editable}
        cellSelection={args.cellSelection}
        onCellValueChanged={handleCellValueChanged}
        layoutMode={args.layoutMode}
        suppressHorizontalScroll={args.suppressHorizontalScroll}
        freezeRows={args.freezeRows}
        freezeCols={args.freezeCols}
        defaultPageSize={args.defaultPageSize}
        defaultSortBy={
          args.defaultSortBy === 'none' ? undefined : args.defaultSortBy
        }
        defaultSortDirection={args.defaultSortDirection}
        pageSizeOptions={pageSizeOpts.length > 0 ? pageSizeOpts : undefined}
        toolbar={
          args.showCustomToolbar ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <strong>My App</strong>
              <button
                type="button"
                style={{ padding: '2px 8px', fontSize: 12 }}
              >
                Export
              </button>
              <button
                type="button"
                style={{ padding: '2px 8px', fontSize: 12 }}
              >
                Import
              </button>
            </div>
          ) : undefined
        }
        toolbarBelow={
          args.showToolbarBelow ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                fontSize: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: 'var(--ogrid-muted, #666)', marginRight: 4 }}>Filters:</span>
              <span style={{ padding: '2px 8px', background: 'var(--ogrid-border, #e0e0e0)', borderRadius: 12 }}>
                Status: Active &times;
              </span>
              <span style={{ padding: '2px 8px', background: 'var(--ogrid-border, #e0e0e0)', borderRadius: 12 }}>
                Owner: Alice &times;
              </span>
            </div>
          ) : undefined
        }
      />
    );
  },
};
