// An editable view of an ExcelJS workbook: the grid state of every sheet the
// user has opened (values, styles, merges, column widths), a per-sheet undo
// history covering all of it, and export back to .xlsx.
//
// Export starts from a copy of the source workbook and writes back only what
// changed. Everything this package does not model (rich text, hyperlinks,
// comments, conditional formats, defined names, data validations, print
// setup, shared formulas, sheets the user never opened, header rows) passes
// through exactly as ExcelJS read it.

import ExcelJS from 'exceljs';
import { UndoRedoStack, triggerBlobDownload, type ICellNote, type IColumnDef, type RowId, type ISpillRange } from '@alaarab/ogrid-core';
import { createBuiltInFunctions, tokenize, parseRange, type IGridDataAccessor, type IRecalcResult } from '@alaarab/ogrid-core/formula';
import { applyStyleEdit, styleHas, type StyleEdit, type XlsxCellStyle } from './cellStyles';
import { XLSX_MIME_TYPE } from './exportToXlsx';
import { readSheetNotes, writeSheetNotes } from './cellNotes';
import { rebaseFormulaRows, toFileFormula } from './formulaReferences';
import type { IMergedCell, XlsxSelection } from './gridAdapter';
import {
  cellKey,
  headerReferencingFormulas,
  normalizeCellValue,
  pxToColumnWidth,
  sheetToGridData,
  type SheetGridData,
  type SheetRow,
  type SheetToGridDataOptions,
} from './sheetMapper';

type Op =
  | { t: 'cell'; rowId: number; columnId: string; before: unknown; after: unknown }
  | { t: 'style'; key: string; before: XlsxCellStyle | undefined; after: XlsxCellStyle | undefined }
  | { t: 'merges'; before: IMergedCell[]; after: IMergedCell[] }
  | { t: 'notes'; before: ICellNote[]; after: ICellNote[] };

/** One sheet's live grid state. Read-only for consumers; change it through the document. */
export interface XlsxSheetState {
  readonly name: string;
  /** The mapping the sheet was opened with (columns, initial rows, formatting as read). */
  readonly source: SheetGridData;
  /** Current rows. Formula cells hold their formula text ("=SUM(A1:A3)"). */
  readonly rows: SheetRow[];
  /** Current per-cell styles by cellKey(rowId, columnId). */
  readonly styles: ReadonlyMap<string, XlsxCellStyle>;
  /** Current merged blocks. */
  readonly merges: IMergedCell[];
  /** Current cell notes (Excel notes on loaded data cells). */
  readonly notes: ICellNote[];
  /** Current column widths in Excel character units (explicit ones only). */
  readonly columnWidths: Readonly<Record<string, number>>;
  /** Current row heights in points by row id (explicit ones only). */
  readonly rowHeights: ReadonlyMap<number, number>;
  /** Latest formula results reported by the grid's engine, by cellKey. */
  readonly formulaResults: ReadonlyMap<string, unknown>;
  /** The grid's columns, built once per sheet. */
  readonly columns: IColumnDef<SheetRow>[];
}

interface MutableSheetState {
  name: string;
  source: SheetGridData;
  initialRows: SheetRow[];
  rows: SheetRow[];
  initialStyles: Map<string, XlsxCellStyle>;
  styles: Map<string, XlsxCellStyle>;
  initialMerges: IMergedCell[];
  merges: IMergedCell[];
  initialNotes: ICellNote[];
  notes: ICellNote[];
  initialWidths: Record<string, number>;
  columnWidths: Record<string, number>;
  initialRowHeights: Map<number, number>;
  rowHeights: Map<number, number>;
  formulaResults: Map<string, unknown>;
  /** Engine output by grid coordinates, including cells outside the loaded view. */
  outputResults: Map<string, unknown>;
  spillRanges: ISpillRange[];
  columns: IColumnDef<SheetRow>[];
  columnIndex: Map<string, number>;
  history: UndoRedoStack<Op>;
  batchOpen: boolean;
}

/**
 * Formula text the grid's engine can evaluate. Others (unknown functions,
 * missing sheets, references into a promoted header row) keep the file's
 * cached result in the grid and are exported unchanged.
 */
