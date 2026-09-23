/**
 * useInlineEdit — headless inline-edit lifecycle for OGrid's cell editing.
 *
 * Pairs with `useHeadlessGrid` to add spreadsheet-style cell editing on top
 * of any table chrome (shadcn `<Table>`, plain HTML, anything). Consumers
 * decide what editor component to render — this hook only manages the
 * `editingCell` + `pendingValue` state and the start/commit/cancel
 * lifecycle, with `valueParser` validation honored.
 *
 * Example with `useHeadlessGrid` and shadcn primitives:
 *
 *   const grid = useHeadlessGrid({ columns, data, getRowId: (r) => r.id });
 *   const edit = useInlineEdit({
 *     columns,
 *     getRowId: (r) => r.id,
 *     onCellEdit: ({ item, columnId, newValue }) => updateRow(item.id, { [columnId]: newValue }),
 *   });
 *
 *   <TableCell>
 *     {edit.isEditing(row, col.columnId) ? (
 *       <input autoFocus {...edit.getEditorProps(row, col.columnId)} />
 *     ) : (
 *       <span onDoubleClick={() => edit.startEdit(row, col.columnId)}>
 *         {String(grid.getCellValue(row, col.columnId))}
 *       </span>
 *     )}
 *   </TableCell>
 */

import { useCallback, useRef, useState } from 'react';
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
  /** Stable row ID extractor — must match the one passed to useHeadlessGrid. */
  getRowId: (row: T) => RowId;
  /**
   * Called when an edit commits successfully (after valueParser validation).
   * Use this to update your row data store.
   */
  onCellEdit: (event: InlineEditEvent<T>) => void;
  /**
   * Optional override for "is this cell editable?" — defaults to honoring
   * the column's `editable` field (boolean or per-row predicate).
   */
  isCellEditable?: (row: T, columnId: string) => boolean;
}

export interface InlineEditorProps {
  /** Current pending value — wire to your input's `value`. */
  value: unknown;
  /** Update the pending value. */
  onChange: (value: unknown) => void;
  /** Commit the edit (fires `onCellEdit` if validation passes). */
  onCommit: () => void;
  /** Cancel without committing. */
  onCancel: () => void;
  /** Convenience: handles Enter/Escape on input elements. */
  onKeyDown: (e: { key: string; preventDefault?: () => void; stopPropagation?: () => void }) => void;
  /** Convenience: commit on blur. */
  onBlur: () => void;
}

export interface UseInlineEditResult<T> {
  /** The cell currently being edited, or null. */
  editingCell: { rowId: RowId; columnId: string } | null;
  /** Pending value buffer — what the editor is showing before commit. */
  pendingValue: unknown;
  /** Update the pending value buffer. */
  setPendingValue: (value: unknown) => void;
  /** Begin editing a cell. No-op if the cell isn't editable. */
  startEdit: (row: T, columnId: string) => void;
  /** Commit the in-progress edit. Fires `onCellEdit` if validation passes. */
  commitEdit: () => void;
  /** Cancel the in-progress edit without committing. */
  cancelEdit: () => void;
  /** True if the given cell is currently being edited. */
  isEditing: (row: T, columnId: string) => boolean;
  /** True if the given cell is editable (per the column's `editable` field). */
  canEdit: (row: T, columnId: string) => boolean;
  /**
   * Returns props to spread onto an editor input. Includes value, onChange,
   * onBlur (commits), and onKeyDown (Enter commits, Escape cancels). Pass
   * `autoFocus` separately on the element you render.
   */
  getEditorProps: (row: T, columnId: string) => InlineEditorProps;
}

/**
 * Headless inline-edit lifecycle hook.
 *
 * Manages which cell is being edited, the buffered pending value, and the
 * commit/cancel transitions. Validates new values via the column's
 * `valueParser` (same logic `<OGrid>` uses). Does NOT render any editor —
 * the consumer brings their own input component.
 */
export function useInlineEdit<T>(
  params: UseInlineEditParams<T>,
): UseInlineEditResult<T> {
  const { columns, getRowId, onCellEdit, isCellEditable } = params;

  const [editingCell, setEditingCell] = useState<{
    rowId: RowId;
    columnId: string;
  } | null>(null);
  const [pendingValue, setPendingValueState] = useState<unknown>(undefined);
  // The live edit session (with a snapshot of the row + old value at
  // edit-start, so commit doesn't depend on the consumer keeping the same row
  // reference around), updated synchronously. Editor callbacks created in
  // an earlier render (e.g. an onBlur firing right after Escape, before React
  // re-renders) read this instead of their stale closure, so a cancelled or
  // committed edit can't be committed again.
  const sessionRef = useRef<{
    cell: { rowId: RowId; columnId: string };
    item: T;
    oldValue: unknown;
    pending: unknown;
  } | null>(null);

  const setPendingValue = useCallback((value: unknown) => {
    if (sessionRef.current) sessionRef.current.pending = value;
    setPendingValueState(value);
  }, []);

  const findColumn = useCallback(
    (columnId: string) => columns.find((c) => c.columnId === columnId),
    [columns],
  );

  const canEdit = useCallback(
    (row: T, columnId: string): boolean => {
      if (isCellEditable) return isCellEditable(row, columnId);
      const col = findColumn(columnId);
      if (!col) return false;
      return isColumnEditable(col, row);
    },
    [findColumn, isCellEditable],
  );

  const isEditing = useCallback(
    (row: T, columnId: string): boolean => {
      if (!editingCell) return false;
      return (
        editingCell.rowId === getRowId(row) && editingCell.columnId === columnId
      );
    },
    [editingCell, getRowId],
  );

  const startEdit = useCallback(
    (row: T, columnId: string) => {
      if (!canEdit(row, columnId)) return;
      const col = findColumn(columnId);
      if (!col) return;
      const oldValue = coreGetCellValue(row, col);
      const cell = { rowId: getRowId(row), columnId };
      sessionRef.current = { cell, item: row, oldValue, pending: oldValue };
      setEditingCell(cell);
      setPendingValueState(oldValue);
    },
    [canEdit, findColumn, getRowId],
  );

  const cancelEdit = useCallback(() => {
    sessionRef.current = null;
    setEditingCell(null);
    setPendingValueState(undefined);
  }, []);

  const commitEdit = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const col = findColumn(session.cell.columnId);
    if (!col) {
      cancelEdit();
      return;
    }

    const { item, oldValue } = session;

    // Validate via valueParser — same flow <OGrid> uses.
    const result = parseValue(session.pending, oldValue, item, col);
    if (!result.valid) {
      cancelEdit();
      return;
    }
    const newValue = result.value;

    // No-op if value unchanged.
    if (newValue === oldValue) {
      cancelEdit();
      return;
    }

    // End the session before notifying so a re-entrant blur can't commit twice.
    cancelEdit();
    onCellEdit({ item, columnId: session.cell.columnId, oldValue, newValue });
  }, [findColumn, onCellEdit, cancelEdit]);

  const getEditorProps = useCallback(
    (_row: T, _columnId: string): InlineEditorProps => ({
      value: pendingValue,
      onChange: setPendingValue,
      onCommit: commitEdit,
      onCancel: cancelEdit,
      onKeyDown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault?.();
          commitEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault?.();
          cancelEdit();
        }
      },
      onBlur: commitEdit,
    }),
    // row/columnId are accepted for API symmetry with future per-cell
    // overrides but not used in the default implementation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingValue, setPendingValue, commitEdit, cancelEdit],
  );

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
