import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { OGridComponent } from './ogrid.component';
import type { IOGridProps, IColumnDef } from '@alaarab/ogrid-angular';

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

const meta: Meta<OGridComponent<Project>> = {
  title: 'OGrid/Angular Material/OGrid',
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