function engineCanEvaluate(
  formula: { col: number; row: number; formula: string },
  sheetNames: Set<string>,
  functions: Map<string, unknown>,
): boolean {
  if (headerReferencingFormulas.has(formula)) return false;
  try {
    return tokenize(formula.formula.slice(1)).every((token) =>
      (token.type !== 'FUNCTION' || functions.has(token.value.toUpperCase())) &&
      (token.type !== 'SHEET_REF' || sheetNames.has(token.value)) &&
      token.type !== 'IDENTIFIER',
    );
  } catch {
    return false;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if ((a === '' || a == null) && (b === '' || b == null)) return true;
  return Object.is(a, b);
}

function isFormulaText(v: unknown): v is string {
  return typeof v === 'string' && v.length > 1 && v.startsWith('=');
}

function toCellValue(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || typeof v === 'string') return v;
  if (v instanceof Date) return v;
  return String(v);
}

function resultValue(v: unknown): ExcelJS.CellValue | undefined {
  if (v === undefined) return undefined;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    // FormulaError → Excel error result.
    const type = (v as { type?: unknown }).type;
    return typeof type === 'string' && type.startsWith('#') ? { error: type } as ExcelJS.CellErrorValue : undefined;
  }
  return toCellValue(v) ?? undefined;
}

export class XlsxWorkbookDocument {
  readonly workbook: ExcelJS.Workbook;
  readonly options: SheetToGridDataOptions;
  private readonly sheets = new Map<string, MutableSheetState>();
  private readonly listeners = new Set<() => void>();
  private versionValue = 0;
  private accessors: Record<string, IGridDataAccessor> | null = null;

  constructor(workbook: ExcelJS.Workbook, options: SheetToGridDataOptions = {}) {
    this.workbook = workbook;
    this.options = options;
  }

  /** Changes every time any sheet's state changes. */
  get version(): number {
    return this.versionValue;
  }

