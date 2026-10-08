import { useCallback, useRef, type MutableRefObject } from 'react';
import { getCellValue as readCell } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
import type { UseFormulaEngineResult } from './useFormulaEngine';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { IGridEditBridge, RowId } from '../types';

export interface UseOGridCellApiParams<T> {
  /** Rows by sheet (formula) row: all client-side data, or the loaded server rows. May be sparse. */
  sheetItems: T[];
  /** Flat leaf columns; a formula's column index is an index into this array. */
  columns: IColumnDef<T>[];
  getRowId: (item: T) => RowId;
  formulaEngine: Pick<UseFormulaEngineResult, 'enabled' | 'hasFormula' | 'getFormulaValue' | 'getSpillRange'>;
  bridgeRef: MutableRefObject<IGridEditBridge<T> | null>;
}

export interface UseOGridCellApiResult {
  getCellValue: (rowId: RowId, columnId: string) => unknown;
  setCellValue: (rowId: RowId, columnId: string, value: unknown) => void;
}

/**
 * Cell-level API for OGrid's ref: read a cell (formula result or field value)
 * and write one through the grid's own edit path (value parser,
 * onCellValueChanged, undo history, formula engine).
 */
export function useOGridCellApi<T>(params: UseOGridCellApiParams<T>): UseOGridCellApiResult {
  const latest = useLatestRef(params);
  // Row id -> sheet row, rebuilt only when the rows array changes.
  const indexRef = useRef<{ items: T[] | null; byId: Map<RowId, number> }>({ items: null, byId: new Map() });

  const locate = useCallback((rowId: RowId, columnId: string) => {
    const { sheetItems, columns, getRowId } = latest.current;
    if (indexRef.current.items !== sheetItems) {
      const byId = new Map<RowId, number>();
      sheetItems.forEach((item, i) => {
        if (item !== undefined) byId.set(getRowId(item), i);
      });
      indexRef.current = { items: sheetItems, byId };
    }
    const row = indexRef.current.byId.get(rowId);
    const item = row !== undefined ? sheetItems[row] : undefined;
    const col = columns.findIndex((c) => c.columnId === columnId);
    const colDef = columns[col];
    if (row === undefined || item === undefined || !colDef) return null;
    return { item, row, col, colDef };
  }, [latest]);

  const getCellValue = useCallback((rowId: RowId, columnId: string): unknown => {
    const cell = locate(rowId, columnId);
    if (!cell) return undefined;
    const engine = latest.current.formulaEngine;
    if (engine.enabled && (engine.hasFormula(cell.col, cell.row) || engine.getSpillRange?.(cell.col, cell.row))) return engine.getFormulaValue(cell.col, cell.row);
    return readCell<T>(cell.item, cell.colDef);
  }, [locate, latest]);

  const setCellValue = useCallback((rowId: RowId, columnId: string, value: unknown): void => {
    const cell = locate(rowId, columnId);
    if (!cell) {
      console.warn(`[OGrid] setCellValue: no cell for row ${String(rowId)}, column "${columnId}".`);
      return;
    }
    latest.current.bridgeRef.current?.setCellValue(cell.item, columnId, value, cell.row);
  }, [locate, latest]);

  return { getCellValue, setCellValue };
}
