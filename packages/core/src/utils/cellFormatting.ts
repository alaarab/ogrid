import type { IColumnDef } from '../types/columnTypes';
import { formatDateForDisplay, DEFAULT_DATE_FORMAT } from './dateFormatter';
import { booleanParser } from './valueParsers';

/** Text shared by cell display and text filtering; custom renderCell nodes stay in the UI. */
export function formatCellValue<T>(value: unknown, item: T, col: IColumnDef<T>): string | null {
  if (col.valueFormatter) return col.valueFormatter(value, item);
  if (value == null) return null;
  if (col.type === 'date') {
    const formatted = formatDateForDisplay(value, col.dateFormat ?? DEFAULT_DATE_FORMAT);
    if (formatted !== null) return formatted;
  }
  if (col.type === 'boolean') {
    // Unrecognized values keep their previous truthiness-based display.
    return (booleanParser({ newValue: value, oldValue: value, data: item, column: col }) ?? value) ? 'True' : 'False';
  }
  return String(value);
}
