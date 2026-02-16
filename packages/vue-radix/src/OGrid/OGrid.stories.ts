import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import OGrid from './OGrid.vue';
import type { IOGridProps, IColumnDef, ICellValueChangedEvent, ISideBarDef } from '@alaarab/ogrid-vue';

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
  { columnId: 'budget', name: 'Budget', sortable: true, compare: (a: Project, b: Project) => a.budget - b.budget },
  { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' } },
  { columnId: 'active', name: 'Active', type: 'boolean', sortable: true },
];

const getRowId = (p: Project) => p.id;

function makeGridProps(overrides: Partial<IOGridProps<Project>> = {}): IOGridProps<Project> {
  return {
    data: makeProjects(50),
    columns,
    getRowId,
    entityLabelPlural: 'projects',
    defaultPageSize: 10,
    ...overrides,
  };
}

const meta: Meta<typeof OGrid> = {
  title: 'OGrid/Vue Radix/OGrid',
  component: OGrid,
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof OGrid>;

export const Default: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps() };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const Empty: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps({ data: [] }) };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const SmallDataSet: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps({ data: makeProjects(5) }) };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const MultiRowSelection: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return {
        gridProps: makeGridProps({
          data: makeProjects(20),
          rowSelection: 'multiple',
          statusBar: true,
        }),
      };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const WithSideBar: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return {
        gridProps: makeGridProps({
          data: makeProjects(20),
          sideBar: true,
          columnChooser: 'sidebar',
          statusBar: true,
        }),
      };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const DefaultSortDescending: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return {
        gridProps: makeGridProps({
          data: makeProjects(30),
          defaultSortBy: 'budget',
          defaultSortDirection: 'desc',
        }),
      };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const Editable: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      const data = ref(makeProjects(5));
      const handleCellValueChanged = (e: ICellValueChangedEvent<Project>) => {
        data.value = data.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const editableColumns: IColumnDef<Project>[] = [
        { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text' },
        { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' }, editable: true, cellEditor: 'select', cellEditorParams: { values: STATUSES } },
        { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' } },
        { columnId: 'budget', name: 'Budget', sortable: true, compare: (a: Project, b: Project) => a.budget - b.budget },
        { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true },
        { columnId: 'active', name: 'Active', type: 'boolean', sortable: true, editable: true },
      ];

      const gridProps = ref<IOGridProps<Project>>({
        data: data.value,
        columns: editableColumns,
        getRowId,
        entityLabelPlural: 'projects',
        editable: true,
        onCellValueChanged: handleCellValueChanged,
      });

      const updateGridProps = () => {
        gridProps.value = { ...gridProps.value, data: data.value };
      };

      return { gridProps, data, updateGridProps };
    },
    watch: {
      data: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const SpreadsheetExperience: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      const data = ref(makeProjects(20));
      const handleCellValueChanged = (e: ICellValueChangedEvent<Project>) => {
        data.value = data.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

      const editableColumns: IColumnDef<Project>[] = [
        { columnId: 'name', name: 'Project Name', sortable: true, filterable: { type: 'text' }, editable: true, cellEditor: 'text' },
        { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' }, editable: true, cellEditor: 'richSelect', cellEditorParams: { values: STATUSES } },
        { columnId: 'owner', name: 'Owner', sortable: true, filterable: { type: 'text' } },
        { columnId: 'budget', name: 'Budget', sortable: true, compare: (a: Project, b: Project) => a.budget - b.budget },
        { columnId: 'startDate', name: 'Start Date', type: 'date', sortable: true, filterable: { type: 'date' }, editable: true },
      ];

      const gridProps = ref<IOGridProps<Project>>({
        data: data.value,
        columns: editableColumns,
        getRowId,
        entityLabelPlural: 'projects',
        editable: true,
        onCellValueChanged: handleCellValueChanged,
        rowSelection: 'multiple',
        statusBar: true,
        defaultPageSize: 25,
      });

      const updateGridProps = () => {
        gridProps.value = { ...gridProps.value, data: data.value };
      };

      return { gridProps, data, updateGridProps };
    },
    watch: {
      data: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const SideBar: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return {
        gridProps: makeGridProps({
          data: makeProjects(20),
          sideBar: true,
          columnChooser: 'sidebar',
          statusBar: true,
          defaultPageSize: 10,
        }),
      };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const SideBarLeftPosition: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      const sideBarDef: ISideBarDef = {
        position: 'left',
        defaultPanel: 'filters',
      };
      return {
        gridProps: makeGridProps({
          data: makeProjects(20),
          sideBar: sideBarDef,
          columnChooser: 'sidebar',
          defaultPageSize: 10,
        }),
      };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const ToolbarWithSecondaryRow: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return {
        gridProps: makeGridProps({
          data: makeProjects(20),
          columnChooser: 'toolbar',
          pagination: true,
          defaultPageSize: 10,
        }),
      };
    },
    template: `
      <OGrid :grid-props="gridProps">
        <template #toolbar>
          <div style="display: flex; gap: 8px; align-items: center; font-size: 13px">
            <strong>Projects</strong>
            <button type="button" style="padding: 2px 8px; font-size: 12px">Export</button>
          </div>
        </template>
        <template #toolbarBelow>
          <div style="display: flex; gap: 6px; align-items: center; font-size: 12px; flex-wrap: wrap">
            <span style="color: rgba(0,0,0,0.6); margin-right: 4px">Active filters:</span>
            <span style="padding: 2px 8px; background: rgba(0,0,0,0.12); border-radius: 12px">
              Status: Active
            </span>
          </div>
        </template>
      </OGrid>
    `,
  }),
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
    compare: (a: Project, b: Project) => a.budget - b.budget,
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
  render: (args: PlaygroundArgs) => ({
    components: { OGrid },
    setup() {
      const data = ref(makeProjects(args.rowCount));
      const prevRowCount = ref(args.rowCount);

      const updateRowCount = () => {
        if (prevRowCount.value !== args.rowCount) {
          prevRowCount.value = args.rowCount;
          data.value = makeProjects(args.rowCount);
        }
      };

      const handleCellValueChanged = (e: ICellValueChangedEvent<Project>) => {
        data.value = data.value.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        );
      };

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

      const gridProps = ref<IOGridProps<Project>>({
        data: data.value,
        columns: playgroundColumns,
        getRowId,
        entityLabelPlural: args.entityLabelPlural,
        statusBar: args.statusBar,
        columnChooser: args.columnChooser,
        sideBar: sideBarDef,
        rowSelection:
          args.rowSelection === 'none'
            ? undefined
            : (args.rowSelection as 'single' | 'multiple'),
        editable: args.editable,
        cellSelection: args.cellSelection,
        onCellValueChanged: handleCellValueChanged,
        layoutMode: args.layoutMode,
        suppressHorizontalScroll: args.suppressHorizontalScroll,
        freezeRows: args.freezeRows,
        freezeCols: args.freezeCols,
        defaultPageSize: args.defaultPageSize,
        defaultSortBy: args.defaultSortBy === 'none' ? undefined : args.defaultSortBy,
        defaultSortDirection: args.defaultSortDirection,
        pageSizeOptions: pageSizeOpts.length > 0 ? pageSizeOpts : undefined,
      });

      const updateGridProps = () => {
        updateRowCount();
        gridProps.value = {
          ...gridProps.value,
          data: data.value,
          entityLabelPlural: args.entityLabelPlural,
          statusBar: args.statusBar,
          columnChooser: args.columnChooser,
          sideBar: sideBarDef,
          rowSelection:
            args.rowSelection === 'none'
              ? undefined
              : (args.rowSelection as 'single' | 'multiple'),
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
        };
      };

      return {
        gridProps,
        data,
        args,
        updateGridProps,
        showCustomToolbar: args.showCustomToolbar,
        showToolbarBelow: args.showToolbarBelow,
      };
    },
    watch: {
      args: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
      data: {
        handler() {
          this.updateGridProps();
        },
        deep: true,
      },
    },
    template: `
      <OGrid :grid-props="gridProps">
        <template v-if="showCustomToolbar" #toolbar>
          <div style="display: flex; gap: 8px; align-items: center; font-size: 13px">
            <strong>My App</strong>
            <button type="button" style="padding: 2px 8px; font-size: 12px">Export</button>
            <button type="button" style="padding: 2px 8px; font-size: 12px">Import</button>
          </div>
        </template>
        <template v-if="showToolbarBelow" #toolbarBelow>
          <div style="display: flex; gap: 6px; align-items: center; font-size: 12px; flex-wrap: wrap">
            <span style="color: rgba(0,0,0,0.6); margin-right: 4px">Filters:</span>
            <span style="padding: 2px 8px; background: rgba(0,0,0,0.12); border-radius: 12px">
              Status: Active
            </span>
            <span style="padding: 2px 8px; background: rgba(0,0,0,0.12); border-radius: 12px">
              Owner: Alice
            </span>
          </div>
        </template>
      </OGrid>
    `,
  }),
};
