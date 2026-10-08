// ExcelJS validations are a sparse address/range map, omitted from its public
// Worksheet typings. Keep source workbook rules intact until the user changes
// validation, then replace only rules on loaded data cells.
import type ExcelJS from 'exceljs';
import { indexToColumnLetter, replaceDataValidationRange, validationDateSerial } from '@alaarab/ogrid-core';
import type { IDataValidationRule, IDataValidationChange, DataValidationOperator, IGridDataAccessor } from '@alaarab/ogrid-core';
import { adjustFormulaReferences, columnLetterToIndex, tokenize, FormulaEngine, FormulaError } from '@alaarab/ogrid-core/formula';
import { normalizeFormula, rebaseFormulaRows, toFileFormula } from './formulaReferences';
import { normalizeCellValue } from './sheetMapper';
import type { SheetRow } from './sheetMapper';

/** Enumerable so workbook model clones and structural undo retain the original sqref anchor. */
export type AnchoredValidation = ExcelJS.DataValidation & { showDropDown?: boolean; _ogridOrigin?: { col: number; row: number } };
export function validationOrigin(rule: ExcelJS.DataValidation): { col: number; row: number } | undefined {
  return (rule as AnchoredValidation)._ogridOrigin;
}

interface ValidationMap { model: Record<string, ExcelJS.DataValidation | undefined> }
function validations(sheet: ExcelJS.Worksheet): ValidationMap {
  return (sheet as unknown as { dataValidations: ValidationMap }).dataValidations;
}
interface Box { top: number; bottom: number; left: number; right: number }
function boxOf(ref: string): Box | undefined {
  const m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(ref);
  if (!m) return undefined;
  const c = columnLetterToIndex(m[1] ?? ''), d = columnLetterToIndex(m[3] ?? m[1] ?? '');
  const r = Number(m[2]), s = Number(m[4] ?? m[2]);
  return { top: Math.min(r, s), bottom: Math.max(r, s), left: Math.min(c, d), right: Math.max(c, d) };
}
function refOf(b: Box): string {
  const a = `${indexToColumnLetter(b.left)}${b.top}`, z = `${indexToColumnLetter(b.right)}${b.bottom}`;
  return a === z ? a : `${a}:${z}`;
}
function supported(type: string): boolean { return ['list', 'whole', 'decimal', 'date', 'time', 'textLength', 'custom'].includes(type); }
export interface ValidationLayout { headerPromoted: boolean; columnCount: number; rowCount: number }

