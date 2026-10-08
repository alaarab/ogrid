import { useCallback, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  createStructureColumn,
  flattenColumns,
  insertColumnAt,
  insertRowsAt,
  removeColumnById,
  removeRowsById,
  restoreRemovedRows,
  type IRemovedRow,
  type IColumnDef as ICoreColumnDef,
} from '@alaarab/ogrid-core';
import { shiftFormulaCells, type StructureAxis } from '@alaarab/ogrid-core/formula';
import { useLatestRef } from './useLatestRef';
import type { UseFormulaEngineResult } from './useFormulaEngine';
import type {
  IColumnDef,
  IColumnGroupDef,
  IColumnsChangeEvent,
  IGridEditBridge,
  IGridStructureActions,
  IOGridProps,
  IRowsChangeEvent,
  RowId,
} from '../types';

type ColumnTree<T> = (IColumnDef<T> | IColumnGroupDef<T>)[];
type FormulaList = Array<{ col: number; row: number; formula: string }>;
/** Formula snapshots taken around a structure edit, restored on undo/redo. */
type FormulaShift = { before: FormulaList; after: FormulaList } | null;

export interface UseOGridStructureEditsParams<T> {
  props: Pick<IOGridProps<T>, 'data' | 'columns' | 'allowStructureEdits' | 'onRowsChange' | 'onColumnsChange' | 'createRow'>;
  isServerSide: boolean;
  /** The client-side rows (`data`, or rows set through `setRowData`). Formula rows index this array. */
  displayData: T[];
  setInternalData: Dispatch<SetStateAction<T[]>>;
  getRowId: (item: T) => RowId;
  /** Bumped before rows change so the row-order snapshot treats the change as an edit, not a new dataset. */
  editVersionRef: { current: number };
  /** Bumped before rows are inserted or deleted, so the next data change re-sorts and new rows show in place. */
  structureVersionRef: { current: number };
  /** Controlled `columnOrder` prop, the effective order, and its writers. */
  columnOrder: string[] | undefined;
  effectiveColumnOrder: string[] | undefined;
  setInternalColumnOrder: Dispatch<SetStateAction<string[] | undefined>>;
  onColumnOrderChange?: (order: string[]) => void;
  formulaEngine: Pick<UseFormulaEngineResult, 'enabled' | 'getAllFormulas' | 'loadFormulas'>;
  /** Engine follows formula text in the data (host-owned undo): leave its formulas alone. */
  formulasFollowData: boolean;
  /** The grid's edit path and undo history (filled by the table). */
  bridgeRef: MutableRefObject<IGridEditBridge<T> | null>;
}

export interface UseOGridStructureEditsResult<T> {
  insertRows: (index: number, rows?: T[]) => void;
  deleteRows: (rowIds: RowId[]) => void;
  insertColumn: (index: number, column?: ICoreColumnDef<T>) => void;
  deleteColumn: (columnId: string) => void;
  /** Menu actions for the table; undefined unless `allowStructureEdits` is on. */
  structureActions: IGridStructureActions<T> | undefined;
}

function warn(message: string): void {
  console.warn(`[OGrid] ${message}`);
}

/**
 * Structure edits for OGrid: insert/delete rows and columns. OGrid's `data`
 * and `columns` are props, so changes are reported through `onRowsChange` /
 * `onColumnsChange` with the complete new array (rows set via `setRowData`
 * update in place). Each edit is one step in the grid's undo history and moves
 * formulas (cells and references) the way a spreadsheet does.
 */
