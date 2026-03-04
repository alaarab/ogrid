import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { OGridComponent } from './ogrid.component';
import type { IOGridProps, IColumnDef, ISideBarDef } from '@alaarab/ogrid-angular';
import { DatePickerEditorComponent, RatingEditorComponent, ColorPickerEditorComponent, SliderEditorComponent, TagsEditorComponent } from '@alaarab/ogrid-angular-inputs';

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
  { columnId: 'budget', name: 'Budget', sortable: true, compare: (a, b) => a.budget - b.budget, valueFormatter: (v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '') },
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
          { columnId: 'budget', name: 'Budget', sortable: true, compare: (a: Project, b: Project) => a.budget - b.budget, valueFormatter: (v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '') } as IColumnDef<Project>,
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
// Cell references  (spreadsheet-style A1/B2 headers + name box)
// ---------------------------------------------------------------------------

export const CellReferences: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        editable: true,
        cellReferences: true,
        statusBar: true,
        defaultPageSize: 10,
        columns: [
          { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text' } as IColumnDef<Project>,
          { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' }, editable: true, cellEditor: 'select', cellEditorParams: { values: STATUSES } } as IColumnDef<Project>,
          { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' } } as IColumnDef<Project>,
          { columnId: 'budget', name: 'Budget', sortable: true, compare: (a: Project, b: Project) => a.budget - b.budget, valueFormatter: (v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '') } as IColumnDef<Project>,
          { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true } as IColumnDef<Project>,
          { columnId: 'active', name: 'Active', type: 'boolean', sortable: true, editable: true } as IColumnDef<Project>,
        ],
      }),
    },
  }),
};

// ---------------------------------------------------------------------------
// Performance demos  -  virtual scrolling, worker sort, column virtualization
// ---------------------------------------------------------------------------

export const VirtualScrolling10K: Story = {
  render: () => ({
    template: `<div style="height:600px"><ogrid [props]="gridProps" /></div>`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(10000),
        statusBar: true,
        pagination: false,
        layoutMode: 'fill',
        virtualScroll: { columns: false },
      }),
    },
  }),
};

export const WorkerSort50K: Story = {
  render: () => ({
    template: `<div style="height:600px"><ogrid [props]="gridProps" /></div>`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(50000),
        statusBar: true,
        pagination: false,
        layoutMode: 'fill',
        workerSort: true,
      }),
    },
  }),
};

const manyColumns: IColumnDef<Project>[] = Array.from({ length: 50 }, (_, i) => ({
  columnId: `col_${i}`,
  name: `Column ${i + 1}`,
  defaultWidth: 120,
  valueGetter: (item: Project) => {
    const vals = [item.name, item.status, item.owner, String(item.budget), item.startDate, String(item.active)];
    return vals[i % vals.length];
  },
} as IColumnDef<Project>));

export const ColumnVirtualization50Cols: Story = {
  render: () => ({
    template: `<div style="height:600px"><ogrid [props]="gridProps" /></div>`,
    props: {
      gridProps: {
        data: makeProjects(1000),
        columns: manyColumns,
        getRowId,
        entityLabelPlural: 'projects',
        statusBar: true,
        pagination: false,
        layoutMode: 'fill',
        virtualScroll: { columns: true, columnOverscan: 3 },
      } as IOGridProps<Project>,
    },
  }),
};

export const ToolbarWithSecondaryRow: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({
        data: makeProjects(20),
        columnChooser: 'toolbar',
        pagination: true,
        defaultPageSize: 10,
      }),
    },
  }),
};

// ---------------------------------------------------------------------------
// Formula engine
// ---------------------------------------------------------------------------

interface FormulaRow {
  id: string;
  a: number;
  b: number;
  c: number;
}

const formulaColumns: IColumnDef<FormulaRow>[] = [
  { columnId: 'a', name: 'A', type: 'numeric', editable: true } as IColumnDef<FormulaRow>,
  { columnId: 'b', name: 'B', type: 'numeric', editable: true } as IColumnDef<FormulaRow>,
  { columnId: 'c', name: 'C', type: 'numeric', editable: true } as IColumnDef<FormulaRow>,
];

const formulaData: FormulaRow[] = [
  { id: 'r1', a: 10, b: 20, c: 0 },
  { id: 'r2', a: 30, b: 40, c: 0 },
  { id: 'r3', a: 50, b: 60, c: 0 },
  { id: 'r4', a: 0, b: 0, c: 0 },
];