/** Header references stay in worksheet coordinates; other local refs become grid rows. */
function fromFileFormula(value: string, offset: number, sheetName: string): string {
  let formula = normalizeFormula(value);
  if (offset) {
    const insertions: number[] = [];
    let tokens: ReturnType<typeof tokenize>;
    try { tokens = tokenize(formula.slice(1)); } catch { return formula; }
    let qualified = false;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      if (token.type === 'SHEET_REF') { qualified = true; continue; }
      if (token.type === 'COLON') continue;
      if (token.type === 'CELL_REF') {
        if (!qualified && Number(/\d+$/.exec(token.value)?.[0]) <= offset) {
          insertions.push(token.position + 1);
          qualified = true;
        }
        if (tokens[i + 1]?.type !== 'COLON') qualified = false;
      } else qualified = false;
    }
    for (const at of insertions.reverse()) formula = formula.slice(0, at) + `'${sheetName.replace(/'/g, "''")}'!` + formula.slice(at);
  }
  return rebaseFormulaRows(formula, -offset);
}
function ruleOf(dv: ExcelJS.DataValidation, columnIds: string[], rows: { start: number; end: number }, offset: number, sheetName: string, date1904: boolean): IDataValidationRule<SheetRow> | undefined {
  if (!supported(dv.type)) return undefined;
  const style = dv.errorStyle === 'warning' ? 'warning' : dv.errorStyle === 'information' ? 'information' : 'stop';
  const base = {
    columnIds, rows, allowBlank: dv.allowBlank === true,
    inputMessage: { title: dv.promptTitle, text: dv.prompt ?? '', show: dv.showInputMessage === true },
    errorAlert: { style, title: dv.errorTitle, message: dv.error, show: dv.showErrorMessage === true },
  } as const;
  const first: unknown = dv.formulae?.[0];
  if (dv.type === 'list') {
    const source = String(first ?? '');
    return { ...base, type: 'list', inCellDropdown: !(dv as AnchoredValidation).showDropDown, ...(source.startsWith('"') ? { values: source.slice(1, -1).replace(/""/g, '"').split(',') } : { source }) };
  }
  if (dv.type === 'custom') return { ...base, type: 'custom', formula: fromFileFormula(String(first ?? ''), offset, sheetName) };
  const bound = (v: unknown): number | string => {
    // Invert ExcelJS's date-bound decoder to preserve the actual XML serial,
    // including serials before March 1900.
    if (v instanceof Date) return v.getTime() / 86400000 + 25569 + (date1904 && dv.type === 'date' ? 1462 : 0);
    if (typeof v === 'number') return v + (date1904 && dv.type === 'date' ? 1462 : 0);
    const s = String(v ?? '');
    if (s.trim() !== '' && Number.isFinite(Number(s))) return Number(s) + (date1904 && dv.type === 'date' ? 1462 : 0);
    return fromFileFormula(s, offset, sheetName);
  };
  return { ...base, type: dv.type as 'whole' | 'decimal' | 'date' | 'time' | 'textLength', operator: dv.operator ?? 'between', value: bound(first), ...(dv.formulae?.[1] !== undefined ? { value2: bound(dv.formulae[1]) } : {}) };
}

/** Restrict rules to loaded cells; ExcelJS shares one object per original sqref, preserving its anchor. */
export function readDataValidations(sheet: ExcelJS.Worksheet, layout: ValidationLayout): IDataValidationRule<SheetRow>[] {
  const offset = layout.headerPromoted ? 1 : 0;
  const groups = new Map<ExcelJS.DataValidation, { dv: ExcelJS.DataValidation; byCol: Map<number, { start: number; end: number }[]>; origin: { col: number; row: number } }>();
  const origins = new Map<ExcelJS.DataValidation, { col: number; row: number }>();
  for (const [refs, dv] of Object.entries(validations(sheet).model)) {
    if (!dv) continue;
    for (const ref of refs.split(/\s+/)) {
      const box = boxOf(ref), origin = origins.get(dv);
      if (box && (!origin || box.top - offset - 1 < origin.row || (box.top - offset - 1 === origin.row && box.left < origin.col))) origins.set(dv, { col: box.left, row: box.top - offset - 1 });
    }
  }
  for (const [refs, dv] of Object.entries(validations(sheet).model)) {
    if (!dv || !supported(dv.type)) continue;
    const key = dv;
    const storedOrigin = validationOrigin(dv);
    let group = groups.get(key);
    for (const ref of refs.split(/\s+/)) {
      const b = boxOf(ref);
      if (!b || b.bottom <= offset || b.top > layout.rowCount + offset || b.left >= layout.columnCount) continue;
      if (!group) { group = { dv, byCol: new Map(), origin: storedOrigin ? { col: storedOrigin.col, row: storedOrigin.row - offset } : origins.get(dv) ?? { col: b.left, row: b.top - offset - 1 } }; groups.set(key, group); }
      for (let c = b.left; c <= Math.min(b.right, layout.columnCount - 1); c++) {
        const ranges = group.byCol.get(c) ?? [];
        ranges.push({ start: Math.max(0, b.top - offset - 1), end: Math.min(layout.rowCount - 1, b.bottom - offset - 1) });
        group.byCol.set(c, ranges);
      }
    }
  }
  const out: IDataValidationRule<SheetRow>[] = [];
  for (const group of groups.values()) {
    const rectangles = new Map<string, { rows: { start: number; end: number }; columns: string[] }>();
    for (const [col, intervals] of group.byCol) {
      const merged: { start: number; end: number }[] = [];
      for (const interval of intervals.sort((a, b) => a.start - b.start)) {
        const prev = merged[merged.length - 1];
        if (prev && interval.start <= prev.end + 1) prev.end = Math.max(prev.end, interval.end);
        else merged.push({ ...interval });
      }
      for (const rows of merged) {
        const key = `${rows.start}:${rows.end}`;
        const box = rectangles.get(key) ?? { rows, columns: [] };
        box.columns.push(indexToColumnLetter(col)); rectangles.set(key, box);
      }
    }
    for (const box of rectangles.values()) {
      const rule = ruleOf(group.dv, box.columns.sort((a, b) => columnLetterToIndex(a) - columnLetterToIndex(b)), box.rows, offset, sheet.name, sheet.workbook.properties.date1904 === true);
      if (rule) out.push({ ...rule, id: `xlsx-validation-${out.length}`, anchor: { columnId: indexToColumnLetter(group.origin.col), row: group.origin.row } });
    }
  }
  return out;
}

