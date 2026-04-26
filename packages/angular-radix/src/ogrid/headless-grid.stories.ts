import { Component } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { createHeadlessGrid } from '@alaarab/ogrid-angular';
import type { IColumnDef } from '@alaarab/ogrid-angular';

/**
 * Stories for `createHeadlessGrid` (Angular) — the v3 headless API.
 *
 * Same logic that drives `<OGridComponent>` is exposed as a signal-based
 * factory for consumers who want their own table chrome. These stories
 * prove the factory works inside a standalone component with plain
 * <table> markup, no chrome dependencies.
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

@Component({
  selector: 'headless-plain-table',
  standalone: true,
  template: `
    <div style="font-family: system-ui, sans-serif">
      <table style="border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums">
        <thead>
          <tr>
            @for (col of grid.columns(); track col.columnId) {
              <th
                [style.cursor]="col.sortable ? 'pointer' : 'default'"
                [style.text-align]="col.type === 'numeric' ? 'right' : 'left'"
                [style.padding]="'8px 12px'"
                [style.border-bottom]="'1px solid #ccc'"
                [style.font-weight]="600"
                [style.font-size]="'13px'"
                [style.user-select]="'none'"
                (click)="col.sortable && grid.toggleSort(col.columnId)"
              >
                {{ col.name }}
                <span style="opacity: 0.6">{{ grid.sortIndicator(col.columnId)() }}</span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of grid.rows(); track grid.getRowId(row)) {
            <tr
              [style.background]="grid.isRowSelected(row) ? '#e0f2fe' : 'transparent'"
              [style.cursor]="'pointer'"
              (click)="grid.toggleRowSelection(row)"
            >
              @for (col of grid.columns(); track col.columnId) {
                <td
                  [style.padding]="'6px 12px'"
                  [style.border-bottom]="'1px solid #eee'"
                  [style.text-align]="col.type === 'numeric' ? 'right' : 'left'"
                  [style.font-size]="'13px'"
                >
                  @if (col.columnId === 'salary') {
                    \${{ formatNumber(grid.getCellValue(row, col.columnId)) }}
                  } @else {
                    {{ grid.getCellValue(row, col.columnId) }}
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>

      <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center; font-size: 13px">
        <button (click)="grid.setPage(grid.page() - 1)" [disabled]="grid.page() <= 1">Prev</button>
        <span>Page {{ grid.page() }} of {{ grid.totalPages() }} · {{ grid.totalCount() }} rows</span>
        <button (click)="grid.setPage(grid.page() + 1)" [disabled]="grid.page() >= grid.totalPages()">Next</button>
        <span style="margin-left: auto">
          Selected: {{ grid.selectedRowIds().size }}
          @if (grid.selectedRowIds().size > 0) {
            <button (click)="grid.clearSelection()" style="margin-left: 8px">Clear</button>
          }
        </span>
      </div>
    </div>
  `,
})
class HeadlessPlainTableComponent {
  grid = createHeadlessGrid({
    columns,
    data: employees,
    getRowId,
    initialSort: { field: 'salary', direction: 'desc' },
    initialPageSize: 5,
  });

  formatNumber(v: unknown): string {
    return typeof v === 'number' ? v.toLocaleString() : String(v ?? '');
  }
}

const meta: Meta = {
  title: 'OGrid/Angular Radix/createHeadlessGrid',
  decorators: [
    moduleMetadata({
      imports: [HeadlessPlainTableComponent],
    }),
  ],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const PlainHtmlTable: Story = {
  name: 'Plain <table> render',
  render: () => ({
    template: `<headless-plain-table />`,
  }),
};