export const Formulas: StoryObj<OGridComponent<FormulaRow>> = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: {
        data: formulaData,
        columns: formulaColumns,
        getRowId: (r: FormulaRow) => r.id,
        editable: true,
        formulas: true,
        cellReferences: true,
        pagination: false,
        statusBar: true,
        initialFormulas: [
          { col: 2, row: 0, formula: '=A1+B1' },
          { col: 2, row: 1, formula: '=A2+B2' },
          { col: 2, row: 2, formula: '=A3+B3' },
          { col: 0, row: 3, formula: '=SUM(A1:A3)' },
          { col: 1, row: 3, formula: '=SUM(B1:B3)' },
          { col: 2, row: 3, formula: '=SUM(C1:C3)' },
        ],
      },
    },
  }),
};

// ---------------------------------------------------------------------------
// Premium inputs  (DatePicker, Rating, ColorPicker, Slider, Tags)
// ---------------------------------------------------------------------------

interface InputsRow {
  id: string;
  name: string;
  dueDate: string;
  rating: number;
  color: string;
  progress: number;
  tags: string[];
}

const inputsData: InputsRow[] = [
  { id: '1', name: 'Alpha', dueDate: '2024-06-01', rating: 4, color: '#4f46e5', progress: 75, tags: ['frontend', 'urgent'] },
  { id: '2', name: 'Beta', dueDate: '2024-09-15', rating: 3, color: '#10b981', progress: 40, tags: ['backend'] },
  { id: '3', name: 'Gamma', dueDate: '2024-12-31', rating: 5, color: '#f59e0b', progress: 90, tags: ['design', 'review'] },
];

const inputsColumns: IColumnDef<InputsRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text' } as IColumnDef<InputsRow>,
  { columnId: 'dueDate', name: 'Due Date', type: 'date', sortable: true, editable: true, cellEditor: DatePickerEditorComponent, cellEditorPopup: true } as unknown as IColumnDef<InputsRow>,
  { columnId: 'rating', name: 'Rating', type: 'numeric', sortable: true, editable: true, cellEditor: RatingEditorComponent, cellEditorPopup: true } as unknown as IColumnDef<InputsRow>,
  { columnId: 'color', name: 'Color', sortable: false, editable: true, cellEditor: ColorPickerEditorComponent, cellEditorPopup: true } as unknown as IColumnDef<InputsRow>,
  { columnId: 'progress', name: 'Progress', type: 'numeric', sortable: true, editable: true, cellEditor: SliderEditorComponent, cellEditorPopup: true } as unknown as IColumnDef<InputsRow>,
  { columnId: 'tags', name: 'Tags', sortable: false, editable: true, cellEditor: TagsEditorComponent, cellEditorPopup: true } as unknown as IColumnDef<InputsRow>,
];

export const PremiumInputs: StoryObj<OGridComponent<InputsRow>> = {
  decorators: [
    moduleMetadata({
      imports: [OGridComponent, DatePickerEditorComponent, RatingEditorComponent, ColorPickerEditorComponent, SliderEditorComponent, TagsEditorComponent],
    }),
  ],
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: {
        data: inputsData,
        columns: inputsColumns,
        getRowId: (r: InputsRow) => r.id,
        editable: true,
        entityLabelPlural: 'items',
        defaultPageSize: 10,
      },
    },
  }),
};

// ---------------------------------------------------------------------------
// Playground  -  fully interactive with Storybook controls
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
  cellReferences: boolean;
  showRowNumbers: boolean;
  layoutMode: 'content' | 'fill';
  suppressHorizontalScroll: boolean;
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
    cellReferences: args.cellReferences,
    showRowNumbers: args.showRowNumbers,
    layoutMode: args.layoutMode,
    suppressHorizontalScroll: args.suppressHorizontalScroll,
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
    cellReferences: { control: 'boolean' },
    showRowNumbers: { control: 'boolean' },
    layoutMode: { control: 'radio', options: ['content', 'fill'] },
    suppressHorizontalScroll: { control: 'boolean' },
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
    cellReferences: false,
    showRowNumbers: false,
    layoutMode: 'fill',
    suppressHorizontalScroll: false,
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