/** Resolve list sources against live workbook accessors, including header rows and defined names. */
export function validationSourceResolver(sheet: ExcelJS.Worksheet, accessors: Record<string, IGridDataAccessor>, rowOffset = 0): (source: string, anchor?: { col: number; row: number }, cell?: { col: number; row: number }, changes?: readonly IDataValidationChange[]) => unknown[] | undefined {
  let sourceEngine: FormulaEngine | undefined;
  const workbookAccessor = (target: ExcelJS.Worksheet): IGridDataAccessor => accessors[target.name] ?? {
    getCellValue: (col, row) => normalizeCellValue(target.findRow(row + 1)?.findCell(col + 1)?.value),
    getRowCount: () => target.rowCount, getColumnCount: () => target.columnCount,
  };
  return (source, anchor, cell, changes) => {
    let ref = source.trim().replace(/^=/, '');
    const named = sheet.workbook.definedNames.getRanges(ref)?.ranges;
    if (named?.length) ref = named[0] ?? ref;
    else if (anchor && cell) ref = adjustFormulaReferences(ref, cell.col - anchor.col, cell.row - anchor.row);
    // Lists retain worksheet coordinates, including promoted headers. The
    // detached evaluator reads ranges and expressions through the same overlay.
    if (!sourceEngine) {
      sourceEngine = new FormulaEngine({ namedRanges: Object.fromEntries(sheet.workbook.definedNames.model.map((n) => [n.name, n.ranges[0] ?? ''])), limits: { maxRangeCells: 100000 } });
      for (const target of sheet.workbook.worksheets) sourceEngine.registerSheet(target.name, workbookAccessor(target));
    }
    const position = { col: cell?.col ?? 0, row: (cell?.row ?? 0) + rowOffset };
    const result = sourceEngine.createDetachedEvaluator(workbookAccessor(sheet), { preserveArrays: true, sheet: { name: sheet.name, rowOffset: 0 }, changes: changes?.map(change => ({ ...change, row: change.row + rowOffset })) })(`=${ref}`, position, position);
    if (result instanceof FormulaError) return [];
    return (Array.isArray(result) ? result.flat(Infinity) : [result]).filter((value) => value != null && value !== '');
  };
}

function subtractBox(b: Box, cut: Box): Box[] {
  if (b.bottom < cut.top || b.top > cut.bottom || b.right < cut.left || b.left > cut.right) return [b];
  const out: Box[] = [];
  if (b.top < cut.top) out.push({ ...b, bottom: cut.top - 1 });
  if (b.bottom > cut.bottom) out.push({ ...b, top: cut.bottom + 1 });
  const top = Math.max(b.top, cut.top), bottom = Math.min(b.bottom, cut.bottom);
  if (b.left < cut.left) out.push({ ...b, top, bottom, right: cut.left - 1 });
  if (b.right > cut.right) out.push({ ...b, top, bottom, left: cut.right + 1 });
  return out;
}

