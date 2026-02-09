import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OGrid } from './FluentDataTable';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';

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
    sortable: true,
    renderCell: (item) => <span>{item.startDate}</span>,
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
    <OGrid<Project>
      data={makeProjects(50)}
      columns={columns}
      getRowId={getRowId}
      entityLabelPlural="projects"
      title={<h2 style={{ margin: 0 }}>Projects</h2>}
    />
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
    ];
    return (
      <OGrid<Project>
        data={data}
        columns={editableColumns}
        getRowId={getRowId}
        entityLabelPlural="projects"
        title={<h2 style={{ margin: 0 }}>Projects (editable name &amp; status)</h2>}
        editable
        onCellValueChanged={handleCellValueChanged}
      />
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
      { columnId: 'startDate', name: 'Start Date', sortable: true, editable: true, cellEditor: 'text', minWidth: 120 },
      { columnId: 'status', name: 'Status', sortable: true, editable: true, cellEditor: 'select', cellEditorParams: { values: ['Active', 'On Leave', 'Inactive'] }, filterable: { type: 'multiSelect' }, cellStyle: (item) => ({ color: item.status === 'Active' ? '#107c10' : item.status === 'Inactive' ? '#d13438' : '#ca5010', fontWeight: 600 }) },
      { columnId: 'email', name: 'Email', sortable: true, editable: true, cellEditor: 'text', minWidth: 200 },
    ];

    return (
      <div style={{ maxWidth: 900 }}>
        <OGrid<SpreadsheetRow>
          data={data}
          columns={spreadsheetColumns}
          getRowId={(r) => r.id}
          entityLabelPlural="employees"
          title={<h2 style={{ margin: 0 }}>Employee Directory (OGrid)</h2>}
          editable
          onCellValueChanged={handleCellValueChanged}
          rowSelection="multiple"
          statusBar
          defaultPageSize={20}
        />
        <p style={{ marginTop: 8, fontSize: 13, color: '#616161' }}>
          Spreadsheet behavior: single click = select; double-click or Enter/F2 = edit; drag or Shift+click = range; right-click = context menu (Copy, Cut, Paste, Select all).
        </p>
      </div>
    );
  },
};