  get sheetNames(): string[] {
    return this.workbook.worksheets.map((w) => w.name);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getVersion = (): number => this.versionValue;

  private emit(): void {
    this.versionValue++;
    for (const l of [...this.listeners]) l();
  }

  /** The sheet's grid state, mapped on first access. */
  sheet(name: string): XlsxSheetState | undefined {
    return this.state(name);
  }

  private state(name: string): MutableSheetState | undefined {
    const existing = this.sheets.get(name);
    if (existing) return existing;
    const worksheet = this.workbook.getWorksheet(name);
    if (!worksheet) return undefined;
    const source = sheetToGridData(worksheet, this.options);
    const sheetNames = new Set(this.sheetNames);
    const functions = createBuiltInFunctions();
    // Engine-evaluable formulas live in the rows as formula text, which the
    // grid's engine follows (formulas + host-owned undo). The rest keep their
    // cached result in the row; export leaves those cells untouched.
    const rows = source.rows.map((r) => ({ ...r }));
    const formulaResults = new Map<string, unknown>();
    const outputResults = new Map<string, unknown>();
    for (const f of source.initialFormulas) {
      const column = source.columns[f.col];
      const row = rows[f.row];
      if (!column || !row) continue;
      const cached = row[column.columnId];
      if (cached !== undefined && !engineCanEvaluate(f, sheetNames, functions)) continue;
      if (cached !== undefined) {
        formulaResults.set(cellKey(row.__rowIdx, column.columnId), cached);
        outputResults.set(`${f.col},${f.row}`, cached);
      }
      row[column.columnId] = f.formula;
    }
    // Array children are caches, not independent input cells. Keep caches
    // separately so the engine can spill into their empty source cells.
    for (const range of source.arrayRanges ?? []) {
      const anchor = rows[range.anchorRow];
      const anchorColumn = source.columns[range.anchorCol];
      if (!anchor || !anchorColumn || !isFormulaText(anchor[anchorColumn.columnId])) continue;
      for (let r = range.anchorRow; r <= Math.min(range.endRow, rows.length - 1); r++) {
        for (let c = range.anchorCol; c <= Math.min(range.endCol, source.columns.length - 1); c++) {
          if (r === range.anchorRow && c === range.anchorCol) continue;
          const row = rows[r], column = source.columns[c];
          const cached = normalizeCellValue(worksheet.findRow(r + 1 + (source.formatting.headerPromoted ? 1 : 0))?.findCell(c + 1)?.value);
          outputResults.set(`${c},${r}`, cached);
          if (!row || !column) continue;
          formulaResults.set(cellKey(row.__rowIdx, column.columnId), row[column.columnId]);
          row[column.columnId] = '';
        }
      }
      // Read existing caches beyond the view sparsely. The logical array
      // extent can be much larger than either the loaded grid or file data.
      if (range.endRow >= rows.length || range.endCol >= source.columns.length) {
        const offset = source.formatting.headerPromoted ? 1 : 0;
        worksheet.eachRow({ includeEmpty: false }, (row, sheetRow) => {
          const r = sheetRow - 1 - offset;
          if (r < range.anchorRow || r > range.endRow) return;
          row.eachCell({ includeEmpty: false }, (cell, sheetCol) => {
            const c = sheetCol - 1;
            if (c < range.anchorCol || c > range.endCol || (r < rows.length && c < source.columns.length)) return;
            outputResults.set(`${c},${r}`, normalizeCellValue(cell.value));
          });
        });
      }
    }
    const notes = readSheetNotes(worksheet, source);
    const state: MutableSheetState = {
      name,
      source,
      initialRows: rows,
      rows,
      initialStyles: source.formatting.styles,
      styles: new Map(source.formatting.styles),
      initialMerges: source.formatting.merges,
      merges: source.formatting.merges,
      initialNotes: notes,
      notes,
      initialWidths: source.formatting.columnWidths,
      columnWidths: { ...source.formatting.columnWidths },
      initialRowHeights: source.formatting.rowHeights,
      rowHeights: new Map(source.formatting.rowHeights),
      formulaResults,
      outputResults,
      spillRanges: source.arrayRanges ?? [],
      columns: source.columns,
      columnIndex: new Map(source.columns.map((c, i) => [c.columnId, i])),
      history: new UndoRedoStack<Op>(100),
      batchOpen: false,
    };
    this.sheets.set(name, state);
    return state;
  }

  // ---- Edits ------------------------------------------------------------------

  private record(state: MutableSheetState, ops: Op[]): void {
    if (ops.length === 0) return;
    // Edits arriving in the same task (a paste, a fill) are one undo step.
    if (!state.batchOpen) {
      state.batchOpen = true;
      state.history.beginBatch();
      queueMicrotask(() => {
        state.batchOpen = false;
        state.history.endBatch();
        this.emit();
      });
    }
    state.history.push(ops);
  }

  private rowIndexOf(state: MutableSheetState, rowId: RowId): number {
    const id = Number(rowId);
    const direct = state.rows[id];
    if (direct && direct.__rowIdx === id) return id;
    return state.rows.findIndex((r) => r.__rowIdx === id);
  }

  private applyOp(state: MutableSheetState, op: Op, direction: 'after' | 'before'): void {
    if (op.t === 'cell') {
      const index = this.rowIndexOf(state, op.rowId);
      const row = state.rows[index];
      if (!row) return;
      if (state.rows === state.initialRows) state.rows = state.rows.slice();
      state.rows[index] = { ...row, [op.columnId]: op[direction] };
    } else if (op.t === 'style') {
      const style = op[direction];
      if (style) state.styles.set(op.key, style);
      else state.styles.delete(op.key);
      this.touchRow(state, Number(op.key.slice(0, op.key.indexOf(':'))));
    } else if (op.t === 'notes') {
      state.notes = op[direction];
    } else {
      state.merges = op[direction];
    }
  }

  /** Give a row a new identity so the grid re-renders it (rows are memoized by identity). */
  private touchRow(state: MutableSheetState, rowId: number): void {
    const index = this.rowIndexOf(state, rowId);
    const row = state.rows[index];
    if (!row) return;
    if (state.rows === state.initialRows) state.rows = state.rows.slice();
    state.rows[index] = { ...row };
  }

  private commit(state: MutableSheetState, ops: Op[]): void {
    if (ops.length === 0) return;
    // The formula hook compares the previous render's row identities. Keep
    // that snapshot intact while applying edits, including subsequent edits.
    state.rows = state.rows.slice();
    for (const op of ops) this.applyOp(state, op, 'after');
    this.record(state, ops);
    this.emit();
  }

  /** Write cell values (the grid's onCellValueChanged lands here). Formula text starts with "=". */
  setCellValues(sheetName: string, changes: Array<{ rowId: RowId; columnId: string; value: unknown }>): void {
    const state = this.state(sheetName);
    if (!state) return;
    const ops: Op[] = [];
    for (const { rowId, columnId, value } of changes) {
      const row = state.rows[this.rowIndexOf(state, rowId)];
      if (!row || !state.columnIndex.has(columnId)) continue;
      const before = row[columnId];
      if (sameValue(before, value) && typeof before === typeof value) continue;
      ops.push({ t: 'cell', rowId: row.__rowIdx, columnId, before, after: value });
    }
    this.commit(state, ops);
  }

  /** Apply a formatting edit to every cell of a selection. Toggles follow the first cell's state. */
  applyStyle(sheetName: string, selection: XlsxSelection, edit: StyleEdit | { kind: 'bold' | 'italic' | 'underline' | 'strike'; value?: undefined }): void {
    const state = this.state(sheetName);
    if (!state || !selection.rowIds.length || !selection.columnIds.length) return;
    let resolved = edit as StyleEdit;
    if ((edit.kind === 'bold' || edit.kind === 'italic' || edit.kind === 'underline' || edit.kind === 'strike') && edit.value === undefined) {
      const first = state.styles.get(cellKey(selection.rowIds[0] as RowId, selection.columnIds[0] as string));
      resolved = { kind: edit.kind, value: !styleHas(first, edit.kind) };
    }
    const ops: Op[] = [];
    for (const rowId of selection.rowIds) {
      for (const columnId of selection.columnIds) {
        const key = cellKey(rowId, columnId);
        const before = state.styles.get(key);
        const after = applyStyleEdit(before, resolved);
        if (before === after) continue;
        ops.push({ t: 'style', key, before, after });
      }
    }
    this.commit(state, ops);
  }

  /** Bounding box of a selection in sheet order (rows by data position, columns by column order). */
  private bounds(state: MutableSheetState, selection: XlsxSelection) {
    const rows = selection.rowIds.map((id) => this.rowIndexOf(state, id)).filter((i) => i >= 0);
    const cols = selection.columnIds.map((id) => state.columnIndex.get(id) ?? -1).filter((i) => i >= 0);
    if (!rows.length || !cols.length) return null;
    return { top: Math.min(...rows), bottom: Math.max(...rows), left: Math.min(...cols), right: Math.max(...cols) };
  }

  private mergeBounds(state: MutableSheetState, m: IMergedCell) {
    const top = this.rowIndexOf(state, m.rowId);
    const left = state.columnIndex.get(m.columnId) ?? -1;
    return { top, left, bottom: top + (m.rowSpan ?? 1) - 1, right: left + (m.colSpan ?? 1) - 1 };
  }

  /**
   * Merge the selection's bounding box into one block. Like Excel, only the
   * top-left value is kept; the other cells are cleared (undoably).
   */
  mergeCells(sheetName: string, selection: XlsxSelection): void {
    const state = this.state(sheetName);
    const box = state && this.bounds(state, selection);
    if (!state || !box || (box.top === box.bottom && box.left === box.right)) return;
    const intersects = (m: IMergedCell) => {
      const b = this.mergeBounds(state, m);
      return b.left <= box.right && b.right >= box.left && b.top <= box.bottom && b.bottom >= box.top;
    };
    const anchorRow = state.rows[box.top] as SheetRow;
    const anchorCol = state.columns[box.left] as IColumnDef<SheetRow>;
    const merge: IMergedCell = {
      rowId: anchorRow.__rowIdx,
      columnId: anchorCol.columnId,
      ...(box.bottom > box.top ? { rowSpan: box.bottom - box.top + 1 } : {}),
      ...(box.right > box.left ? { colSpan: box.right - box.left + 1 } : {}),
    };
    const ops: Op[] = [{ t: 'merges', before: state.merges, after: [...state.merges.filter((m) => !intersects(m)), merge] }];
    for (let r = box.top; r <= box.bottom; r++) {
      const row = state.rows[r] as SheetRow;
      for (let c = box.left; c <= box.right; c++) {
        if (r === box.top && c === box.left) continue;
        const columnId = (state.columns[c] as IColumnDef<SheetRow>).columnId;
        const before = row[columnId];
        if (before !== '' && before != null) ops.push({ t: 'cell', rowId: row.__rowIdx, columnId, before, after: '' });
      }
    }
    this.commit(state, ops);
  }

  /** Remove every merge that intersects the selection. */
  unmergeCells(sheetName: string, selection: XlsxSelection): void {
    const state = this.state(sheetName);
    const box = state && this.bounds(state, selection);
    if (!state || !box) return;
    const kept = state.merges.filter((m) => {
      const b = this.mergeBounds(state, m);
      return !(b.left <= box.right && b.right >= box.left && b.top <= box.bottom && b.bottom >= box.top);
    });
    if (kept.length === state.merges.length) return;
    this.commit(state, [{ t: 'merges', before: state.merges, after: kept }]);
  }

  /** Replace the sheet's cell notes (the grid's onCellNotesChange lands here). Undoable. */
  setNotes(sheetName: string, notes: ICellNote[]): void {
    const state = this.state(sheetName);
    if (!state || notes === state.notes) return;
    this.commit(state, [{ t: 'notes', before: state.notes, after: notes }]);
  }

  /** Record a column resize from the grid (pixels). Not part of undo history, like the grid's own resizes. */
  setColumnWidth(sheetName: string, columnId: string, px: number): void {
    const state = this.state(sheetName);
    if (!state?.columnIndex.has(columnId)) return;
    state.columnWidths = { ...state.columnWidths, [columnId]: pxToColumnWidth(px) };
    this.emit();
  }

  /** Record a row resize from the grid (points). Not part of undo history, like column resizes. */
  setRowHeight(sheetName: string, rowId: RowId, points: number): void {
    const state = this.state(sheetName);
    const id = Number(rowId);
    if (!state || this.rowIndexOf(state, id) < 0) return;
    state.rowHeights = new Map(state.rowHeights).set(id, Math.round(points * 100) / 100);
    this.emit();
  }

  /** Remember the engine's latest results so cross-sheet reads, styles and export can use them. */
  recordFormulaResults(sheetName: string, result: IRecalcResult): void {
    const state = this.sheets.get(sheetName);
    if (!state) return;
    if (result.spillRanges) {
      // Unsupported imported arrays retain their file caches and extents.
      const updated = new Set(result.updatedCells.map(cell => `${cell.col},${cell.row}`));
      const preserved = state.spillRanges.filter(range => {
        const row = state.rows[range.anchorRow], column = state.columns[range.anchorCol];
        return row && column && !isFormulaText(row[column.columnId]) && !updated.has(`${range.anchorCol},${range.anchorRow}`);
      });
      state.spillRanges = [...preserved, ...result.spillRanges];
    }
    for (const cell of result.updatedCells) {
      state.outputResults.set(`${cell.col},${cell.row}`, cell.newValue);
      const row = state.rows[cell.row];
      const column = state.columns[cell.col];
      if (row && column) state.formulaResults.set(cellKey(row.__rowIdx, column.columnId), cell.newValue);
    }
  }

  canUndo(sheetName: string): boolean {
    return this.sheets.get(sheetName)?.history.canUndo ?? false;
  }

  canRedo(sheetName: string): boolean {
    return this.sheets.get(sheetName)?.history.canRedo ?? false;
  }

  undo(sheetName: string): void {
    const state = this.sheets.get(sheetName);
    if (!state) return;
    if (state.batchOpen) { state.batchOpen = false; state.history.endBatch(); }
    const ops = state.history.undo();
    if (!ops) return;
    state.rows = state.rows.slice();
    for (let i = ops.length - 1; i >= 0; i--) this.applyOp(state, ops[i] as Op, 'before');
    this.emit();
  }

  redo(sheetName: string): void {
    const state = this.sheets.get(sheetName);
    if (!state) return;
    const ops = state.history.redo();
    if (!ops) return;
    state.rows = state.rows.slice();
    for (const op of ops) this.applyOp(state, op, 'after');
    this.emit();
  }

  // ---- Cross-sheet reads -------------------------------------------------------

  /**
   * Formula-engine accessors for every sheet, reading the current grid state
   * of opened sheets and the workbook for the rest. Stable per document.
   */
  sheetAccessors(): Record<string, IGridDataAccessor> {
    if (this.accessors) return this.accessors;
    const accessors: Record<string, IGridDataAccessor> = Object.create(null);
    for (const worksheet of this.workbook.worksheets) {
      const name = worksheet.name;
      accessors[name] = {
        getCellValue: (col, row) => {
          const state = this.sheets.get(name);
          const offset = state?.source.formatting.headerPromoted ? 1 : 0;
          const dataRow = state ? state.rows[row - offset] : undefined;
          const column = state?.columns[col];
          const outputKey = `${col},${row - offset}`;
          const spilled = state?.spillRanges.some(r => col >= r.anchorCol && col <= r.endCol && row - offset >= r.anchorRow && row - offset <= r.endRow);
          if (state && spilled && state.outputResults.has(outputKey)) return state.outputResults.get(outputKey);
          if (state && dataRow && column) {
            const v = dataRow[column.columnId];
            const key = cellKey(dataRow.__rowIdx, column.columnId);
            if (!isFormulaText(v) && !spilled) return v;
            if (state.formulaResults.has(key)) return state.formulaResults.get(key);
          }
          return normalizeCellValue(worksheet.findRow(row + 1)?.findCell(col + 1)?.value);
        },
        getSpillRange: (col, row) => {
          const state = this.sheets.get(name);
          if (state) {
            const offset = state.source.formatting.headerPromoted ? 1 : 0;
            const spill = state.spillRanges.find(r => r.anchorCol === col && r.anchorRow === row - offset);
            return spill && { ...spill, anchorRow: spill.anchorRow + offset, endRow: spill.endRow + offset };
          }
          const value = worksheet.findRow(row + 1)?.findCell(col + 1)?.value;
          const range = value && typeof value === 'object' && 'formula' in value && 'shareType' in value && value.shareType === 'array' && 'ref' in value && typeof value.ref === 'string' ? parseRange(value.ref) : undefined;
          return range ? { anchorCol: range.start.col, anchorRow: range.start.row, endCol: range.end.col, endRow: range.end.row } : undefined;
        },
        getRowCount: () => {
          const state = this.sheets.get(name);
          return Math.max(worksheet.rowCount, ...(state?.spillRanges.map(r => r.endRow + 1 + (state.source.formatting.headerPromoted ? 1 : 0)) ?? []));
        },
        getColumnCount: () => Math.max(worksheet.columnCount, ...(this.sheets.get(name)?.spillRanges.map(r => r.endCol + 1) ?? [])),
      };
    }
    this.accessors = accessors;
    return accessors;
  }

  // ---- Export ------------------------------------------------------------------

  /**
   * Build the workbook to save: a copy of the source workbook with every
   * opened sheet's edits written back. All sheets are kept, in order, with
   * their names, tab colors, views, validations and everything else ExcelJS
   * round-trips. Formulas are written as formulas with the latest known result.
   */
  async toWorkbook(): Promise<ExcelJS.Workbook> {
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(await this.workbook.xlsx.writeBuffer());
    let valuesChanged = false;
    for (const state of this.sheets.values()) {
      const ws = out.getWorksheet(state.name);
      if (ws && this.writeSheet(state, ws)) valuesChanged = true;
    }
    // Unchanged formulas keep their cached results; have Excel recompute them.
    if (valuesChanged) out.calcProperties = { ...out.calcProperties, fullCalcOnLoad: true };
    return out;
  }

  async toBlob(): Promise<Blob> {
    const wb = await this.toWorkbook();
    return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME_TYPE });
  }

  /** Save as a downloaded .xlsx (browser only). */
  async download(filename = 'workbook.xlsx'): Promise<void> {
    triggerBlobDownload(await this.toBlob(), filename);
  }

  /** Returns true when any cell value changed. */
  private writeSheet(state: MutableSheetState, ws: ExcelJS.Worksheet): boolean {
    const offset = state.source.formatting.headerPromoted ? 1 : 0;
    const sheetRowOf = (index: number) => index + 1 + offset;
    const range = (b: { top: number; left: number; bottom: number; right: number }) =>
      [sheetRowOf(b.top), b.left + 1, sheetRowOf(b.bottom), b.right + 1] as const;

    // Merges first: writing into a merged-away cell would write its master.
    const mergesChanged = state.merges !== state.initialMerges;
    if (mergesChanged) {
      for (const m of state.initialMerges) {
        const b = this.mergeBounds(state, m);
        if (b.top >= 0 && b.left >= 0) ws.unMergeCells(...range(b));
      }
    }

    let valuesChanged = false;
    const resultsOnly: Array<[ExcelJS.Cell, unknown]> = [];
    state.rows.forEach((row, index) => {
      const initial = state.initialRows[index];
      const same = initial && initial.__rowIdx === row.__rowIdx ? initial : undefined;
      if (same === row) {
        for (const column of state.columns) {
          const key = cellKey(row.__rowIdx, column.columnId);
          if (isFormulaText(row[column.columnId]) && state.formulaResults.has(key)) {
            const cell = ws.findRow(sheetRowOf(index))?.findCell((state.columnIndex.get(column.columnId) ?? 0) + 1);
            if (cell) resultsOnly.push([cell, state.formulaResults.get(key)]);
          }
        }
        return;
      }
      state.columns.forEach((column, c) => {
        const value = row[column.columnId];
        const key = cellKey(row.__rowIdx, column.columnId);
        if (same && sameValue(value, same[column.columnId])) {
          if (isFormulaText(value) && state.formulaResults.has(key)) {
            const cell = ws.findRow(sheetRowOf(index))?.findCell(c + 1);
            if (cell) resultsOnly.push([cell, state.formulaResults.get(key)]);
          }
          return;
        }
        valuesChanged = true;
        const cell = ws.getCell(sheetRowOf(index), c + 1);
        detachSharedFormula(ws, cell);
        if (isFormulaText(value)) {
          const result = resultValue(state.formulaResults.get(key));
          cell.value = {
            formula: toFileFormula(rebaseFormulaRows(value, offset)),
            ...(result !== undefined ? { result } : {}),
          } as ExcelJS.CellFormulaValue;
        } else {
          cell.value = toCellValue(value);
        }
      });
    });

    // Refresh cached results of untouched formulas only when inputs changed.
    if (valuesChanged) {
      for (const [cell, result] of resultsOnly) {
        const v = cell.value;
        const r = resultValue(result);
        if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v) && r !== undefined) {
          cell.value = { ...(v as ExcelJS.CellFormulaValue), result: r } as ExcelJS.CellValue;
        }
      }
    }

    // Refresh all output caches, including children removed by a resize or
    // anchor deletion. Never turn a child into another formula.
    for (const [key, cached] of state.outputResults) {
      const [col = 0, row = 0] = key.split(',').map(Number);
      const columnId = state.columns[col]?.columnId;
      const raw = columnId ? state.rows[row]?.[columnId] : undefined;
      const output = ws.getCell(sheetRowOf(row), col + 1);
      if (!output.isMerged && !isFormulaText(raw) && (raw === '' || raw == null)) output.value = resultValue(cached) ?? null;
      // A recalculated array can become a scalar or #SPILL!. Its old file
      // extent must no longer claim the child cells (including obstructions).
      if (isFormulaText(raw) && !state.spillRanges.some(r => r.anchorCol === col && r.anchorRow === row)) {
        const result = resultValue(cached);
        const value = output.value;
        if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value) && !('shareType' in value && value.shareType === 'array')) {
          output.value = { ...value, result } as ExcelJS.CellValue;
        } else {
          output.value = { formula: toFileFormula(rebaseFormulaRows(raw, offset)), ...(result !== undefined ? { result } : {}) } as ExcelJS.CellFormulaValue;
        }
      }
    }
    for (const spill of state.spillRanges) {
      const row = state.rows[spill.anchorRow], column = state.columns[spill.anchorCol];
      if (!row || !column) continue;
      const formula = row[column.columnId];
      if (!isFormulaText(formula)) continue;
      const anchor = ws.getCell(sheetRowOf(spill.anchorRow), spill.anchorCol + 1);
      const end = ws.getCell(sheetRowOf(spill.endRow), spill.endCol + 1);
      const cached = resultValue(state.formulaResults.get(cellKey(row.__rowIdx, column.columnId)));
      anchor.value = {
        formula: toFileFormula(rebaseFormulaRows(formula, offset)),
        shareType: 'array', ref: `${anchor.address}:${end.address}`,
        ...(cached !== undefined ? { result: cached } : {}),
      } as ExcelJS.CellFormulaValue;
    }

    // Styles: rewrite only cells whose style object changed.
    const keys = new Set([...state.initialStyles.keys(), ...state.styles.keys()]);
    for (const key of keys) {
      const after = state.styles.get(key);
      if (after === state.initialStyles.get(key)) continue;
      const split = key.indexOf(':');
      const index = this.rowIndexOf(state, Number(key.slice(0, split)));
      const c = state.columnIndex.get(key.slice(split + 1));
      if (index < 0 || c === undefined) continue;
      ws.getCell(sheetRowOf(index), c + 1).style = after ? structuredClone(after) : {};
    }

    if (mergesChanged) {
      for (const m of state.merges) {
        const b = this.mergeBounds(state, m);
        if (b.top >= 0 && b.left >= 0) ws.mergeCellsWithoutStyle(...range(b));
      }
    }

    if (state.notes !== state.initialNotes) {
      writeSheetNotes(state.initialNotes, state.notes, (rowId, columnId) => {
        const index = this.rowIndexOf(state, rowId);
        const c = state.columnIndex.get(columnId);
        return index < 0 || c === undefined ? undefined : ws.getCell(sheetRowOf(index), c + 1);
      });
    }

    for (const [columnId, width] of Object.entries(state.columnWidths)) {
      if (state.initialWidths[columnId] === width) continue;
      const c = state.columnIndex.get(columnId);
      if (c !== undefined) ws.getColumn(c + 1).width = width;
    }

    for (const [rowId, height] of state.rowHeights) {
      if (state.initialRowHeights.get(rowId) === height) continue;
      const index = this.rowIndexOf(state, rowId);
      if (index >= 0) ws.getRow(sheetRowOf(index)).height = height;
    }
    return valuesChanged;
  }
}

