import ExcelJS from 'exceljs';
import { copyDynamicArrays } from './sourceArchive';
import { indexToColumnLetter } from '@alaarab/ogrid-core';
import { adjustFormulaReferences, parseCellRef, shiftFormulaReferences, type StructureAxis } from '@alaarab/ogrid-core/formula';

/** ExcelJS's model getter calls this `merges`, but its setter reads `mergeCells`. */
export function cloneWorkbook(workbook: ExcelJS.Workbook): ExcelJS.Workbook {
  const model = structuredClone(workbook.model) as unknown as WorkbookModel;
  const out = workbookFromModel(model);
  copyDynamicArrays(workbook, out);
  return out;
}

function workbookFromModel(model: WorkbookModel): ExcelJS.Workbook {
  for (const sheet of model.worksheets) {
    sheet.mergeCells = sheet.merges;
  }
  const out = new ExcelJS.Workbook();
  out.model = model as unknown as ExcelJS.WorkbookModel;
  // ExcelJS also omits manual page breaks in its model setter.
  for (const sheet of model.worksheets) {
    const ws = out.getWorksheet(sheet.name) as unknown as { rowBreaks: ExcelJS.RowBreak[] };
    ws.rowBreaks = sheet.rowBreaks ?? [];
  }
  return out;
}

function columnNumber(text: string): number {
  let n = 0;
  for (const ch of text.replace(/\$/g, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

function move(n: number, at: number, count: number): number | null {
  if (n < at) return n;
  if (count < 0 && n < at - count) return null;
  return n + count;
}

function span(a: number, b: number, at: number, count: number): [number, number] | null {
  if (count > 0) return [a >= at ? a + count : a, b >= at ? b + count : b];
  const end = at - count;
  const low = a < at ? a : a >= end ? a + count : at;
  const high = b < at ? b : b >= end ? b + count : at - 1;
  return low <= high ? [low, high] : null;
}

/** A1 references, whole rows/columns, and sheet qualifiers; skip Excel strings and structured/external refs. */
const REFERENCES = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_.]*:[\p{L}_][\p{L}\p{N}_.]*![\w$]+(?:\s*:\s*[\w$]+)?|(?:'[^']*(?:''[^']*)*'|\[[^\]]+\][\w.]+)![\w$]+(?:\s*:\s*[\w$]+)?|\[[^\]]*\]|(?<![\w.])((?:'(?:[^']|'')+'|[\p{L}_\\][\p{L}\p{N}_.\\]*)!)?(\$?[A-Za-z]{1,3}\$?\d+(?:\s*:\s*\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}\s*:\s*\$?[A-Za-z]{1,3}|\$?\d+\s*:\s*\$?\d+)(?![\w.(]|\s*\()/gu;

/** Shift references to the edited sheet, including those in other sheets. `at` is 1-based. */
export function shiftWorkbookReferences(formula: string, owner: string, target: string, axis: StructureAxis, at: number, count: number): string {
  return formula.replace(REFERENCES, (match, qualifier: string | undefined, ref: string | undefined) => {
    // Quoted qualifiers are handled below too; external workbook qualifiers stay opaque.
    if (ref === undefined) {
      const quoted = /^('(?:[^']|'')+')!([\w$]+(?:\s*:\s*[\w$]+)?)$/.exec(match);
      if (!quoted || quoted[1]?.includes('[')) return match;
      qualifier = `${quoted[1]}!`;
      ref = quoted[2];
    }
    if (!ref) return match;
    const name = qualifier ? qualifier.slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'") : owner;
    if (name.toLowerCase() !== target.toLowerCase()) return match;
    const whole = /^(\$?[A-Za-z]+|\$?\d+)\s*:\s*(\$?[A-Za-z]+|\$?\d+)$/.exec(ref);
    if (whole) {
      const isCol = /[A-Za-z]/.test(whole[1] as string);
      if ((axis === 'col') !== isCol) return match;
      const a = isCol ? columnNumber(whole[1] as string) : Number(whole[1]?.replace('$', ''));
      const b = isCol ? columnNumber(whole[2] as string) : Number(whole[2]?.replace('$', ''));
      const next = span(Math.min(a, b), Math.max(a, b), at, count);
      if (!next) return `${qualifier ?? ''}#REF!`;
      const format = (n: number, original: string) => `${original.startsWith('$') ? '$' : ''}${isCol ? indexToColumnLetter(n - 1) : n}`;
      return `${qualifier ?? ''}${format(next[a <= b ? 0 : 1], whole[1] as string)}:${format(next[a <= b ? 1 : 0], whole[2] as string)}`;
    }
    // A name like LOG10 is only an address inside Excel's actual column range.
    if (ref.split(':').some((s) => columnNumber(s.trim().replace(/\$?\d+$/, '')) > 16384)) return match;
    return `${qualifier ?? ''}${shiftFormulaReferences(ref, axis, at - 1, count)}`;
  });
}

