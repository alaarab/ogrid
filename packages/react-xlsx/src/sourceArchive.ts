import type ExcelJS from 'exceljs';

export interface MediaPoint { col: number; row: number }
export interface ChartAnchor {
  title: string;
  tl: MediaPoint;
  br?: MediaPoint;
  ext?: { width: number; height: number };
}

export interface SourceArchive {
  bytes: ArrayBuffer;
  charts: Map<string, ChartAnchor[]>;
  /** Extents at import, before callers can mutate the ExcelJS workbook. */
  sheets: Map<string, { rows: number; columns: number }>;
}

// Keep the original ZIP outside ExcelJS's model: it discards unsupported parts.
const sources = new WeakMap<ExcelJS.Workbook, SourceArchive>();
export function sourceArchiveOf(workbook: ExcelJS.Workbook): SourceArchive | undefined {
  return sources.get(workbook);
}
export function attachSourceArchive(workbook: ExcelJS.Workbook, source: SourceArchive): void {
  sources.set(workbook, source);
}
