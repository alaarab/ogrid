/**
 * createInlineEdit (Angular) — headless inline-edit lifecycle.
 *
 * Mirrors the React useInlineEdit API with Angular signals.
 */

import { signal, type WritableSignal } from '@angular/core';
import {
  parseValue,
  isColumnEditable,
  getCellValue as coreGetCellValue,
} from '@alaarab/ogrid-core';
import type { IColumnDef as ICoreColumnDef } from '@alaarab/ogrid-core';

export type RowId = string | number;

export interface InlineEditEvent<T> {
  item: T;
  columnId: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface CreateInlineEditParams<T> {
  columns: ICoreColumnDef<T>[];
  getRowId: (row: T) => RowId;
  onCellEdit: (event: InlineEditEvent<T>) => void;
  isCellEditable?: (row: T, columnId: string) => boolean;
}

export interface InlineEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  onKeyDown: (e: { key: string; preventDefault?: () => void; stopPropagation?: () => void }) => void;
  onBlur: () => void;
}

export interface InlineEditResult<T> {
  editingCell: WritableSignal<{ rowId: RowId; columnId: string } | null>;
  pendingValue: WritableSignal<unknown>;
  setPendingValue: (value: unknown) => void;
  startEdit: (row: T, columnId: string) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  isEditing: (row: T, columnId: string) => boolean;
  canEdit: (row: T, columnId: string) => boolean;
  getEditorProps: (row: T, columnId: string) => InlineEditorProps;
}

export function createInlineEdit<T>(
  params: CreateInlineEditParams<T>,
): InlineEditResult<T> {
  const { columns, getRowId, onCellEdit, isCellEditable } = params;

  const editingCell = signal<{ rowId: RowId; columnId: string } | null>(null);
  const pendingValue = signal<unknown>(undefined);
  const editingContext = signal<{ item: T; oldValue: unknown } | null>(null);

  const findColumn = (columnId: string) =>
    columns.find((c) => c.columnId === columnId);

  const canEdit = (row: T, columnId: string): boolean => {
    if (isCellEditable) return isCellEditable(row, columnId);
    const col = findColumn(columnId);
    if (!col) return false;
    return isColumnEditable(col, row);
  };

  const isEditing = (row: T, columnId: string): boolean => {
    const e = editingCell();
    if (!e) return false;
    return e.rowId === getRowId(row) && e.columnId === columnId;
  };

  const setPendingValue = (value: unknown) => pendingValue.set(value);

  const startEdit = (row: T, columnId: string) => {
    if (!canEdit(row, columnId)) return;
    const col = findColumn(columnId);
    if (!col) return;
    const oldValue = coreGetCellValue(row, col);
    editingCell.set({ rowId: getRowId(row), columnId });
    editingContext.set({ item: row, oldValue });
    pendingValue.set(oldValue);
  };

  const cancelEdit = () => {
    editingCell.set(null);
    editingContext.set(null);
    pendingValue.set(undefined);
  };

  const commitEdit = () => {
    const e = editingCell();
    const ctx = editingContext();
    if (!e || !ctx) return;
    const col = findColumn(e.columnId);
    if (!col) {
      cancelEdit();
      return;
    }
    let newValue = pendingValue();
    const result = parseValue(newValue, ctx.oldValue, ctx.item, col);
    if (!result.valid) {
      cancelEdit();
      return;
    }
    newValue = result.value;
    if (newValue === ctx.oldValue) {
      cancelEdit();
      return;
    }
    onCellEdit({
      item: ctx.item,
      columnId: e.columnId,
      oldValue: ctx.oldValue,
      newValue,
    });
    editingCell.set(null);
    editingContext.set(null);
    pendingValue.set(undefined);
  };

  const getEditorProps = (_row: T, _columnId: string): InlineEditorProps => ({
    value: pendingValue(),
    onChange: setPendingValue,
    onCommit: commitEdit,
    onCancel: cancelEdit,
    onKeyDown: (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault?.();
        commitEdit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault?.();
        cancelEdit();
      }
    },
    onBlur: commitEdit,
  });

  return {
    editingCell,
    pendingValue,
    setPendingValue,
    startEdit,
    commitEdit,
    cancelEdit,
    isEditing,
    canEdit,
    getEditorProps,
  };
}
