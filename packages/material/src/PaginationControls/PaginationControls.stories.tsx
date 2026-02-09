import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PaginationControls } from './PaginationControls';

const meta: Meta<typeof PaginationControls> = {
  title: 'OGrid/Material/PaginationControls',
  component: PaginationControls,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof PaginationControls>;

function PaginationDemo(props: { totalCount: number; initialPage?: number; initialPageSize?: number }) {
  const [page, setPage] = React.useState(props.initialPage ?? 1);
  const [pageSize, setPageSize] = React.useState(props.initialPageSize ?? 20);
  return (
    <PaginationControls
      currentPage={page}
      pageSize={pageSize}
      totalCount={props.totalCount}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
      entityLabelPlural="projects"
    />
  );
}

export const Default: Story = {
  render: () => <PaginationDemo totalCount={237} />,
};

export const FirstPage: Story = {
  render: () => <PaginationDemo totalCount={100} initialPage={1} />,
};

export const ManyPages: Story = {
  render: () => <PaginationDemo totalCount={5000} initialPage={25} />,
};

export const SinglePage: Story = {
  render: () => <PaginationDemo totalCount={8} initialPageSize={20} />,
};
