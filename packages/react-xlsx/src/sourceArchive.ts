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
  /** Relationship-resolved metadata part, retained outside ExcelJS. */
  metadataPath?: string;
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

interface DynamicCell { formula: string; cm?: string }
const dynamicCells = new WeakMap<ExcelJS.Workbook, Map<string, Map<string, DynamicCell>>>();
export function dynamicCellsOf(workbook: ExcelJS.Workbook): Map<string, Map<string, DynamicCell>> | undefined {
  return dynamicCells.get(workbook);
}
/** Mark a newly computed spill without pulling ZIP/XML code into the grid. */
export function markDynamicArray(worksheet: ExcelJS.Worksheet, address: string, cm?: string): void {
  const workbook = worksheet.workbook;
  let sheets = dynamicCells.get(workbook);
  if (!sheets) { sheets = new Map(); dynamicCells.set(workbook, sheets); }
  let cells = sheets.get(worksheet.name);
  if (!cells) { cells = new Map(); sheets.set(worksheet.name, cells); }
  cells.set(address, { formula: worksheet.getCell(address).formula, cm: cm ?? cells.get(address)?.cm });
}
/** Copy markers through ExcelJS clones, shifting their coordinates with structure edits. */
export function copyDynamicArrays(from: ExcelJS.Workbook, to: ExcelJS.Workbook, shift?: (sheet: string, address: string) => string): void {
  const source = sourceArchiveOf(from);
  if (source) sources.set(to, source);
  const cells = dynamicCells.get(from);
  if (!cells) return;
  const next = new Map<string, Map<string, DynamicCell>>();
  for (const [name, entries] of cells) {
    const sheet = to.getWorksheet(name);
    if (!sheet) continue;
    const moved = new Map<string, DynamicCell>();
    for (const [address, cell] of entries) {
      const target = shift ? shift(name, address) : address;
      if (target.includes('#REF!')) continue;
      const formula = shift ? sheet.getCell(target).formula : cell.formula;
      if (formula) moved.set(target, { ...cell, formula });
    }
    next.set(name, moved);
  }
  dynamicCells.set(to, next);
}
