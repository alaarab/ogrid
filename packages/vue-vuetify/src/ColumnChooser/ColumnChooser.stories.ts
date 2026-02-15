import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { ColumnChooser } from './ColumnChooser';

const allColumns = [
  { columnId: 'name', name: 'Name', required: true },
  { columnId: 'status', name: 'Status' },
  { columnId: 'owner', name: 'Owner' },
  { columnId: 'budget', name: 'Budget' },
  { columnId: 'startDate', name: 'Start Date' },
  { columnId: 'endDate', name: 'End Date' },
  { columnId: 'priority', name: 'Priority' },
  { columnId: 'department', name: 'Department' },
];

const meta: Meta<typeof ColumnChooser> = {
  title: 'OGrid/Vue Vuetify/ColumnChooser',
  component: ColumnChooser,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ColumnChooser>;

export const Default: Story = {
  render: () => ({
    components: { ColumnChooser },
    setup() {
      const visible = ref(new Set(allColumns.map((c) => c.columnId)));
      const handleVisibilityChange = (key: string, vis: boolean) => {
        const next = new Set(visible.value);
        vis ? next.add(key) : next.delete(key);
        visible.value = next;
      };
      return { allColumns, visible, handleVisibilityChange };
    },
    template: `
      <ColumnChooser
        :columns="allColumns"
        :visible-columns="visible"
        :on-visibility-change="handleVisibilityChange"
      />
    `,
  }),
};

export const ManyColumns: Story = {
  render: () => ({
    components: { ColumnChooser },
    setup() {
      const cols = Array.from({ length: 20 }, (_, i) => ({
        columnId: `col-${i}`,
        name: `Column ${i + 1}`,
        required: i === 0,
      }));
      const visible = ref(new Set(cols.map((c) => c.columnId)));
      const handleVisibilityChange = (key: string, vis: boolean) => {
        const next = new Set(visible.value);
        vis ? next.add(key) : next.delete(key);
        visible.value = next;
      };
      return { cols, visible, handleVisibilityChange };
    },
    template: `
      <ColumnChooser
        :columns="cols"
        :visible-columns="visible"
        :on-visibility-change="handleVisibilityChange"
      />
    `,
  }),
};

export const SomeHidden: Story = {
  render: () => ({
    components: { ColumnChooser },
    setup() {
      const visible = ref(new Set(['name', 'status', 'owner']));
      const handleVisibilityChange = (key: string, vis: boolean) => {
        const next = new Set(visible.value);
        vis ? next.add(key) : next.delete(key);
        visible.value = next;
      };
      return { allColumns, visible, handleVisibilityChange };
    },
    template: `
      <ColumnChooser
        :columns="allColumns"
        :visible-columns="visible"
        :on-visibility-change="handleVisibilityChange"
      />
    `,
  }),
};