interface SheetModel extends ExcelJS.WorksheetModel {
  rows: Array<Omit<ExcelJS.RowModel, 'cells'> & { cells: Array<Omit<ExcelJS.CellModel, 'address'> & { address: string; shareType?: 'shared' | 'array'; ref?: string }> }>;
  cols?: Array<{ min: number; max: number }>;
  dataValidations: Record<string, ExcelJS.DataValidation>;
  conditionalFormattings: ExcelJS.ConditionalFormattingOptions[];
  mergeCells: string[];
}

type WorkbookModel = Omit<ExcelJS.WorkbookModel, 'worksheets'> & { worksheets: SheetModel[] };

function forEachAddress(ref: string, visit: (address: string) => void): void {
  for (const range of ref.split(/\s+/)) {
    const [a, b = a] = range.split(':');
    const start = parseCellRef(a ?? '');
    const end = parseCellRef(b ?? '');
    if (!start || !end) continue;
    for (let row = start.row; row <= end.row; row++) {
      for (let col = start.col; col <= end.col; col++) visit(`${indexToColumnLetter(col)}${row + 1}`);
    }
  }
}

/** Recover the rectangles ExcelJS serializes, whose anchor is lost when it reads sqref. */
function validationRanges(model: SheetModel['dataValidations']): Array<[string, ExcelJS.DataValidation]> {
  const marked = new Set<string>();
  const signatures = new Map(Object.entries(model).map(([address, rule]) => [address, JSON.stringify(rule)]));
  const ranges: Array<[string, ExcelJS.DataValidation]> = [];
  for (const address of Object.keys(model).sort()) {
    if (marked.has(address)) continue;
    const rule = model[address] as ExcelJS.DataValidation;
    const start = parseCellRef(address);
    if (!start) { ranges.push([address, rule]); continue; }
    const same = (col: number, row: number) => signatures.get(`${indexToColumnLetter(col)}${row + 1}`) === signatures.get(address);
    let bottom = start.row;
    while (same(start.col, bottom + 1)) bottom++;
    let right = start.col;
    const matchesColumn = (col: number) => {
      for (let row = start.row; row <= bottom; row++) if (!same(col, row)) return false;
      return true;
    };
    while (matchesColumn(right + 1)) right++;
    const end = `${indexToColumnLetter(right)}${bottom + 1}`;
    const ref = end === address ? address : `${address}:${end}`;
    forEachAddress(ref, (cell) => marked.add(cell));
    ranges.push([ref, rule]);
  }
  return ranges;
}

