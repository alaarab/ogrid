// Excel conditional formats → OGrid's conditional format rules.
//
// Read-only mapping: the workbook keeps its own conditional formats, which
// export writes back exactly as ExcelJS read them (see xlsxDocument.ts).
// Rules OGrid can't model (unknown icon sets, formula-valued scale ends,
// ExcelJS-unparsed kinds) are skipped, not approximated.
//
// Coordinates: an Excel rule covers `ref` ranges in worksheet rows; the grid
// shows data rows, one row lower when row 1 was promoted to the header. Rule
// formulas are written for the range's top-left cell and are rebased onto the
// grid's A1 rows (row 1 = first data row), which is what the grid's formula
// engine evaluates.

import type ExcelJS from 'exceljs';
import type {
  ConditionalFormatDatePeriod,
  ConditionalFormatIconSet,
  ConditionalFormatOperator,
  IColorScaleStop,
  IConditionalFormatRule,
  IConditionalFormatStyle,
  IConditionalFormatValueBound,
} from '@alaarab/ogrid-core';
import { adjustFormulaReferences, columnLetterToIndex } from '@alaarab/ogrid-core/formula';
import { indexToColumnLetter } from '@alaarab/ogrid-core';
import { colorToCss, DEFAULT_THEME_PALETTE, type ThemePalette } from './cellStyles';
import { normalizeFormula, rebaseFormulaRows } from './formulaReferences';
import type { SheetRow } from './sheetMapper';

/** Where the sheet's grid sits in the worksheet. */
export interface ConditionalFormatLayout {
  /** Row 1 became the column headers (grid row 0 is worksheet row 2). */
  headerPromoted: boolean;
  /** Columns the grid shows (A.. up to this many). */
  columnCount: number;
  /** Data rows the grid shows. */
  rowCount: number;
}

/** ExcelJS's parsed cfRule (its typings miss several fields it reads). */
interface RawRule {
  type: string;
  operator?: string;
  priority?: number;
  stopIfTrue?: boolean;
  formulae?: Array<string | number>;
  style?: Partial<ExcelJS.Style>;
  rank?: number;
  percent?: boolean;
  bottom?: boolean;
  aboveAverage?: boolean;
  timePeriod?: string;
  text?: string;
  cfvo?: Array<{ type: string; value?: number }>;
  color?: Partial<ExcelJS.Color> | Array<Partial<ExcelJS.Color>>;
  gradient?: boolean;
  iconSet?: string;
  reverse?: boolean;
  showValue?: boolean;
}

interface Box { top: number; left: number; bottom: number; right: number }

const RANGE_RE = /^\$?([A-Z]{1,3})(?:\$?(\d+))?(?::\$?([A-Z]{1,3})(?:\$?(\d+))?)?$/i;

/** Parse one sqref range ("B2:D9", "C5", "B:B") into 1-based worksheet coordinates. */
function parseRange(ref: string): Box | null {
  const m = RANGE_RE.exec(ref.trim());
  if (!m) return null;
  const left = columnLetterToIndex((m[1] as string).toUpperCase()) + 1;
  const right = m[3] ? columnLetterToIndex(m[3].toUpperCase()) + 1 : left;
  const top = m[2] ? Number(m[2]) : 1;
  const bottom = m[4] ? Number(m[4]) : m[3] && !m[4] ? 1048576 : top;
  return { top: Math.min(top, bottom), left: Math.min(left, right), bottom: Math.max(top, bottom), right: Math.max(left, right) };
}

function styleOf(style: Partial<ExcelJS.Style> | undefined, palette: ThemePalette): IConditionalFormatStyle {
  const out: IConditionalFormatStyle = {};
  const fill = style?.fill as (ExcelJS.FillPattern & { bgColor?: Partial<ExcelJS.Color> }) | undefined;
  if (fill && fill.type === 'pattern' && fill.pattern !== 'none') {
    // Differential fills keep a solid fill's color in bgColor.
    const bg = colorToCss(fill.bgColor, palette) ?? colorToCss(fill.fgColor, palette);
    if (bg) out.background = bg;
  }
  const font = style?.font;
  if (font) {
    const color = colorToCss(font.color, palette);
    if (color) out.color = color;
    if (font.bold !== undefined) out.bold = !!font.bold;
    if (font.italic !== undefined) out.italic = !!font.italic;
    if (font.underline) out.underline = true;
    if (font.strike) out.strikethrough = true;
  }
  const border = style?.border;
  if (border) {
    for (const side of [border.top, border.left, border.bottom, border.right]) {
      const c = side?.style ? colorToCss(side.color, palette) ?? '#000000' : undefined;
      if (c) { out.border = c; break; }
    }
  }
  return out;
}

