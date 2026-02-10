import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OGrid } from './OGrid';
import type { IColumnDef, ICellValueChangedEvent, ISideBarDef } from '@alaarab/ogrid-core';

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
    defaultPageSize: 10,
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
      { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true },
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
        defaultPageSize={25}
      />
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
    defaultPageSize: { control: 'select', options: [5, 10, 20, 50, 100] },
    defaultSortBy: {
      control: 'select',
      options: ['none', 'name', 'status', 'owner', 'budget', 'startDate', 'active'],
    },
    defaultSortDirection: { control: 'radio', options: ['asc', 'desc'] },
    entityLabelPlural: { control: 'text' },
    showCustomToolbar: { control: 'boolean' },
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
    pageSizeOptions: '10,20,50,100',
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
      />
    );
  },
};
