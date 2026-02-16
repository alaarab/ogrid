import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { OGridComponent } from './ogrid.component';
import type { IOGridProps, IColumnDef, ISideBarDef } from '@alaarab/ogrid-angular';

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
  { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' } },
  { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' } },
  { columnId: 'budget', name: 'Budget', sortable: true, compare: (a, b) => a.budget - b.budget },
  { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' } },
  { columnId: 'active', name: 'Active', type: 'boolean', sortable: true },
];

const getRowId = (p: Project) => p.id;

function makeGridProps(overrides: Record<string, unknown> = {}): IOGridProps<Project> {
  return {
    data: makeProjects(50),
    columns,
    getRowId,
    entityLabelPlural: 'projects',
    defaultPageSize: 10,
    ...overrides,
  } as IOGridProps<Project>;
}

const meta: Meta<OGridComponent<Project>> = {
  title: 'OGrid/Angular Radix/OGrid',
  component: OGridComponent,
  decorators: [
    moduleMetadata({
      imports: [OGridComponent],
    }),
  ],
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<OGridComponent<Project>>;

export const Default: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps(),
    },
  }),
};

export const Empty: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({ data: [] }),
    },
  }),
};

export const SmallDataSet: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({ data: makeProjects(5) }),
    },
  }),
};

export const MultiRowSelection: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        rowSelection: 'multiple',
        statusBar: true,
      }),
    },
  }),
};

export const WithSideBar: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        sideBar: true,
        columnChooser: 'sidebar',
        statusBar: true,
      }),
    },
  }),
};

export const DefaultSortDescending: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(30),
        defaultSortBy: 'budget',
        defaultSortDirection: 'desc',
      }),
    },
  }),
};

export const Editable: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(5),
        editable: true,
        columns: [
          { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text' } as IColumnDef<Project>,
          { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' }, editable: true, cellEditor: 'select', cellEditorParams: { values: STATUSES } } as IColumnDef<Project>,
          { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' } } as IColumnDef<Project>,
          { columnId: 'budget', name: 'Budget', sortable: true, compare: (a: Project, b: Project) => a.budget - b.budget } as IColumnDef<Project>,
          { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true } as IColumnDef<Project>,
          { columnId: 'active', name: 'Active', type: 'boolean', sortable: true, editable: true } as IColumnDef<Project>,
        ],
      }),
    },
  }),
};

export const SpreadsheetExperience: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        rowSelection: 'multiple',
        statusBar: true,
        editable: true,
        columns: columns.map((c) => ({
          ...c,
          editable: c.columnId !== 'active',
          cellEditor: c.columnId === 'status' ? 'select' as const : 'text' as const,
          ...(c.columnId === 'status' ? { cellEditorParams: { values: STATUSES } } : {}),
        })),
        defaultPageSize: 25,
      }),
    },
  }),
};

export const SideBar: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        sideBar: true,
        columnChooser: 'sidebar',
        statusBar: true,
        defaultPageSize: 10,
      }),
    },
  }),
};

export const SideBarLeftPosition: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        sideBar: { position: 'left', defaultPanel: 'filters' } as ISideBarDef,
        columnChooser: 'sidebar',
        defaultPageSize: 10,
      }),
    },
  }),
};

// ---------------------------------------------------------------------------
// Playground — fully interactive with Storybook controls
// ---------------------------------------------------------------------------

const playgroundColumns: IColumnDef<Project>[] = [
  { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text', pinned: 'left', minWidth: 150 },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' }, editable: true, cellEditor: 'select', cellEditorParams: { values: STATUSES } },
  { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text' },
  { columnId: 'budget', name: 'Budget', type: 'numeric', sortable: true, editable: true, cellEditor: 'text', compare: (a: Project, b: Project) => a.budget - b.budget, valueFormatter: (v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '') },
  { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true },
  { columnId: 'active', name: 'Active', type: 'boolean', sortable: true, editable: true },
] as IColumnDef<Project>[];

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
  pageSizeOptions: string;
}

function buildPlaygroundProps(args: PlaygroundArgs): IOGridProps<Project> {
  const pageSizeOpts = args.pageSizeOptions
    .split(',')
    .map((s: string) => parseInt(s.trim(), 10))
    .filter((n: number) => !isNaN(n));

  const sideBarDef: ISideBarDef | undefined = args.sideBar
    ? {
        position: args.sideBarPosition,
        defaultPanel: args.sideBarDefaultPanel === 'none' ? undefined : (args.sideBarDefaultPanel as 'columns' | 'filters'),
      }
    : undefined;

  return {
    data: makeProjects(args.rowCount),
    columns: playgroundColumns,
    getRowId,
    entityLabelPlural: args.entityLabelPlural,
    statusBar: args.statusBar,
    columnChooser: args.columnChooser,
    sideBar: sideBarDef,
    rowSelection: args.rowSelection === 'none' ? undefined : (args.rowSelection as 'single' | 'multiple'),
    editable: args.editable,
    cellSelection: args.cellSelection,
    layoutMode: args.layoutMode,
    suppressHorizontalScroll: args.suppressHorizontalScroll,
    freezeRows: args.freezeRows,
    freezeCols: args.freezeCols,
    defaultPageSize: args.defaultPageSize,
    defaultSortBy: args.defaultSortBy === 'none' ? undefined : args.defaultSortBy,
    defaultSortDirection: args.defaultSortDirection,
    pageSizeOptions: pageSizeOpts.length > 0 ? pageSizeOpts : undefined,
  } as IOGridProps<Project>;
}

export const Playground: StoryObj<PlaygroundArgs> = {
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 200, step: 5 } },
    statusBar: { control: 'boolean' },
    columnChooser: { control: 'select', options: [true, false, 'toolbar', 'sidebar'] },
    sideBar: { control: 'boolean' },
    sideBarPosition: { control: 'radio', options: ['left', 'right'], if: { arg: 'sideBar' } },
    sideBarDefaultPanel: { control: 'select', options: ['none', 'columns', 'filters'], if: { arg: 'sideBar' } },
    rowSelection: { control: 'select', options: ['none', 'single', 'multiple'] },
    editable: { control: 'boolean' },
    cellSelection: { control: 'boolean' },
    layoutMode: { control: 'radio', options: ['content', 'fill'] },
    suppressHorizontalScroll: { control: 'boolean' },
    freezeRows: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    freezeCols: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    defaultPageSize: { control: 'select', options: [10, 25, 50, 100] },
    defaultSortBy: { control: 'select', options: ['none', 'name', 'status', 'owner', 'budget', 'startDate', 'active'] },
    defaultSortDirection: { control: 'radio', options: ['asc', 'desc'] },
    entityLabelPlural: { control: 'text' },
    pageSizeOptions: { control: 'text', description: 'Comma-separated page size options' },
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
    pageSizeOptions: '10,25,50,100',
  },
  render: (args: PlaygroundArgs) => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: buildPlaygroundProps(args),
    },
  }),
};