function boundOf(cfvo: { type: string; value?: number } | undefined, fallback: 'min' | 'max'): IConditionalFormatValueBound | null {
  if (!cfvo) return { type: fallback };
  switch (cfvo.type) {
    case 'min':
    case 'autoMin': return { type: 'min' };
    case 'max':
    case 'autoMax': return { type: 'max' };
    case 'num': return { type: 'number', value: cfvo.value ?? 0 };
    case 'percent': return { type: 'percent', value: cfvo.value ?? 0 };
    case 'percentile': return { type: 'percentile', value: cfvo.value ?? 50 };
    default: return null; // formula-valued ends are not modeled
  }
}

const ICON_SETS: Record<string, ConditionalFormatIconSet> = {
  '3Arrows': '3Arrows',
  '3ArrowsGray': '3Arrows',
  '3TrafficLights1': '3TrafficLights',
  '3TrafficLights2': '3TrafficLights',
  '3Symbols': '3Symbols',
  '3Symbols2': '3Symbols',
};

const DATE_PERIODS = new Set<string>(['yesterday', 'today', 'tomorrow', 'last7Days', 'lastWeek', 'thisWeek', 'nextWeek', 'lastMonth', 'thisMonth', 'nextMonth']);

const COMPARISONS: Record<string, string> = {
  greaterThan: '>', greaterThanOrEqual: '>=', lessThan: '<', lessThanOrEqual: '<=', equal: '=', notEqual: '<>',
};

/** First string literal in a formula ("SEARCH(\"foo\",A1)" → foo). */
function firstStringLiteral(formula: string | number | undefined): string | undefined {
  const m = /"((?:[^"]|"")*)"/.exec(String(formula ?? ''));
  return m ? (m[1] as string).replace(/""/g, '"') : undefined;
}

/** A cellIs operand: a number, a quoted string, or (null) a formula expression. */
function literalOf(f: string | number | undefined): number | string | null {
  if (typeof f === 'number') return f;
  const s = String(f ?? '').trim();
  if (s !== '' && Number.isFinite(Number(s))) return Number(s);
  const m = /^"((?:[^"]|"")*)"$/.exec(s);
  return m ? (m[1] as string).replace(/""/g, '"') : null;
}

/**
 * Excel conditional formats of `sheet` as OGrid rules, in Excel's priority
 * order. Multi-range rules ("A2:A9 C2:C9") become one OGrid rule per range.
 */
export function conditionalFormatsOf(
  sheet: ExcelJS.Worksheet | undefined,
  layout: ConditionalFormatLayout,
  palette: ThemePalette = DEFAULT_THEME_PALETTE,
): IConditionalFormatRule<SheetRow>[] {
  const formattings = (sheet as unknown as { conditionalFormattings?: Array<{ ref: string; rules: RawRule[] }> } | undefined)?.conditionalFormattings;
  if (!formattings?.length || layout.columnCount === 0) return [];
  const offset = layout.headerPromoted ? 1 : 0;
  const out: IConditionalFormatRule<SheetRow>[] = [];

  for (const cf of formattings) {
    for (const ref of String(cf.ref ?? '').split(/\s+/).filter(Boolean)) {
      const box = parseRange(ref);
      if (!box) continue;
      // Grid rows / columns the range covers.
      const right = Math.min(box.right, layout.columnCount);
      const start = Math.max(0, box.top - 1 - offset);
      const end = Math.min(layout.rowCount - 1, box.bottom - 1 - offset);
      if (box.left > right || end < start) continue;
      const columnIds: string[] = [];
      for (let c = box.left; c <= right; c++) columnIds.push(indexToColumnLetter(c - 1));
      const target = { columnIds, rows: { start, end } };

      // Rule formulas are written for the range's top-left worksheet cell.
      // Move them to the first grid row the range covers, then onto grid rows.
      const firstSheetRow = start + 1 + offset;
      const toGrid = (formula: string) =>
        rebaseFormulaRows(adjustFormulaReferences(normalizeFormula(formula), 0, firstSheetRow - box.top), -offset);
      const anchor = `${indexToColumnLetter(box.left - 1)}${firstSheetRow}`;

      for (const raw of cf.rules ?? []) {
        const rule = mapRule(raw, anchor, toGrid, palette);
        if (!rule) continue;
        out.push({
          ...target,
          ...rule,
          ...(raw.priority != null ? { priority: raw.priority } : {}),
          ...(raw.stopIfTrue ? { stopIfTrue: true } : {}),
        } as IConditionalFormatRule<SheetRow>);
      }
    }
  }
  return out;
}

type MappedRule = IConditionalFormatRule<SheetRow> extends infer R ? R extends unknown ? Omit<R, 'columnIds'> : never : never;