export function useOGridStructureEdits<T>(params: UseOGridStructureEditsParams<T>): UseOGridStructureEditsResult<T> {
  const {
    props, isServerSide, displayData, setInternalData, getRowId, editVersionRef, structureVersionRef,
    columnOrder, effectiveColumnOrder, setInternalColumnOrder, onColumnOrderChange,
    formulaEngine, formulasFollowData, bridgeRef,
  } = params;
  const { allowStructureEdits, createRow } = props;
  const dataControlled = props.data !== undefined;
  const canEditRows = !isServerSide && (!dataControlled || props.onRowsChange != null);
  const canEditColumns = props.onColumnsChange != null;

  // Working copies: several edits in one tick (before the host re-renders with
  // the new arrays) build on each other. A new prop value resets them.
  const dataRef = useRef(displayData);
  const dataSeenRef = useRef(displayData);
  if (dataSeenRef.current !== displayData) {
    dataSeenRef.current = displayData;
    dataRef.current = displayData;
  }
  const columnsRef = useRef(props.columns as ColumnTree<T>);
  const columnsSeenRef = useRef(props.columns);
  if (columnsSeenRef.current !== props.columns) {
    columnsSeenRef.current = props.columns;
    columnsRef.current = props.columns as ColumnTree<T>;
  }
  const orderRef = useRef(effectiveColumnOrder);
  const orderSeenRef = useRef(effectiveColumnOrder);
  if (orderSeenRef.current !== effectiveColumnOrder) {
    orderSeenRef.current = effectiveColumnOrder;
    orderRef.current = effectiveColumnOrder;
  }

  const latest = useLatestRef({
    dataControlled, canEditRows, canEditColumns, createRow, getRowId,
    onRowsChange: props.onRowsChange, onColumnsChange: props.onColumnsChange,
    columnOrder, onColumnOrderChange, formulaEngine, formulasFollowData,
  });

  // --- Formulas ---
  const shiftFormulas = useCallback(
    (shifts: ReadonlyArray<{ axis: StructureAxis; at: number; count: number }>): FormulaShift => {
      const { formulaEngine: engine, formulasFollowData: followData } = latest.current;
      if (!engine.enabled || followData) return null;
      const before = engine.getAllFormulas();
      if (before.length === 0) return { before, after: before };
      let after = before;
      for (const s of shifts) after = shiftFormulaCells(after, s.axis, s.at, s.count);
      engine.loadFormulas(after);
      return { before, after };
    },
    [latest]
  );
  const restoreFormulas = useCallback((list: FormulaList | undefined) => {
    if (list) latest.current.formulaEngine.loadFormulas(list);
  }, [latest]);
  const record = useCallback((undo: () => void, redo: () => void) => {
    bridgeRef.current?.recordUndoable({ undo, redo });
  }, [bridgeRef]);

  // --- Rows (data only; formulas and undo are handled by the callers) ---
  const emitRows = useCallback((next: T[], event: IRowsChangeEvent<T>) => {
    editVersionRef.current++;
    structureVersionRef.current++;
    dataRef.current = next;
    if (!latest.current.dataControlled) setInternalData(next);
    latest.current.onRowsChange?.(event);
  }, [editVersionRef, structureVersionRef, latest, setInternalData]);

  const putRows = useCallback((at: number, rows: T[]) => {
    const next = insertRowsAt(dataRef.current, at, rows);
    emitRows(next, { type: 'insert', rows, indexes: rows.map((_, i) => at + i), data: next });
  }, [emitRows]);

  const restoreRows = useCallback((removed: IRemovedRow<T>[]) => {
    const next = restoreRemovedRows(dataRef.current, removed);
    emitRows(next, { type: 'insert', rows: removed.map((r) => r.row), indexes: removed.map((r) => r.index), data: next });
  }, [emitRows]);

  const takeRows = useCallback((rowIds: RowId[]): IRemovedRow<T>[] => {
    const { data: next, removed } = removeRowsById(dataRef.current, rowIds, latest.current.getRowId);
    if (removed.length > 0) {
      emitRows(next, { type: 'delete', rows: removed.map((r) => r.row), indexes: removed.map((r) => r.index), data: next });
    }
    return removed;
  }, [emitRows, latest]);

  const insertRowsInternal = useCallback((index: number, rows: T[]) => {
    const at = Math.max(0, Math.min(dataRef.current.length, Math.trunc(index) || 0));
    const ids = rows.map((r) => latest.current.getRowId(r));
    const formulas = shiftFormulas([{ axis: 'row', at, count: rows.length }]);
    putRows(at, rows);
    // Undo removes the rows as they are then (edits included), so redo restores those.
    let removed: IRemovedRow<T>[] = rows.map((row, i) => ({ index: at + i, row }));
    record(
      () => {
        removed = takeRows(ids);
        restoreFormulas(formulas?.before);
      },
      () => {
        restoreRows(removed);
        restoreFormulas(formulas?.after);
      },
    );
  }, [latest, shiftFormulas, putRows, record, takeRows, restoreRows, restoreFormulas]);

  const insertRows = useCallback((index: number, rows?: T[]) => {
    const st = latest.current;
    if (!st.canEditRows) {
      warn(isServerSide ? 'insertRows needs client-side data.' : 'insertRows needs an onRowsChange handler when you pass data.');
      return;
    }
    let newRows = rows;
    if (!newRows) {
      if (!st.createRow) {
        warn('insertRows without rows needs a createRow prop.');
        return;
      }
      newRows = [st.createRow(Math.max(0, Math.min(dataRef.current.length, index)))];
    }
    if (newRows.length === 0) return;
    insertRowsInternal(index, newRows);
  }, [latest, isServerSide, insertRowsInternal]);

  const deleteRows = useCallback((rowIds: RowId[]) => {
    if (!latest.current.canEditRows) {
      warn(isServerSide ? 'deleteRows needs client-side data.' : 'deleteRows needs an onRowsChange handler when you pass data.');
      return;
    }
    const ids = new Set(rowIds);
    const { getRowId: idOf } = latest.current;
    const indexes: number[] = [];
    dataRef.current.forEach((row, i) => {
      if (ids.has(idOf(row))) indexes.push(i);
    });
    if (indexes.length === 0) return;
    // Delete from the bottom up so each shift sees the rows above it unmoved.
    const formulas = shiftFormulas(indexes.slice().reverse().map((at) => ({ axis: 'row' as const, at, count: -1 })));
    let removed = takeRows(rowIds);
    record(
      () => {
        restoreRows(removed);
        restoreFormulas(formulas?.before);
      },
      () => {
        removed = takeRows(rowIds);
        restoreFormulas(formulas?.after);
      },
    );
  }, [latest, isServerSide, shiftFormulas, takeRows, record, restoreRows, restoreFormulas]);

  // --- Columns ---
  const setOrder = useCallback((next: string[]) => {
    orderRef.current = next;
    if (latest.current.columnOrder === undefined) setInternalColumnOrder(next);
    latest.current.onColumnOrderChange?.(next);
  }, [latest, setInternalColumnOrder]);

  const putColumn = useCallback((at: number, column: IColumnDef<T>) => {
    const before = flattenColumns(columnsRef.current);
    const next = insertColumnAt(columnsRef.current, at, column as IColumnDef<T> | IColumnGroupDef<T>);
    columnsRef.current = next;
    const event: IColumnsChangeEvent<T> = { type: 'insert', column, index: at, columns: next };
    latest.current.onColumnsChange?.(event);
    // A reordered grid shows columns by `columnOrder`: place the new one next to its neighbor there too.
    const order = orderRef.current;
    if (order) {
      const right = before[at]?.columnId;
      const left = before[at - 1]?.columnId;
      const nextOrder = order.slice();
      const rightPos = right !== undefined ? nextOrder.indexOf(right) : -1;
      const leftPos = left !== undefined ? nextOrder.indexOf(left) : -1;
      if (rightPos >= 0) nextOrder.splice(rightPos, 0, column.columnId);
      else if (leftPos >= 0) nextOrder.splice(leftPos + 1, 0, column.columnId);
      else nextOrder.push(column.columnId);
      setOrder(nextOrder);
    }
  }, [latest, setOrder]);

  const takeColumn = useCallback((columnId: string): { column: IColumnDef<T>; index: number } | null => {
    const result = removeColumnById(columnsRef.current, columnId);
    if (!result) return null;
    columnsRef.current = result.columns;
    const column = result.column as IColumnDef<T>;
    latest.current.onColumnsChange?.({ type: 'delete', column, index: result.index, columns: result.columns });
    const order = orderRef.current;
    if (order?.includes(columnId)) setOrder(order.filter((id) => id !== columnId));
    return { column, index: result.index };
  }, [latest, setOrder]);

  const insertColumnsInternal = useCallback((index: number, columns: IColumnDef<T>[]) => {
    const total = flattenColumns(columnsRef.current).length;
    const at = Math.max(0, Math.min(total, Math.trunc(index) || 0));
    const formulas = shiftFormulas([{ axis: 'col', at, count: columns.length }]);
    columns.forEach((c, i) => {
      putColumn(at + i, c);
    });
    let current = columns.map((column, i) => ({ column, index: at + i }));
    record(
      () => {
        // Right to left, so each recorded index is the column's index before the undo.
        current = columns
          .slice()
          .reverse()
          .map((c) => takeColumn(c.columnId))
          .filter((r): r is { column: IColumnDef<T>; index: number } => r !== null)
          .sort((a, b) => a.index - b.index);
        restoreFormulas(formulas?.before);
      },
      () => {
        for (const { column, index: i } of current) putColumn(i, column);
        restoreFormulas(formulas?.after);
      },
    );
  }, [shiftFormulas, putColumn, record, takeColumn, restoreFormulas]);

  const newColumns = useCallback((count: number): IColumnDef<T>[] => {
    const ids = flattenColumns(columnsRef.current).map((c) => c.columnId);
    const out: IColumnDef<T>[] = [];
    for (let i = 0; i < count; i++) {
      const col = createStructureColumn<T>(ids) as IColumnDef<T>;
      ids.push(col.columnId);
      out.push(col);
    }
    return out;
  }, []);

  const insertColumn = useCallback((index: number, columnDef?: ICoreColumnDef<T>) => {
    const column = columnDef as IColumnDef<T> | undefined;
    if (!latest.current.canEditColumns) {
      warn('insertColumn needs an onColumnsChange handler.');
      return;
    }
    const ids = flattenColumns(columnsRef.current).map((c) => c.columnId);
    const col = column ?? newColumns(1)[0];
    if (!col) return;
    if (ids.includes(col.columnId)) {
      warn(`insertColumn: a column with id "${col.columnId}" already exists.`);
      return;
    }
    insertColumnsInternal(index, [col]);
  }, [latest, newColumns, insertColumnsInternal]);

  const deleteColumns = useCallback((columnIds: string[]) => {
    if (!latest.current.canEditColumns) {
      warn('deleteColumn needs an onColumnsChange handler.');
      return;
    }
    const flatIds = flattenColumns(columnsRef.current).map((c) => c.columnId);
    const targets = [...new Set(columnIds)]
      .map((id) => ({ id, index: flatIds.indexOf(id) }))
      .filter((t) => t.index >= 0)
      .sort((a, b) => b.index - a.index);
    if (targets.length === 0) return;
    // Right to left, so each shift sees the columns to its left unmoved.
    const formulas = shiftFormulas(targets.map((t) => ({ axis: 'col' as const, at: t.index, count: -1 })));
    const takeAll = () => targets
      .map((t) => takeColumn(t.id))
      .filter((r): r is { column: IColumnDef<T>; index: number } => r !== null);
    let removed = takeAll();
    record(
      () => {
        for (const r of removed.slice().sort((a, b) => a.index - b.index)) putColumn(r.index, r.column);
        restoreFormulas(formulas?.before);
      },
      () => {
        removed = takeAll();
        restoreFormulas(formulas?.after);
      },
    );
  }, [latest, shiftFormulas, takeColumn, record, putColumn, restoreFormulas]);

  const deleteColumn = useCallback((columnId: string) => deleteColumns([columnId]), [deleteColumns]);

  // --- Menu actions ---
  const insertRowsNear = useCallback((item: T, position: 'above' | 'below', count: number) => {
    const st = latest.current;
    if (!st.createRow || count < 1) return;
    let idx = dataRef.current.indexOf(item);
    if (idx < 0) {
      const id = st.getRowId(item);
      idx = dataRef.current.findIndex((r) => st.getRowId(r) === id);
    }
    if (idx < 0) return;
    const at = position === 'above' ? idx : idx + 1;
    const create = st.createRow;
    insertRows(at, Array.from({ length: count }, (_, i) => create(at + i)));
  }, [latest, insertRows]);

  const insertColumnsNear = useCallback((columnId: string, side: 'left' | 'right', count: number) => {
    if (!latest.current.canEditColumns || count < 1) return;
    const idx = flattenColumns(columnsRef.current).findIndex((c) => c.columnId === columnId);
    if (idx < 0) return;
    insertColumnsInternal(side === 'left' ? idx : idx + 1, newColumns(count));
  }, [latest, insertColumnsInternal, newColumns]);

  const canInsertRows = canEditRows && createRow != null;
  const structureActions = useMemo<IGridStructureActions<T> | undefined>(() => {
    if (!allowStructureEdits) return undefined;
    return {
      canInsertRows,
      canDeleteRows: canEditRows,
      canEditColumns,
      insertRowsNear,
      deleteRows,
      insertColumnsNear,
      deleteColumns,
    };
  }, [allowStructureEdits, canInsertRows, canEditRows, canEditColumns, insertRowsNear, deleteRows, insertColumnsNear, deleteColumns]);

  return { insertRows, deleteRows, insertColumn, deleteColumn, structureActions };
}
