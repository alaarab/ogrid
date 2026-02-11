import * as React from 'react';
import type { IColumnDef, ICellEditorProps } from '../types';

// ─────────────────────────────────────────────────
// Basic row data
// ─────────────────────────────────────────────────

export interface StoryRow {
  id: string;
  name: string;
  status: string;
  owner: string;
  approved?: boolean;
}

export const storyRows: StoryRow[] = [
  { id: '1', name: 'Alpha', status: 'Active', owner: 'alice@test.com' },
  { id: '2', name: 'Beta', status: 'Closed', owner: 'bob@test.com' },
  { id: '3', name: 'Gamma', status: 'Active', owner: 'carol@test.com' },
  { id: '4', name: 'Delta', status: 'Planning', owner: 'dave@test.com' },
];

export const storyGetRowId = (r: StoryRow): string => r.id;

export const noop = (): void => {};

// ─────────────────────────────────────────────────
// Editable row data
// ─────────────────────────────────────────────────

export interface EditableRow {
  id: string;
  name: string;
  status: string;
  approved: boolean;
}

export const editableInitialRows: EditableRow[] = [
  { id: '1', name: 'Alpha', status: 'Active', approved: false },
  { id: '2', name: 'Beta', status: 'Closed', approved: true },
  { id: '3', name: 'Gamma', status: 'Planning', approved: false },
];

export const editableColumns: IColumnDef<EditableRow>[] = [
  {
    columnId: 'name',
    name: 'Name',
    editable: true,
    cellEditor: 'text',
  },
  {
    columnId: 'status',
    name: 'Status',
    editable: true,
    cellEditor: 'select',
    cellEditorParams: { values: ['Active', 'Closed', 'Planning'] },
  },
  {
    columnId: 'approved',
    name: 'Approved',
    editable: true,
    cellEditor: 'checkbox',
    valueFormatter: (v) => (v === true ? 'Yes' : 'No'),
  },
];

// ─────────────────────────────────────────────────
// Popup editor component
// ─────────────────────────────────────────────────

export interface RowWithNotes extends EditableRow {
  notes?: string;
}

export function NotesPopupEditor<T>({ value, onValueChange, onCommit, onCancel }: ICellEditorProps<T>): React.ReactElement {
  const [local, setLocal] = React.useState(String(value ?? ''));
  return (
    <div style={{ padding: 8, minWidth: 200 }}>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          onValueChange(local);
          onCommit();
        }}
        rows={3}
        style={{ width: '100%', marginBottom: 8 }}
        data-testid="notes-editor"
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { onValueChange(local); onCommit(); }}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Spreadsheet row data
// ─────────────────────────────────────────────────

export interface SpreadsheetRow {
  id: string;
  name: string;
  department: string;
  salary: number;
  startDate: string;
  status: string;
  email: string;
}

export const spreadsheetRows: SpreadsheetRow[] = [
  { id: '1', name: 'Alice Johnson', department: 'Engineering', salary: 125000, startDate: '2021-03-15', status: 'Active', email: 'alice@company.com' },
  { id: '2', name: 'Bob Smith', department: 'Marketing', salary: 95000, startDate: '2020-07-01', status: 'Active', email: 'bob@company.com' },
  { id: '3', name: 'Carol Williams', department: 'Engineering', salary: 140000, startDate: '2019-11-20', status: 'Active', email: 'carol@company.com' },
  { id: '4', name: 'Dave Brown', department: 'Sales', salary: 85000, startDate: '2022-01-10', status: 'On Leave', email: 'dave@company.com' },
  { id: '5', name: 'Eve Davis', department: 'Engineering', salary: 155000, startDate: '2018-05-22', status: 'Active', email: 'eve@company.com' },
  { id: '6', name: 'Frank Miller', department: 'Marketing', salary: 88000, startDate: '2023-02-14', status: 'Active', email: 'frank@company.com' },
  { id: '7', name: 'Grace Lee', department: 'Sales', salary: 92000, startDate: '2021-08-30', status: 'Active', email: 'grace@company.com' },
  { id: '8', name: 'Henry Wilson', department: 'Engineering', salary: 130000, startDate: '2020-04-12', status: 'Inactive', email: 'henry@company.com' },
  { id: '9', name: 'Iris Taylor', department: 'HR', salary: 78000, startDate: '2022-09-05', status: 'Active', email: 'iris@company.com' },
  { id: '10', name: 'Jack Anderson', department: 'Engineering', salary: 145000, startDate: '2019-06-18', status: 'Active', email: 'jack@company.com' },
];

export const spreadsheetColumns: IColumnDef<SpreadsheetRow>[] = [
  { columnId: 'name', name: 'Employee Name', sortable: true, minWidth: 160, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', sortable: true, filterable: { type: 'multiSelect' } },
  {
    columnId: 'salary',
    name: 'Salary',
    sortable: true,
    minWidth: 100,
    valueFormatter: (v) => typeof v === 'number' ? `$${v.toLocaleString()}` : '',
    cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  },
  { columnId: 'startDate', name: 'Start Date', sortable: true, minWidth: 110 },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect' } },
  { columnId: 'email', name: 'Email', sortable: true, minWidth: 180 },
];

export const departmentFilterOptions = ['Engineering', 'Marketing', 'Sales', 'HR'];
export const statusFilterOptions = ['Active', 'On Leave', 'Inactive'];
