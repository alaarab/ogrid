import { useMemo } from 'react';
import {
  buildSheetRowIndex,
  resolveSheetItems,
  resolveSheetPageOffset,
  selectFormulaRowMap,
} from './ogridDerivations';
import type { IFormulaRowMap } from '@alaarab/ogrid-core';
import type { PageSize, RowId, WindowedDataState } from '../types';

export interface UseOGridSheetCoordinatesParams<T> {
  /** `cellReferences` or `formulas` is on. */
  spreadsheetMode: boolean;
  isServerSide: boolean;
  /** Full client-side dataset. */
  displayData: T[];
  /** Rows on screen (current page, sorted and filtered). */
  displayItems: T[];
  windowed: WindowedDataState<T> | null;
  page: number;
  pageSize: PageSize;
  getRowId: (item: T) => RowId;
}

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
export function useOGridSheetCoordinates<T>(params: UseOGridSheetCoordinatesParams<T>): UseOGridSheetCoordinatesState<T> {
  const { spreadsheetMode, isServerSide, displayData, displayItems, windowed, page, pageSize, getRowId } = params;
  const pageOffset = resolveSheetPageOffset(isServerSide, page, pageSize);
  const sheetItems = useMemo(
    () => resolveSheetItems(windowed, isServerSide, displayData, displayItems, pageOffset),
    [windowed, isServerSide, displayData, displayItems, pageOffset]
  );
  const sheetRowById = useMemo(
    () => (!spreadsheetMode || isServerSide ? null : buildSheetRowIndex(displayData, getRowId)),
    [spreadsheetMode, isServerSide, displayData, getRowId]
  );
  const formulaRowMap = useMemo(
    () => selectFormulaRowMap({
      spreadsheetMode,
      windowedRowCount: windowed ? windowed.rowCount : null,
      sheetRowById,
      pageOffset,
      displayItems,
      getRowId,
    }),
    [spreadsheetMode, windowed, sheetRowById, pageOffset, displayItems, getRowId]
  );
  return { sheetItems, formulaRowMap };
}
