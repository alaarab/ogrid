import { useMemo, useRef } from 'react';
import {
  buildSheetRowIndex,
  resolveSheetItems,
  resolveSheetPageOffset,
  selectFormulaRowMap,
} from './ogridDerivations';
import type { IFormulaRowMap } from '@alaarab/ogrid-core';
import type { PageSize, RowId } from '../types';
import type { UseOGridDataFetchingState } from './useOGridDataFetching';

export interface UseOGridSheetCoordinatesState<T> {
  /** Rows formulas address, indexed by sheet row. */
  sheetItems: T[];
  /** Displayed row to sheet row, or `undefined` outside spreadsheet mode. */
  formulaRowMap: IFormulaRowMap | undefined;
}

/**
 * Sheet coordinates (formulas, A1 references, row numbers, name box).
 * A formula row is the record's index in the full client-side data, not its
 * position on screen, so formulas stay with their record through sort, filter
 * and paging. Server-side grids only hold the current page, so there the sheet
 * row is the absolute row in the server's order.
 */
export function useOGridSheetCoordinates<T>(
  spreadsheetMode: boolean,
  isServerSide: boolean,
  displayData: T[],
  dataFetching: Pick<UseOGridDataFetchingState<T>, 'displayItems' | 'windowed'>,
  pagination: { page: number; pageSize: PageSize },
  getRowId: (item: T) => RowId,
  preserveRowOrder = false,
): UseOGridSheetCoordinatesState<T> {
  const { displayItems, windowed } = dataFetching;
  const pageOffset = resolveSheetPageOffset(isServerSide, pagination.page, pagination.pageSize);
  const rowOrder = useRef<RowId[]>([]);
  const formulaData = useMemo(() => {
    if (!preserveRowOrder || isServerSide) { rowOrder.current = []; return displayData; }
    const byId = new Map(displayData.map(item => [getRowId(item), item]));
    const ids = rowOrder.current.filter(id => byId.has(id));
    const seen = new Set(ids);
    for (const item of displayData) { const id = getRowId(item); if (!seen.has(id)) { ids.push(id); seen.add(id); } }
    rowOrder.current = ids;
    return ids.map(id => byId.get(id) as T);
  }, [displayData, getRowId, preserveRowOrder, isServerSide]);
  const sheetItems = useMemo(
    () => resolveSheetItems(windowed, isServerSide, formulaData, displayItems, pageOffset),
    [windowed, isServerSide, formulaData, displayItems, pageOffset]
  );
  const sheetRowById = useMemo(
    () => (!spreadsheetMode || isServerSide ? null : buildSheetRowIndex(sheetItems, getRowId)),
    [spreadsheetMode, isServerSide, sheetItems, getRowId]
  );
  const formulaRowMap = useMemo(
    () => selectFormulaRowMap(spreadsheetMode, windowed ? windowed.rowCount : null, sheetRowById, pageOffset, displayItems, getRowId),
    [spreadsheetMode, windowed, sheetRowById, pageOffset, displayItems, getRowId]
  );
  return { sheetItems, formulaRowMap };
}
