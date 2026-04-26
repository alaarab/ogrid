import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';
import { useHeadlessGrid } from '@alaarab/ogrid-vue';
import type { IColumnDef } from '@alaarab/ogrid-vue';

/**
 * Stories for `useHeadlessGrid` (Vue) — the v3 headless API.
 *
 * Same hook that drives `<OGrid>` internally is exposed for consumers who
 * want their own table chrome. These stories prove it composes with plain
 * HTML, shadcn-shaped chrome, and filter UI without tying to any specific
 * design system.
 */

interface Employee {
  id: string;
  name: string;
  department: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Terminated';
}

const employees: Employee[] = [
  { id: 'e1', name: 'Alice Chen', department: 'Engineering', salary: 145000, status: 'Active' },
  { id: 'e2', name: 'Bob Smith', department: 'Sales', salary: 95000, status: 'Active' },
  { id: 'e3', name: 'Carol Diaz', department: 'Engineering', salary: 130000, status: 'On Leave' },
  { id: 'e4', name: 'Dan Lee', department: 'Marketing', salary: 88000, status: 'Active' },
  { id: 'e5', name: 'Eve Patel', department: 'Engineering', salary: 165000, status: 'Active' },
  { id: 'e6', name: 'Frank Ho', department: 'Sales', salary: 102000, status: 'Terminated' },
  { id: 'e7', name: 'Grace Yu', department: 'Marketing', salary: 91000, status: 'Active' },
  { id: 'e8', name: 'Hank Wong', department: 'Engineering', salary: 155000, status: 'Active' },
  { id: 'e9', name: 'Iris Park', department: 'Sales', salary: 87000, status: 'On Leave' },
  { id: 'e10', name: 'Jack Liu', department: 'Engineering', salary: 175000, status: 'Active' },
  { id: 'e11', name: 'Kate Wu', department: 'Marketing', salary: 95000, status: 'Active' },
  { id: 'e12', name: 'Leo Tan', department: 'Engineering', salary: 140000, status: 'Active' },
];

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', type: 'text', sortable: true, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', type: 'text', sortable: true, filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true },
  { columnId: 'status', name: 'Status', type: 'text', sortable: true, filterable: { type: 'multiSelect' } },
];

const getRowId = (e: Employee) => e.id;

const meta: Meta = {
  title: 'OGrid/Vue Radix/useHeadlessGrid',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

// Plain `<table>` rendered from the composable. Demonstrates that the
// hook is genuinely decoupled from any specific table chrome.
const PlainTableComponent = defineComponent({
  setup() {
    const grid = useHeadlessGrid({
      columns,
      data: employees,
      getRowId,
      initialSort: { field: 'salary', direction: 'desc' },
      initialPageSize: 5,
    });
    return { grid };
  },
  template: `
    <div style="font-family: system-ui, sans-serif">
      <table style="border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums">
        <thead>
          <tr>
            <th
              v-for="col in grid.columns.value"
              :key="col.columnId"
              :style="{
                cursor: col.sortable ? 'pointer' : 'default',
                textAlign: col.type === 'numeric' ? 'right' : 'left',
                padding: '8px 12px',
                borderBottom: '1px solid #ccc',
                fontWeight: 600,
                fontSize: '13px',
                userSelect: 'none',
              }"
              @click="col.sortable && grid.toggleSort(col.columnId)"
            >
              {{ col.name }} <span style="opacity: 0.6">{{ grid.sortIndicator(col.columnId).value }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in grid.rows.value"
            :key="grid.getRowId(row)"
            :style="{
              background: grid.isRowSelected(row) ? '#e0f2fe' : 'transparent',
              cursor: 'pointer',
            }"
            @click="grid.toggleRowSelection(row)"
          >
            <td
              v-for="col in grid.columns.value"
              :key="col.columnId"
              :style="{
                padding: '6px 12px',
                borderBottom: '1px solid #eee',
                textAlign: col.type === 'numeric' ? 'right' : 'left',
                fontSize: '13px',
              }"
            >
              <template v-if="col.columnId === 'salary'">
                \${{ Number(grid.getCellValue(row, col.columnId)).toLocaleString() }}
              </template>
              <template v-else>{{ grid.getCellValue(row, col.columnId) }}</template>
            </td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center; font-size: 13px">
        <button @click="grid.setPage(grid.page.value - 1)" :disabled="grid.page.value <= 1">Prev</button>
        <span>Page {{ grid.page.value }} of {{ grid.totalPages.value }} · {{ grid.totalCount.value }} rows</span>
        <button @click="grid.setPage(grid.page.value + 1)" :disabled="grid.page.value >= grid.totalPages.value">Next</button>
        <span style="margin-left: auto">
          Selected: {{ grid.selectedRowIds.value.size }}
          <button v-if="grid.selectedRowIds.value.size > 0" @click="grid.clearSelection" style="margin-left: 8px">Clear</button>
        </span>
      </div>
    </div>
  `,
});

export const PlainHtmlTable: Story = {
  name: 'Plain <table> render',
  render: () => h(PlainTableComponent),
};

// Filtered render — multiSelect filter + page reset
const FilteredComponent = defineComponent({
  setup() {
    const grid = useHeadlessGrid({
      columns,
      data: employees,
      getRowId,
      initialPageSize: 100,
    });
    const departments = ['Engineering', 'Sales', 'Marketing'];

    const isDeptActive = (d: string): boolean => {
      const f = grid.filters.value['department'];
      return f?.type === 'multiSelect' && f.value.includes(d);
    };

    const toggleDept = (d: string) => {
      const f = grid.filters.value['department'];
      const current = f?.type === 'multiSelect' ? new Set(f.value) : new Set<string>();
      if (current.has(d)) current.delete(d);
      else current.add(d);
      if (current.size === 0) grid.setFilter('department', undefined);
      else grid.setFilter('department', { type: 'multiSelect', value: [...current] });
    };

    return { grid, departments, isDeptActive, toggleDept, totalEmployees: employees.length };
  },
  template: `
    <div style="font-family: system-ui, sans-serif">
      <div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 13px; align-items: center">
        <strong>Department:</strong>
        <label v-for="d in departments" :key="d" style="display: flex; align-items: center; gap: 4px">
          <input type="checkbox" :checked="isDeptActive(d)" @change="toggleDept(d)" />
          {{ d }}
        </label>
        <button v-if="grid.hasActiveFilters.value" @click="grid.setFilters({})" style="margin-left: auto">
          Clear filters
        </button>
      </div>

      <table style="border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums">
        <thead>
          <tr>
            <th
              v-for="col in grid.columns.value"
              :key="col.columnId"
              :style="{ textAlign: col.type === 'numeric' ? 'right' : 'left', padding: '6px 10px', borderBottom: '1px solid #ccc', fontSize: '13px' }"
            >{{ col.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in grid.rows.value" :key="grid.getRowId(row)">
            <td
              v-for="col in grid.columns.value"
              :key="col.columnId"
              :style="{ padding: '4px 10px', textAlign: col.type === 'numeric' ? 'right' : 'left', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }"
            >
              <template v-if="col.columnId === 'salary'">
                \${{ Number(grid.getCellValue(row, col.columnId)).toLocaleString() }}
              </template>
              <template v-else>{{ grid.getCellValue(row, col.columnId) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top: 8px; font-size: 12px; color: #666">
        Showing {{ grid.totalCount.value }} of {{ totalEmployees }}
      </div>
    </div>
  `,
});

export const Filtered: Story = {
  name: 'With filters',
  render: () => h(FilteredComponent),
};