/** Rebuild sparse cell models instead of relying on ExcelJS's incomplete splices. */
export function editWorkbookStructure(workbook: ExcelJS.Workbook, target: string, axis: StructureAxis, at: number, count: number): ExcelJS.Workbook {
  const out = cloneWorkbook(workbook);
  // Expand shared formulas before their masters or dependent coordinates move.
  for (const sheet of out.worksheets) {
    const formulas: Array<[ExcelJS.Cell, ExcelJS.CellFormulaValue]> = [];
    sheet.eachRow((row) => row.eachCell((cell) => {
      const v = cell.value;
      if (v && typeof v === 'object' && (('formula' in v && 'shareType' in v && v.shareType === 'shared') || 'sharedFormula' in v)) {
        let formula = 'formula' in v ? v.formula : undefined;
        if ('sharedFormula' in v) {
          const master = sheet.getCell(v.sharedFormula);
          const origin = parseCellRef(v.sharedFormula);
          const position = parseCellRef(cell.address);
          try {
            if (!origin || !position || !master.formula) throw new Error('Missing master');
            formula = adjustFormulaReferences(master.formula, position.col - origin.col, position.row - origin.row, true);
          } catch (error) {
            throw new Error(`Cannot translate shared formula at ${sheet.name}!${cell.address}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        formulas.push([cell, { formula: formula ?? cell.formula, result: v.result } as ExcelJS.CellFormulaValue]);
      }
    }));
    for (const [cell, value] of formulas) cell.value = value;
  }
  const model = out.model as unknown as WorkbookModel;
  for (const sheet of model.worksheets) {
    const edited = sheet.name === target;
    const shift = (f: string) => shiftWorkbookReferences(f, sheet.name, target, axis, at, count);
    const area = (ref: string) => shift(ref).split(/\s+/).filter((s) => !s.includes('#REF!')).join(' ');
    sheet.rows = sheet.rows.flatMap((row) => {
      const r = edited && axis === 'row' ? move(row.number, at, count) : row.number;
      if (r === null) return [];
      row.number = r;
      row.cells = row.cells.flatMap((cell) => {
        const c = columnNumber(cell.address.replace(/\d+$/, ''));
        const col = edited && axis === 'col' ? move(c, at, count) : c;
        if (col === null) return [];
        cell.address = `${indexToColumnLetter(col - 1)}${r}`;
        if (cell.formula) cell.formula = shift(cell.formula);
        if (edited && cell.shareType === 'array' && cell.ref) cell.ref = shift(cell.ref);
        if (edited && cell.type === ExcelJS.ValueType.Merge) {
          cell.type = ExcelJS.ValueType.Null;
          (cell as { master?: string }).master = undefined;
        }
        if (cell.hyperlink?.startsWith('#')) cell.hyperlink = `#${shift(cell.hyperlink.slice(1))}`;
        return [cell];
      });
      return [row];
    });
    // Rule formulas are relative to sqref's first cell. If that cell is deleted,
    // copy the formula to the first survivor in its old position before shifting.
    const ruleFormula = (formula: string, ref: string, next: string) => {
      if (!edited || count > 0) return shift(formula);
      const origin = parseCellRef(ref.split(/[ :]/)[0] ?? '');
      const survivor = parseCellRef(next.split(/[ :]/)[0] ?? '');
      if (!origin || !survivor) return shift(formula);
      const key = axis === 'row' ? 'row' : 'col';
      if (survivor[key] >= at - 1) survivor[key] -= count;
      return shift(adjustFormulaReferences(formula, survivor.col - origin.col, survivor.row - origin.row, true));
    };
    const validations: SheetModel['dataValidations'] = {};
    for (const [ref, rule] of validationRanges(sheet.dataValidations ?? {})) {
      const next = edited ? area(ref) : ref;
      if (!next) continue;
      const rebased = { ...rule, formulae: rule.formulae?.map((f: unknown) => typeof f === 'string' ? ruleFormula(f, ref, next) : f) };
      forEachAddress(next, (address) => { validations[address] = rebased; });
    }
    sheet.dataValidations = validations;
    sheet.conditionalFormattings = (sheet.conditionalFormattings ?? []).flatMap((cf) => {
      const ref = edited ? area(cf.ref) : cf.ref;
      if (!ref) return [];
      return [{ ...cf, ref, rules: cf.rules.map((rule) => {
        const withFormula = rule as ExcelJS.ConditionalFormattingRule & { formulae?: unknown[]; cfvo?: Array<{ type: string; value?: string | number }> };
        return {
          ...rule,
          ...(withFormula.formulae ? { formulae: withFormula.formulae.map((f) => typeof f === 'string' ? ruleFormula(f, cf.ref, ref) : f) } : {}),
          ...(withFormula.cfvo ? { cfvo: withFormula.cfvo.map((value) => ({
            ...value, value: value.type === 'formula' && typeof value.value === 'string' ? ruleFormula(value.value, cf.ref, ref) : value.value,
          })) } : {}),
        } as unknown as ExcelJS.ConditionalFormattingRule; // ExcelJS typings omit string-valued formula cfvo entries.
      }) }];
    });
    if (edited) {
      sheet.merges = sheet.merges.map(area).filter((r) => r.includes(':') && r.split(':')[0] !== r.split(':')[1]);
      if (axis === 'col') sheet.cols = sheet.cols?.flatMap((col) => {
        // Column properties follow existing columns; inserted columns start with defaults.
        const pieces: Array<typeof col> = [];
        for (let c = col.min; c <= col.max; c++) {
          const next = move(c, at, count);
          if (next !== null) pieces.push({ ...col, min: next, max: next });
        }
        return pieces;
      });
      sheet.views = (sheet.views ?? []).map((view) => {
        if (view.state !== 'frozen') return view;
        const key = axis === 'row' ? 'ySplit' : 'xSplit';
        const split = view[key] ?? 0;
        const boundary = count > 0 ? split + (at <= split ? count : 0) : split - Math.max(0, Math.min(-count, split - at + 1));
        const topLeftCell = view.topLeftCell ? area(view.topLeftCell) : undefined;
        return { ...view, [key]: boundary, topLeftCell: topLeftCell || undefined };
      });
      if (typeof sheet.autoFilter === 'string') sheet.autoFilter = area(sheet.autoFilter);
      if (sheet.pageSetup.printArea) sheet.pageSetup.printArea = sheet.pageSetup.printArea.split('&&').map(area).filter(Boolean).join('&&');
      if (sheet.pageSetup.printTitlesRow) sheet.pageSetup.printTitlesRow = area(sheet.pageSetup.printTitlesRow);
      if (sheet.pageSetup.printTitlesColumn) sheet.pageSetup.printTitlesColumn = area(sheet.pageSetup.printTitlesColumn);
      if (axis === 'row') sheet.rowBreaks = (sheet.rowBreaks ?? []).flatMap((rowBreak) => {
        const id = move(rowBreak.id, at, count);
        return id === null ? [] : [{ ...rowBreak, id }];
      });
    }
    sheet.mergeCells = sheet.merges;
  }
  model.definedNames = model.definedNames.map((name) => ({
    ...name,
    ranges: name.ranges.map((ref) => shiftWorkbookReferences(ref, '', target, axis, at, count)).filter((ref) => !ref.includes('#REF!')),
  })).filter((name) => name.ranges.length > 0);
  const result = workbookFromModel(model);
  copyDynamicArrays(workbook, result, (name, address) => shiftWorkbookReferences(address, name, target, axis, at, count));
  result.calcProperties = { ...result.calcProperties, fullCalcOnLoad: true };
  return result;
}
