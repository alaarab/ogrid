import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { PaginationControls } from './PaginationControls';

const meta: Meta<typeof PaginationControls> = {
  title: 'OGrid/Vue Vuetify/PaginationControls',
  component: PaginationControls,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof PaginationControls>;

export const Default: Story = {
  render: () => ({
    components: { PaginationControls },
    setup() {
      const page = ref(1);
      const pageSize = ref(25);
      const totalCount = 237;

      const handlePageChange = (newPage: number) => {
        page.value = newPage;
      };

      const handlePageSizeChange = (newSize: number) => {
        pageSize.value = newSize;
        page.value = 1;
      };

      return {
        page,
        pageSize,
        totalCount,
        handlePageChange,
        handlePageSizeChange,
      };
    },
    template: `
      <PaginationControls
        :current-page="page"
        :page-size="pageSize"
        :total-count="totalCount"
        :on-page-change="handlePageChange"
        :on-page-size-change="handlePageSizeChange"
        entity-label-plural="projects"
      />
    `,
  }),
};

export const FirstPage: Story = {
  render: () => ({
    components: { PaginationControls },
    setup() {
      const page = ref(1);
      const pageSize = ref(25);
      const totalCount = 100;

      const handlePageChange = (newPage: number) => {
        page.value = newPage;
      };

      const handlePageSizeChange = (newSize: number) => {
        pageSize.value = newSize;
        page.value = 1;
      };

      return {
        page,
        pageSize,
        totalCount,
        handlePageChange,
        handlePageSizeChange,
      };
    },
    template: `
      <PaginationControls
        :current-page="page"
        :page-size="pageSize"
        :total-count="totalCount"
        :on-page-change="handlePageChange"
        :on-page-size-change="handlePageSizeChange"
        entity-label-plural="projects"
      />
    `,
  }),
};

export const ManyPages: Story = {
  render: () => ({
    components: { PaginationControls },
    setup() {
      const page = ref(25);
      const pageSize = ref(25);
      const totalCount = 5000;

      const handlePageChange = (newPage: number) => {
        page.value = newPage;
      };

      const handlePageSizeChange = (newSize: number) => {
        pageSize.value = newSize;
        page.value = 1;
      };

      return {
        page,
        pageSize,
        totalCount,
        handlePageChange,
        handlePageSizeChange,
      };
    },
    template: `
      <PaginationControls
        :current-page="page"
        :page-size="pageSize"
        :total-count="totalCount"
        :on-page-change="handlePageChange"
        :on-page-size-change="handlePageSizeChange"
        entity-label-plural="projects"
      />
    `,
  }),
};

export const SinglePage: Story = {
  render: () => ({
    components: { PaginationControls },
    setup() {
      const page = ref(1);
      const pageSize = ref(25);
      const totalCount = 8;

      const handlePageChange = (newPage: number) => {
        page.value = newPage;
      };

      const handlePageSizeChange = (newSize: number) => {
        pageSize.value = newSize;
        page.value = 1;
      };

      return {
        page,
        pageSize,
        totalCount,
        handlePageChange,
        handlePageSizeChange,
      };
    },
    template: `
      <PaginationControls
        :current-page="page"
        :page-size="pageSize"
        :total-count="totalCount"
        :on-page-change="handlePageChange"
        :on-page-size-change="handlePageSizeChange"
        entity-label-plural="projects"
      />
    `,
  }),
};
