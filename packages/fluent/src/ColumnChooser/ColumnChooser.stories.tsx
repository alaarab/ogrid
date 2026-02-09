import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
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
  title: 'OGrid/Fluent/ColumnChooser',
  component: ColumnChooser,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ColumnChooser>;

export const Default: Story = {
  render: () => {
    const [visible, setVisible] = React.useState(
      new Set(allColumns.map((c) => c.columnId)),
    );
    return (
      <ColumnChooser
        columns={allColumns}
        visibleColumns={visible}
        onVisibilityChange={(key, vis) =>
          setVisible((prev) => {
            const next = new Set(prev);
            vis ? next.add(key) : next.delete(key);
            return next;
          })
        }
      />
    );
  },
};

export const ManyColumns: Story = {
  render: () => {
    const cols = Array.from({ length: 20 }, (_, i) => ({
      columnId: `col-${i}`,
      name: `Column ${i + 1}`,
      required: i === 0,
    }));
    const [visible, setVisible] = React.useState(
      new Set(cols.map((c) => c.columnId)),
    );
    return (
      <ColumnChooser
        columns={cols}
        visibleColumns={visible}
        onVisibilityChange={(key, vis) =>
          setVisible((prev) => {
            const next = new Set(prev);
            vis ? next.add(key) : next.delete(key);
            return next;
          })
        }
      />
    );
  },
};

export const SomeHidden: Story = {
  render: () => {
    const [visible, setVisible] = React.useState(
      new Set(['name', 'status', 'owner']),
    );
    return (
      <ColumnChooser
        columns={allColumns}
        visibleColumns={visible}
        onVisibilityChange={(key, vis) =>
          setVisible((prev) => {
            const next = new Set(prev);
            vis ? next.add(key) : next.delete(key);
            return next;
          })
        }
      />
    );
  },
};
