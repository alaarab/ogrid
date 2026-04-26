import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useHeadlessGrid, useInlineEdit } from '../index';
import type { IColumnDef } from '@alaarab/ogrid-react';

/**
 * Stories for `useInlineEdit` — headless inline-cell-edit on top of any
 * table chrome. Demonstrates spreadsheet-style editing wired to plain HTML
 * inputs. Pairs with `useHeadlessGrid` to give shadcn-style consumers the
 * full "spreadsheet on your DataTable" experience without OGrid chrome.
 */

interface Employee {
  id: string;
  name: string;
  department: string;
  salary: number;
  active: boolean;
}

const initialEmployees: Employee[] = [
  { id: 'e1', name: 'Alice Chen', department: 'Engineering', salary: 145000, active: true },
  { id: 'e2', name: 'Bob Smith', department: 'Sales', salary: 95000, active: true },
  { id: 'e3', name: 'Carol Diaz', department: 'Engineering', salary: 130000, active: false },
  { id: 'e4', name: 'Dan Lee', department: 'Marketing', salary: 88000, active: true },
  { id: 'e5', name: 'Eve Patel', department: 'Engineering', salary: 165000, active: true },
];

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', type: 'text', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', type: 'text', sortable: true, editable: true },
  {
    columnId: 'salary',
    name: 'Salary',
    type: 'numeric',
    sortable: true,
    editable: true,
    valueParser: ({ newValue }) => {
      const n = Number(newValue);
      if (!Number.isFinite(n) || n < 0) return undefined; // reject
      return n;
    },
    valueFormatter: (v) =>
      typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? ''),
  },
  {
    columnId: 'active',
    name: 'Active',
    type: 'boolean',
    sortable: true,
    editable: false,
  },
];

const getRowId = (e: Employee) => e.id;

const meta: Meta = {
  title: 'OGrid/React Radix/useInlineEdit',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

function EditableTable() {
  const [employees, setEmployees] = React.useState(initialEmployees);

  const grid = useHeadlessGrid({
    columns,
    data: employees,
    getRowId,
    initialSort: { field: 'name', direction: 'asc' },
    initialPageSize: 10,
  });

  const edit = useInlineEdit({
    columns,
    getRowId,
    onCellEdit: ({ item, columnId, newValue }) => {
      setEmployees((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, [columnId]: newValue } : row,
        ),
      );
    },
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        Double-click any cell in <strong>Name</strong>, <strong>Department</strong>, or <strong>Salary</strong> to edit.
        Press Enter to commit, Escape to cancel. Salary rejects non-numeric input via <code>valueParser</code>.
      </p>
      <div style={{ borderRadius: 6, border: '1px solid hsl(0 0% 90%)', overflow: 'hidden', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead style={{ background: 'hsl(0 0% 96%)' }}>
            <tr>
              {grid.columns.map((col) => (
                <th
                  key={col.columnId}
                  onClick={() => col.sortable && grid.toggleSort(col.columnId)}
                  style={{
                    cursor: col.sortable ? 'pointer' : 'default',
                    textAlign: col.type === 'numeric' ? 'right' : 'left',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'hsl(0 0% 45%)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    userSelect: 'none',
                    borderBottom: '1px solid hsl(0 0% 90%)',
                  }}
                >
                  {col.name}
                  <span style={{ opacity: 0.5, marginLeft: 4 }}>
                    {grid.sortIndicator(col.columnId)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col) => {
                  const isEditingCell = edit.isEditing(row, col.columnId);
                  const value = grid.getCellValue(row, col.columnId);
                  const align = col.type === 'numeric' ? 'right' : 'left';
                  const editable = edit.canEdit(row, col.columnId);
                  return (
                    <td
                      key={col.columnId}
                      style={{
                        padding: isEditingCell ? 0 : '8px 12px',
                        textAlign: align,
                        fontSize: 13,
                        borderBottom: '1px solid hsl(0 0% 95%)',
                        cursor: editable && !isEditingCell ? 'text' : undefined,
                      }}
                      onDoubleClick={() => editable && edit.startEdit(row, col.columnId)}
                    >
                      {isEditingCell ? (
                        <input
                          autoFocus
                          {...{
                            value: String(edit.pendingValue ?? ''),
                            onChange: (e) => edit.setPendingValue(e.target.value),
                            onBlur: edit.commitEdit,
                            onKeyDown: (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                edit.commitEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                edit.cancelEdit();
                              }
                            },
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            outline: '2px solid hsl(210 100% 56%)',
                            outlineOffset: -2,
                            background: 'white',
                            font: 'inherit',
                            fontVariantNumeric: 'tabular-nums',
                            textAlign: align,
                            boxSizing: 'border-box',
                          }}
                          type={col.type === 'numeric' ? 'number' : 'text'}
                        />
                      ) : col.type === 'boolean' ? (
                        value ? '✓' : '—'
                      ) : col.columnId === 'salary' ? (
                        `$${(value as number).toLocaleString()}`
                      ) : (
                        String(value ?? '')
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const HeadlessGridPlusInlineEdit: Story = {
  name: 'useHeadlessGrid + useInlineEdit',
  render: () => <EditableTable />,
};
