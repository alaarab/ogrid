import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OGrid } from './OGrid';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-core';

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

const meta: Meta<typeof OGrid<Project>> = {
  title: 'OGrid/Radix/OGrid',
  component: OGrid as React.ComponentType,
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof OGrid<Project>>;

export const Default: Story = {
  args: {
    columns,
    getRowId,
    data: makeProjects(50),
    entityLabelPlural: 'projects',
    statusBar: true,
  },
};

export const Empty: Story = {
  args: {
    columns,
    getRowId,
    data: [],
    entityLabelPlural: 'projects',
  },
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

export const MultiRowSelection: Story = {
  args: {
    columns,
    getRowId,
    data: makeProjects(20),
    entityLabelPlural: 'projects',
    rowSelection: 'multiple',
    statusBar: true,
  },
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

export const SpreadsheetExperience: Story = {
  render: function SpreadsheetExperienceStory() {
    const [data, setData] = React.useState(() => makeProjects(20));
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<Project>) => {
      setData((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);
    const editableColumns: IColumnDef<Project>[] = [
      { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text', renderCell: (item) => <span>{item.name}</span> },
      { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' }, editable: true, cellEditor: 'select', cellEditorParams: { values: STATUSES }, renderCell: (item) => <span>{item.status}</span> },
      { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' }, renderCell: (item) => <span>{item.owner}</span> },
      { columnId: 'budget', name: 'Budget', sortable: true, compare: (a, b) => a.budget - b.budget, renderCell: (item) => <span>${item.budget.toLocaleString()}</span> },
      { columnId: 'startDate', name: 'Start Date', sortable: true, renderCell: (item) => <span>{item.startDate}</span> },
    ];
    return (
      <OGrid<Project>
        data={data}
        columns={editableColumns}
        getRowId={getRowId}
        entityLabelPlural="projects"
        title={<h2 style={{ margin: 0 }}>Projects (Spreadsheet)</h2>}
        editable
        onCellValueChanged={handleCellValueChanged}
        rowSelection="multiple"
        statusBar
        defaultPageSize={20}
      />
    );
  },
};