/**
 * A shared-formula master is about to be overwritten: give its dependents
 * their own formula first, or they would point at a cell that no longer
 * defines the shared formula.
 */
function detachSharedFormula(ws: ExcelJS.Worksheet, cell: ExcelJS.Cell): void {
  const v = cell.value as (ExcelJS.CellFormulaValue & { shareType?: string; ref?: string }) | null;
  if (!v || typeof v !== 'object') return;
  if ('sharedFormula' in v) {
    const own = cell.formula;
    if (own) cell.value = { formula: own, result: (v as ExcelJS.CellSharedFormulaValue).result } as ExcelJS.CellFormulaValue;
    return;
  }
  if (v.shareType !== 'shared' || !v.ref) return;
  const [tl, br] = v.ref.split(':');
  const start = ws.getCell(tl as string);
  const end = br ? ws.getCell(br) : start;
  for (let r = Number(start.row); r <= Number(end.row); r++) {
    for (let c = Number(start.col); c <= Number(end.col); c++) {
      const dep = ws.findRow(r)?.findCell(c);
      const dv = dep?.value as ExcelJS.CellSharedFormulaValue | undefined;
      if (dep && dep !== cell && dv && typeof dv === 'object' && dv.sharedFormula === cell.address) {
        dep.value = { formula: dep.formula, result: dv.result } as ExcelJS.CellFormulaValue;
      }
    }
  }
  cell.value = { formula: v.formula, result: v.result } as ExcelJS.CellFormulaValue;
}
