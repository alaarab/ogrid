import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useHeadlessGrid } from '../index';
import type { IColumnDef } from '@alaarab/ogrid-react';

/**
 * Stories for `useHeadlessGrid` — the headless API for OGrid.
 *
 * The hook returns sort/filter/paginate state and rows, but renders nothing.
 * These stories demonstrate that the same hook can drive plain HTML tables,
 * shadcn-style chrome, or any other render layer the consumer brings.
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
  title: 'OGrid/React Radix/useHeadlessGrid',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

// ─────────────────────────────────────────────────────────────────────
// Minimal: plain `<table>` rendered from the hook. Proves the hook is
// genuinely decoupled from any specific table chrome.
// ─────────────────────────────────────────────────────────────────────

function MinimalTable() {
  const grid = useHeadlessGrid({
    columns,
    data: employees,
    getRowId,
    initialSort: { field: 'salary', direction: 'desc' },
    initialPageSize: 5,
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            {grid.columns.map((col) => (
              <th
                key={col.columnId}
                onClick={() => col.sortable && grid.toggleSort(col.columnId)}
                style={{
                  cursor: col.sortable ? 'pointer' : 'default',
                  textAlign: col.type === 'numeric' ? 'right' : 'left',
                  padding: '8px 12px',
                  borderBottom: '1px solid #ccc',
                  fontWeight: 600,
                  fontSize: 13,
                  userSelect: 'none',
                }}
              >
                {col.name} <span style={{ opacity: 0.6 }}>{grid.sortIndicator(col.columnId)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr
              key={grid.getRowId(row)}
              onClick={() => grid.toggleRowSelection(row)}
              style={{
                background: grid.isRowSelected(row) ? '#e0f2fe' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {grid.columns.map((col) => {
                const value = grid.getCellValue(row, col.columnId);
                return (
                  <td
                    key={col.columnId}
                    style={{
                      padding: '6px 12px',
                      borderBottom: '1px solid #eee',
                      textAlign: col.type === 'numeric' ? 'right' : 'left',
                      fontSize: 13,
                    }}
                  >
                    {col.columnId === 'salary'
                      ? `$${(value as number).toLocaleString()}`
                      : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
        <button onClick={() => grid.setPage(grid.page - 1)} disabled={grid.page <= 1}>
          Prev
        </button>
        <span>
          Page {grid.page} of {grid.totalPages} · {grid.totalCount} rows
        </span>
        <button onClick={() => grid.setPage(grid.page + 1)} disabled={grid.page >= grid.totalPages}>
          Next
        </button>
        <span style={{ marginLeft: 'auto' }}>
          Selected: {grid.selectedRowIds.size}
          {grid.selectedRowIds.size > 0 && (
            <button onClick={grid.clearSelection} style={{ marginLeft: 8 }}>
              Clear
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export const PlainHtmlTable: Story = {
  name: 'Plain <table> render',
  render: () => <MinimalTable />,
};

// ─────────────────────────────────────────────────────────────────────
// Shadcn-style: same hook, rendered with the kind of primitives
// shadcn/ui ships. Demonstrates how Arc would consume the hook against
// its existing `<Table>` / `<TableRow>` / `<TableCell>` components.
// We inline minimal shadcn-shaped wrappers here so the story is
// self-contained and doesn't pull in shadcn as a dependency.
// ─────────────────────────────────────────────────────────────────────

const Table = ({ children }: { children: React.ReactNode }) => (
  <div style={{ borderRadius: 6, border: '1px solid hsl(0 0% 90%)', overflow: 'hidden', background: 'white' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </table>
  </div>
);
const TableHeader = ({ children }: { children: React.ReactNode }) => <thead style={{ background: 'hsl(0 0% 96%)' }}>{children}</thead>;
const TableBody = ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>;
const TableRow = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props}>{children}</tr>
);
const TableHead = ({ children, align, onClick }: { children: React.ReactNode; align?: 'left' | 'right'; onClick?: () => void }) => (
  <th
    onClick={onClick}
    style={{
      textAlign: align ?? 'left',
      padding: '8px 12px',
      fontWeight: 500,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: 'hsl(0 0% 45%)',
      cursor: onClick ? 'pointer' : 'default',
      userSelect: 'none',
      borderBottom: '1px solid hsl(0 0% 90%)',
    }}
  >
    {children}
  </th>
);
const TableCell = ({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) => (
  <td style={{ padding: '8px 12px', textAlign: align ?? 'left', fontSize: 13, borderBottom: '1px solid hsl(0 0% 95%)' }}>{children}</td>
);

function ShadcnStyleTable() {
  const grid = useHeadlessGrid({
    columns,
    data: employees,
    getRowId,
    initialSort: { field: 'salary', direction: 'desc' },
    initialPageSize: 5,
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <Table>
        <TableHeader>
          <TableRow>
            {grid.columns.map((col) => (
              <TableHead
                key={col.columnId}
                align={col.type === 'numeric' ? 'right' : 'left'}
                onClick={col.sortable ? () => grid.toggleSort(col.columnId) : undefined}
              >
                {col.name} <span style={{ opacity: 0.5 }}>{grid.sortIndicator(col.columnId)}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grid.rows.map((row) => (
            <TableRow
              key={grid.getRowId(row)}
              onClick={() => grid.toggleRowSelection(row)}
              style={{ background: grid.isRowSelected(row) ? 'hsl(210 100% 95%)' : undefined, cursor: 'pointer' }}
            >
              {grid.columns.map((col) => {
                const value = grid.getCellValue(row, col.columnId);
                return (
                  <TableCell key={col.columnId} align={col.type === 'numeric' ? 'right' : 'left'}>
                    {col.columnId === 'salary'
                      ? `$${(value as number).toLocaleString()}`
                      : String(value)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'hsl(0 0% 45%)' }}>
        <button onClick={() => grid.setPage(grid.page - 1)} disabled={grid.page <= 1}>Prev</button>
        <span>Page {grid.page} of {grid.totalPages} · {grid.totalCount} rows</span>
        <button onClick={() => grid.setPage(grid.page + 1)} disabled={grid.page >= grid.totalPages}>Next</button>
      </div>
    </div>
  );
}

export const ShadcnStyleRender: Story = {
  name: 'Shadcn-style chrome',
  render: () => <ShadcnStyleTable />,
};

// ─────────────────────────────────────────────────────────────────────
// Filtered: shows multiSelect + text filter integration. The hook
// returns `setFilter` and `hasActiveFilters` — chrome integration is
// left to the consumer.
// ─────────────────────────────────────────────────────────────────────

function FilteredTable() {
  const grid = useHeadlessGrid({
    columns,
    data: employees,
    getRowId,
    initialPageSize: 100,
  });

  const departments = ['Engineering', 'Sales', 'Marketing'] as const;

  const activeDepts = (() => {
    const f = grid.filters.department;
    if (f?.type === 'multiSelect') return new Set(f.value);
    return new Set<string>();
  })();

  const toggleDept = (d: string) => {
    const next = new Set(activeDepts);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    if (next.size === 0) grid.setFilter('department', undefined);
    else grid.setFilter('department', { type: 'multiSelect', value: [...next] });
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 13, alignItems: 'center' }}>
        <strong>Department:</strong>
        {departments.map((d) => (
          <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={activeDepts.has(d)} onChange={() => toggleDept(d)} />
            {d}
          </label>
        ))}
        {grid.hasActiveFilters && (
          <button onClick={() => grid.setFilters({})} style={{ marginLeft: 'auto' }}>
            Clear filters
          </button>
        )}
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            {grid.columns.map((col) => (
              <th
                key={col.columnId}
                style={{ textAlign: col.type === 'numeric' ? 'right' : 'left', padding: '6px 10px', borderBottom: '1px solid #ccc', fontSize: 13 }}
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={grid.getRowId(row)}>
              {grid.columns.map((col) => {
                const value = grid.getCellValue(row, col.columnId);
                return (
                  <td
                    key={col.columnId}
                    style={{ padding: '4px 10px', textAlign: col.type === 'numeric' ? 'right' : 'left', fontSize: 13, borderBottom: '1px solid #f0f0f0' }}
                  >
                    {col.columnId === 'salary' ? `$${(value as number).toLocaleString()}` : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        Showing {grid.totalCount} of {employees.length}
      </div>
    </div>
  );
}

export const Filtered: Story = {
  name: 'With filters',
  render: () => <FilteredTable />,
};
