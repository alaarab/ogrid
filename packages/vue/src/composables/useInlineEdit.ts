/**
 * useInlineEdit (Vue) — headless inline-edit lifecycle for OGrid cells.
 *
 * Mirrors the React useInlineEdit API with Vue-native reactivity (refs,
 * computeds). Pairs with `useHeadlessGrid` for shadcn-style table chrome.
 */

import { ref, shallowRef, type Ref } from 'vue';
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

export interface UseInlineEditParams<T> {
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

export interface UseInlineEditResult<T> {
  editingCell: Ref<{ rowId: RowId; columnId: string } | null>;
  pendingValue: Ref<unknown>;
  setPendingValue: (value: unknown) => void;
  startEdit: (row: T, columnId: string) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  isEditing: (row: T, columnId: string) => boolean;
  canEdit: (row: T, columnId: string) => boolean;
  getEditorProps: (row: T, columnId: string) => InlineEditorProps;
}

export function useInlineEdit<T>(
  params: UseInlineEditParams<T>,
): UseInlineEditResult<T> {
  const { columns, getRowId, onCellEdit, isCellEditable } = params;

  const editingCell = ref<{ rowId: RowId; columnId: string } | null>(null);
  const pendingValue = ref<unknown>(undefined);
  // shallowRef so the row object reference isn't reactively unwrapped — the
  // consumer's row type stays exactly T (no UnwrapRef<T> shenanigans).
  const editingContext = shallowRef<{ item: T; oldValue: unknown } | null>(null);

  const findColumn = (columnId: string) =>
    columns.find((c) => c.columnId === columnId);

  const canEdit = (row: T, columnId: string): boolean => {
    if (isCellEditable) return isCellEditable(row, columnId);
    const col = findColumn(columnId);
    if (!col) return false;
    return isColumnEditable(col, row);
  };

  const isEditing = (row: T, columnId: string): boolean => {
    const e = editingCell.value;
    if (!e) return false;
    return e.rowId === getRowId(row) && e.columnId === columnId;
  };

  const setPendingValue = (value: unknown) => {
    pendingValue.value = value;
  };

  const startEdit = (row: T, columnId: string) => {
    if (!canEdit(row, columnId)) return;
    const col = findColumn(columnId);
    if (!col) return;
    const oldValue = coreGetCellValue(row, col);
    editingCell.value = { rowId: getRowId(row), columnId };
    editingContext.value = { item: row, oldValue };
    pendingValue.value = oldValue;
  };

  const cancelEdit = () => {
    editingCell.value = null;
    editingContext.value = null;
    pendingValue.value = undefined;
  };

  const commitEdit = () => {
    const e = editingCell.value;
    const ctx = editingContext.value;
    if (!e || !ctx) return;
    const col = findColumn(e.columnId);
    if (!col) {
      cancelEdit();
      return;
    }
    let newValue = pendingValue.value;
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
    editingCell.value = null;
    editingContext.value = null;
    pendingValue.value = undefined;
  };

  const getEditorProps = (_row: T, _columnId: string): InlineEditorProps => ({
    value: pendingValue.value,
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
