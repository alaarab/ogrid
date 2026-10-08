import type ExcelJS from 'exceljs';
import { columnWidthToPx, DEFAULT_COLUMN_WIDTH_CHARS } from './sheetMapper';
import type { MediaPoint } from './sourceArchive';

export const EMUS_PER_PIXEL = 9525;

export function sheetColumnPixels(worksheet: ExcelJS.Worksheet, col: number): number {
  return columnWidthToPx(worksheet.columns?.[col]?.width ?? worksheet.properties.defaultColWidth ?? DEFAULT_COLUMN_WIDTH_CHARS);
}

/** Native drawing offsets are EMUs, independent of ExcelJS's anchor getters. */
export function nativeMediaPoint(worksheet: ExcelJS.Worksheet, anchor: Pick<ExcelJS.IAnchor, 'nativeCol' | 'nativeRow' | 'nativeColOff' | 'nativeRowOff'>): MediaPoint {
  const height = (worksheet.findRow(anchor.nativeRow + 1)?.height ?? worksheet.properties.defaultRowHeight ?? 15) * 4 / 3;
  return {
    col: anchor.nativeCol + anchor.nativeColOff / EMUS_PER_PIXEL / Math.max(1, sheetColumnPixels(worksheet, anchor.nativeCol)),
    row: anchor.nativeRow + anchor.nativeRowOff / EMUS_PER_PIXEL / Math.max(1, height),
  };
}