function mapRule(raw: RawRule, anchor: string, toGrid: (formula: string) => string, palette: ThemePalette): MappedRule | null {
  const style = () => styleOf(raw.style, palette);
  switch (raw.type) {
    case 'cellIs': {
      const op = raw.operator ?? '';
      const [f1, f2] = raw.formulae ?? [];
      const a = literalOf(f1);
      const b = literalOf(f2);
      if (op === 'between' || op === 'notBetween') {
        if (a !== null && b !== null) return { type: 'cellValue', operator: op, value: a, value2: b, style: style() };
        const test = `AND(${anchor}>=${f1},${anchor}<=${f2})`;
        return { type: 'formula', formula: toGrid(op === 'between' ? `=${test}` : `=NOT(${test})`), style: style() };
      }
      if (!(op in COMPARISONS)) return null;
      if (a !== null) return { type: 'cellValue', operator: op as ConditionalFormatOperator, value: a, style: style() };
      return { type: 'formula', formula: toGrid(`=${anchor}${COMPARISONS[op]}(${f1})`), style: style() };
    }
    case 'containsText': {
      // ExcelJS folds the blank/error kinds into containsText with the kind as operator.
      switch (raw.operator) {
        case 'containsBlanks': return { type: 'blanks', style: style() };
        case 'notContainsBlanks': return { type: 'noBlanks', style: style() };
        case 'containsErrors': return { type: 'errors', style: style() };
        case 'notContainsErrors': return { type: 'noErrors', style: style() };
      }
      const text = raw.text ?? firstStringLiteral(raw.formulae?.[0]);
      return text === undefined ? null : { type: 'text', operator: 'contains', text, style: style() };
    }
    case 'notContainsText':
    case 'beginsWith':
    case 'endsWith': {
      const text = raw.text ?? firstStringLiteral(raw.formulae?.[0]);
      if (text === undefined) return null;
      const operator = raw.type === 'notContainsText' ? 'notContains' : raw.type;
      return { type: 'text', operator, text, style: style() };
    }
    case 'timePeriod':
      return raw.timePeriod && DATE_PERIODS.has(raw.timePeriod)
        ? { type: 'dateOccurring', period: raw.timePeriod as ConditionalFormatDatePeriod, style: style() }
        : null;
    case 'duplicateValues':
    case 'uniqueValues':
      return { type: 'duplicateValues', unique: raw.type === 'uniqueValues', style: style() };
    case 'top10':
      return { type: 'topBottom', direction: raw.bottom ? 'bottom' : 'top', rank: raw.rank ?? 10, percent: !!raw.percent, style: style() };
    case 'aboveAverage':
      return { type: 'average', direction: raw.aboveAverage === false ? 'below' : 'above', style: style() };
    case 'expression': {
      const f = raw.formulae?.[0];
      return f == null ? null : { type: 'formula', formula: toGrid(String(f)), style: style() };
    }
    case 'colorScale': {
      const colors = Array.isArray(raw.color) ? raw.color : [];
      const cfvo = raw.cfvo ?? [];
      if (cfvo.length < 2 || cfvo.length > 3 || colors.length !== cfvo.length) return null;
      const stops: IColorScaleStop[] = [];
      for (let i = 0; i < cfvo.length; i++) {
        const bound = boundOf(cfvo[i], i === 0 ? 'min' : 'max');
        const color = colorToCss(colors[i], palette);
        if (!bound || !color) return null;
        stops.push({ ...bound, color });
      }
      return { type: 'colorScale', stops: stops as [IColorScaleStop, IColorScaleStop] };
    }
    case 'dataBar': {
      const min = boundOf(raw.cfvo?.[0], 'min');
      const max = boundOf(raw.cfvo?.[1], 'max');
      if (!min || !max) return null;
      const color = colorToCss(Array.isArray(raw.color) ? raw.color[0] : raw.color, palette);
      return {
        type: 'dataBar',
        ...(color ? { color } : {}),
        // Excel's automatic ends (min/max) start bars at 0 for positive data; keep that by omitting them.
        ...(min.type !== 'min' ? { min } : {}),
        ...(max.type !== 'max' ? { max } : {}),
        gradient: raw.gradient !== false,
        ...(raw.showValue === false ? { barOnly: true } : {}),
      };
    }
    case 'iconSet': {
      const iconSet = ICON_SETS[raw.iconSet ?? '3TrafficLights1'];
      const cfvo = raw.cfvo ?? [];
      if (!iconSet || cfvo.length !== 3) return null;
      const t1 = cfvo[1] as { type: string; value?: number };
      const t2 = cfvo[2] as { type: string; value?: number };
      const kind = t1.type === 'num' ? 'number' : t1.type;
      if (t1.type !== t2.type || !['percent', 'num', 'percentile'].includes(t1.type)) return null;
      return {
        type: 'iconSet',
        iconSet,
        thresholds: [t1.value ?? 33, t2.value ?? 67],
        thresholdType: kind as 'percent' | 'number' | 'percentile',
        ...(raw.reverse ? { reverse: true } : {}),
        ...(raw.showValue === false ? { iconOnly: true } : {}),
      };
    }
    default:
      return null;
  }
}