/** Replace loaded validation cells, preserving header/out-of-limit originals and unsupported rules. */
export function writeDataValidations(sheet: ExcelJS.Worksheet, rules: IDataValidationRule<SheetRow>[], layout: ValidationLayout, items?: SheetRow[]): void {
  const offset = layout.headerPromoted ? 1 : 0;
  const model = validations(sheet).model;
  const loaded = { top: offset + 1, bottom: offset + layout.rowCount, left: 0, right: layout.columnCount - 1 };
  const origins = new Map<ExcelJS.DataValidation, Box>();
  for (const [refs, dv] of Object.entries(model)) {
    if (!dv) continue;
    for (const ref of refs.split(/\s+/)) {
      const box = boxOf(ref), prev = origins.get(dv);
      if (box && (!prev || box.top < prev.top || (box.top === prev.top && box.left < prev.left))) origins.set(dv, box);
    }
  }
  for (const [refs, dv] of Object.entries(model)) {
    if (!dv || !supported(dv.type)) continue;
    delete model[refs];
    for (const ref of refs.split(/\s+/)) {
      const b = boxOf(ref);
      if (!b) { model[ref] = dv; continue; }
      for (const rest of subtractBox(b, loaded)) {
        const stored = validationOrigin(dv);
        const origin = stored ? { left: stored.col, top: stored.row + 1 } : origins.get(dv) ?? b;
        model[refOf(rest)] = { ...dv, _ogridOrigin: { col: rest.left, row: rest.top - 1 }, formulae: dv.formulae?.map((v: unknown) => typeof v === 'string' && !v.startsWith('"') ? adjustFormulaReferences(v, rest.left - origin.left, rest.top - origin.top) : v) } as AnchoredValidation;
      }
    }
  }
  let effective: IDataValidationRule<SheetRow>[] = [];
  for (const rule of rules) {
    const start = Math.max(0, rule.rows?.start ?? 0), end = Math.min(layout.rowCount - 1, rule.rows?.end ?? layout.rowCount - 1);
    if (!rule.rowFilter) effective = replaceDataValidationRange(effective, rule.columnIds, { start, end }, rule);
    else {
      if (!items) throw new Error('XLSX validation export with rowFilter requires the sheet rows.');
      for (let row = start; row <= end; row++) {
        const item = items[row];
        if (item !== undefined && rule.rowFilter(item, row)) effective = replaceDataValidationRange(effective, rule.columnIds, { start: row, end: row }, { ...rule, rowFilter: undefined, anchor: rule.anchor ?? { columnId: rule.columnIds[0] ?? 'A', row: start } });
      }
    }
  }
  for (const rule of effective) {
    const listSource = rule.type === 'list' && rule.values ? inlineListSource(sheet, rule.values) : undefined;
    const start = Math.max(0, rule.rows?.start ?? 0), end = Math.min(layout.rowCount - 1, rule.rows?.end ?? layout.rowCount - 1);
    if (start > end) continue;
    const anchor = rule.anchor ?? { columnId: rule.columnIds[0] ?? 'A', row: rule.rows?.start ?? 0 };
    for (const columnId of rule.columnIds) {
      const col = columnLetterToIndex(columnId);
      if (col < 0 || col >= layout.columnCount) continue;
      const formula = (v: number | string | undefined): number | string | undefined => {
        if (typeof v !== 'string' || !v.startsWith('=')) return v;
        return toFileFormula(rebaseFormulaRows(adjustFormulaReferences(v, col - columnLetterToIndex(anchor.columnId), start - anchor.row), offset));
      };
      let formulae: unknown[] = rule.type === 'list' ? [rule.values ? listSource : adjustFormulaReferences(rule.source?.replace(/^=/, '') ?? '', col - columnLetterToIndex(anchor.columnId), start - anchor.row)]
        : rule.type === 'custom' ? [formula(rule.formula)] : [formula(rule.value), ...(rule.value2 !== undefined ? [formula(rule.value2)] : [])];
      if (rule.type === 'time') formulae = formulae.map((v) => {
        if (typeof v !== 'string') return v;
        const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(v);
        return clock ? (Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0)) / 86400 : v;
      });
      if (rule.type === 'date') {
        formulae = formulae.map((value, i) => {
          // Formula bodies must remain strings; literals use the core's 1900 system.
          const bound = i ? rule.value2 : rule.value;
          if (typeof bound === 'string' && bound.startsWith('=')) return value;
          const serial = validationDateSerial(bound);
          return Number.isFinite(serial) ? new Date((serial - (sheet.workbook.properties.date1904 ? 1462 : 0) - 25569) * 86400000) : value;
        });
      }
      const dv = {
        type: rule.type, formulae, _ogridOrigin: { col, row: start + offset },
        ...(rule.type === 'list' ? { showDropDown: rule.inCellDropdown === false } : {}),
        allowBlank: rule.allowBlank === true,
        ...('operator' in rule ? { operator: rule.operator as DataValidationOperator } : {}),
        showInputMessage: rule.inputMessage?.show !== false && !!rule.inputMessage?.text,
        promptTitle: rule.inputMessage?.title, prompt: rule.inputMessage?.text,
        showErrorMessage: rule.errorAlert?.show !== false,
        errorStyle: rule.errorAlert?.style === 'stop' || !rule.errorAlert ? 'stop' : rule.errorAlert.style,
        errorTitle: rule.errorAlert?.title, error: rule.errorAlert?.message,
      } as ExcelJS.DataValidation;
      model[refOf({ left: col, right: col, top: start + offset + 1, bottom: end + offset + 1 })] = dv;
    }
  }
  preserveDataValidationSerialization(sheet.workbook);
}

/** Excel inline lists cannot escape delimiters and are limited to 255 characters. */
function inlineListSource(sheet: ExcelJS.Worksheet, values: readonly unknown[]): string {
  const strings = values.map(String), inline = `"${strings.join(',')}"`;
  if (inline.length <= 257 && strings.every(v => !/[,;"\r\n]/.test(v))) return inline;
  const workbook = sheet.workbook;
  let name = '_OGridValidation', suffix = 0;
  while (workbook.getWorksheet(name)) name = `_OGridValidation${++suffix}`;
  const source = workbook.addWorksheet(name, { state: 'veryHidden' });
  strings.forEach((value, row) => { source.getCell(row + 1, 1).value = value; });
  const definedName = `${name}_List`;
  workbook.definedNames.add(`'${name}'!$A$1:$A$${strings.length}`, definedName);
  return definedName;
}

const serializationInstalled = new WeakSet<ExcelJS.Workbook>();
/** Keep ExcelJS's workbook API, bypassing its lossy bound conversion in the saved XML. */
export function preserveDataValidationSerialization(workbook: ExcelJS.Workbook): void {
  if (serializationInstalled.has(workbook)) return;
  serializationInstalled.add(workbook);
  const writeBuffer = workbook.xlsx.writeBuffer.bind(workbook.xlsx);
  workbook.xlsx.writeBuffer = async (options) => {
    const bytes = await writeBuffer(options);
    if (!workbook.worksheets.some(sheet => Object.keys(validations(sheet).model).length)) return bytes;
    const { writeValidationXml } = await import('./ooxmlDataValidations');
    return await writeValidationXml(workbook, bytes as unknown as Uint8Array) as unknown as ExcelJS.Buffer;
  };
}
