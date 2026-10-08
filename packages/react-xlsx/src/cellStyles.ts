// ExcelJS cell styles → CSS, plus the style edits the formatting toolbar
// makes. Pure module (no React import; CSS is returned as a plain object).

import type ExcelJS from 'exceljs';
import { LEGACY_PALETTE } from './numFmt';

/** A cell's ExcelJS style. Unknown keys from the source file are kept as-is. */
export type XlsxCellStyle = Partial<ExcelJS.Style>;

/** Theme color slots in the order Excel's `theme="n"` attribute indexes them. */
export type ThemePalette = string[];

/** Office 2013-2022 default theme: lt1, dk1, lt2, dk2, accent1-6, hlink, folHlink. */
export const DEFAULT_THEME_PALETTE: ThemePalette = [
  '#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31',
  '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#0563C1', '#954F72',
];

/** Read the theme palette from a workbook's theme1.xml; falls back to the Office default. */
export function themePaletteOf(workbook: ExcelJS.Workbook): ThemePalette {
  const themes = (workbook as unknown as { _themes?: Record<string, string> })._themes;
  const xml = themes ? Object.values(themes)[0] : undefined;
  if (typeof xml !== 'string') return DEFAULT_THEME_PALETTE;
  const scheme = /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(xml)?.[0];
  if (!scheme) return DEFAULT_THEME_PALETTE;
  const slot = (name: string): string | undefined => {
    const block = new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`).exec(scheme)?.[1];
    if (!block) return undefined;
    const rgb = /srgbClr val="([0-9A-Fa-f]{6})"/.exec(block)?.[1] ?? /lastClr="([0-9A-Fa-f]{6})"/.exec(block)?.[1];
    return rgb ? `#${rgb.toUpperCase()}` : undefined;
  };
  // The file stores dk1, lt1, dk2, lt2; theme="0" means lt1 and theme="1" dk1.
  const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return order.map((name, i) => slot(name) ?? DEFAULT_THEME_PALETTE[i] ?? '#000000');
}

/** Resolve an ExcelJS color (argb, theme+tint, or legacy indexed) to a CSS hex color. */
export function colorToCss(color: Partial<ExcelJS.Color> | undefined, palette: ThemePalette = DEFAULT_THEME_PALETTE): string | undefined {
  if (!color) return undefined;
  let hex: string | undefined;
  if (typeof color.argb === 'string' && /^[0-9A-Fa-f]{6,8}$/.test(color.argb)) {
    hex = `#${color.argb.slice(-6).toUpperCase()}`;
  } else if (typeof color.theme === 'number') {
    hex = palette[color.theme];
  } else {
    const indexed = (color as { indexed?: number }).indexed;
    if (typeof indexed === 'number') {
      // 0-7 repeat the first eight palette entries; 64/65 are system colors (auto).
      hex = indexed < 8 ? LEGACY_PALETTE[indexed] : LEGACY_PALETTE[indexed - 8];
    }
  }
  if (!hex) return undefined;
  const tint = (color as { tint?: number }).tint;
  return typeof tint === 'number' && tint !== 0 ? applyTint(hex, tint) : hex;
}

function applyTint(hex: string, tint: number): string {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const v = tint < 0 ? c * (1 + tint) : c + (255 - c) * tint;
    return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

/** Converts a CSS hex color from a color input to ExcelJS argb. */
export function cssToArgb(css: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(css.trim());
  return m ? `FF${(m[1] as string).toUpperCase()}` : 'FF000000';
}

const BORDER_CSS: Record<string, string> = {
  thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed',
  dashDot: '1px dashed', dashDotDot: '1px dotted', medium: '2px solid',
  mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed',
  slantDashDot: '2px dashed', thick: '3px solid', double: '3px double',
};

/** Fonts that are the workbook default in practice; rendering them would only fight the grid's font. */
const DEFAULT_FONT_NAMES = new Set(['calibri', 'aptos', 'aptos narrow', 'aptos display']);
const DEFAULT_FONT_SIZE = 11;

export type CssStyle = Record<string, string | number>;

/**
 * CSS for a styled cell. Returns undefined when the style has nothing
 * visual (e.g. only a numFmt), so unstyled cells render exactly as before.
 *
 * Fills and borders need to cover the whole cell, but a column's cellStyle
 * styles a span inside the cell's padding box. The span is therefore
 * absolutely positioned over the cell (cell contents and pinned cells are
 * both positioned) and carries the padding itself.
 */
export function styleToCss(
  style: XlsxCellStyle | undefined,
  palette: ThemePalette,
  valueKind: 'number' | 'text' | 'boolean' | 'empty',
  extra?: { color?: string },
): CssStyle | undefined {
  if (!style && !extra?.color) return undefined;
  const css: CssStyle = {};
  const font = style?.font;
  if (font) {
    if (font.bold) css.fontWeight = 700;
    if (font.italic) css.fontStyle = 'italic';
    const decorations: string[] = [];
    if (font.underline) decorations.push('underline');
    if (font.strike) decorations.push('line-through');
    if (decorations.length) css.textDecoration = decorations.join(' ');
    const color = colorToCss(font.color, palette);
    // theme 1 (dk1) is the default text color; leave it to the grid theme so dark mode stays readable.
    if (color && !(font.color?.theme === 1 && !(font.color as { tint?: number }).tint)) css.color = color;
    if (typeof font.size === 'number' && font.size !== DEFAULT_FONT_SIZE) {
      css.fontSize = `calc(var(--ogrid-cell-font-size, 13px) * ${+(font.size / DEFAULT_FONT_SIZE).toFixed(3)})`;
    }
    if (font.name && !DEFAULT_FONT_NAMES.has(font.name.toLowerCase())) {
      css.fontFamily = `"${font.name.replace(/"/g, '')}", var(--ogrid-font-family, inherit)`;
    }
    if (font.vertAlign === 'superscript' || font.vertAlign === 'subscript') css.verticalAlign = font.vertAlign === 'superscript' ? 'super' : 'sub';
  }
  if (extra?.color) css.color = extra.color;

  const fill = style?.fill;
  let background: string | undefined;
  if (fill?.type === 'pattern' && fill.pattern !== 'none') {
    background = colorToCss(fill.fgColor, palette) ?? colorToCss(fill.bgColor, palette);
  } else if (fill?.type === 'gradient') {
    background = colorToCss(fill.stops?.[0]?.color, palette);
  }
  const borderSides: Array<[keyof ExcelJS.Borders, string]> = [['top', 'borderTop'], ['right', 'borderRight'], ['bottom', 'borderBottom'], ['left', 'borderLeft']];
  const borders: CssStyle = {};
  for (const [side, prop] of borderSides) {
    const b = style?.border?.[side] as Partial<ExcelJS.Border> | undefined;
    if (!b?.style) continue;
    const width = BORDER_CSS[b.style] ?? '1px solid';
    borders[prop] = `${width} ${colorToCss(b.color, palette) ?? 'currentColor'}`;
  }

  const align = style?.alignment;
  const horizontal = align?.horizontal;
  const wrap = !!align?.wrapText;
  const needsLayer = !!background || Object.keys(borders).length > 0 || !!horizontal || !!align?.vertical || wrap || !!align?.indent;
  if (needsLayer) {
    Object.assign(css, borders);
    if (background) {
      css.background = background;
      // Marker for the range-highlight overlay rule XlsxGrid injects.
      css['--ogrid-xlsx-fill'] = '1';
    }
    css.position = 'absolute';
    css.inset = 0;
    css.boxSizing = 'border-box';
    css.display = 'flex';
    css.padding = 'var(--ogrid-cell-padding, 6px 10px)';
    css.overflow = 'hidden';
    css.alignItems = align?.vertical === 'top' ? 'flex-start' : align?.vertical === 'bottom' ? 'flex-end' : 'center';
    const h = horizontal ?? (valueKind === 'number' ? 'right' : valueKind === 'boolean' ? 'center' : 'left');
    css.justifyContent = h === 'right' ? 'flex-end' : h === 'center' || h === 'centerContinuous' ? 'center' : 'flex-start';
    css.textAlign = h === 'right' ? 'right' : h === 'center' || h === 'centerContinuous' ? 'center' : h === 'justify' || h === 'distributed' ? 'justify' : 'left';
    if (align?.indent) css.paddingLeft = `calc(var(--ogrid-cell-indent, 10px) + ${align.indent * 9}px)`;
    if (wrap) {
      // Line breaks in the text (Alt+Enter) show, as in Excel.
      css.whiteSpace = 'pre-wrap';
      css.overflowWrap = 'anywhere';
    } else {
      css.whiteSpace = 'nowrap';
      css.textOverflow = 'ellipsis';
    }
  }
  return Object.keys(css).length ? css : undefined;
}

// ---- Style edits ------------------------------------------------------------

/** One formatting-toolbar action. */
export type StyleEdit =
  | { kind: 'bold' | 'italic' | 'underline' | 'strike'; value: boolean }
  | { kind: 'fill'; argb: string | null }
  | { kind: 'fontColor'; argb: string | null }
  | { kind: 'fontFamily'; value: string | null }
  | { kind: 'fontSize'; value: number | null }
  | { kind: 'horizontal'; value: 'left' | 'center' | 'right' | null }
  | { kind: 'vertical'; value: 'top' | 'middle' | 'bottom' | null }
  | { kind: 'wrapText'; value: boolean }
  | { kind: 'numFmt'; value: string | null };

/** Borders offered by the toolbar, by Excel's line-style names. */
export type BorderLineStyle = 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';

/** Which edges of a selection a border command draws. */
export type BorderScope = 'all' | 'outside' | 'inside' | 'top' | 'bottom' | 'left' | 'right' | 'none';

/** A border command: scope, line style and color (`null` for automatic). */
export interface BorderOptions {
  scope: BorderScope;
  lineStyle: BorderLineStyle;
  argb: string | null;
}

/** Common fonts offered in the font-family menu, Excel/Word's everyday list. */
export const COMMON_FONTS = ['Calibri', 'Aptos', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'] as const;

/**
 * The border sides a cell at the given position within the selection gets.
 * `outside` draws only the selection's edges; `inside` draws the shared
 * bottom/right lines between cells; `all` draws every side on every cell.
 */
export function borderSidesForCell(
  opts: BorderOptions,
  edge: { top: boolean; bottom: boolean; left: boolean; right: boolean },
): Partial<ExcelJS.Borders> {
  if (opts.scope === 'none') return { top: undefined, right: undefined, bottom: undefined, left: undefined };
  const side: ExcelJS.Border = (opts.argb ? { style: opts.lineStyle, color: { argb: opts.argb } } : { style: opts.lineStyle }) as ExcelJS.Border;
  const sides: Partial<ExcelJS.Borders> = {};
  const set = (key: 'top' | 'right' | 'bottom' | 'left') => { sides[key] = side; };
  switch (opts.scope) {
    case 'all':
      set('top'); set('right'); set('bottom'); set('left');
      break;
    case 'outside':
      if (edge.top) set('top');
      if (edge.right) set('right');
      if (edge.bottom) set('bottom');
      if (edge.left) set('left');
      break;
    case 'inside':
      // Interior lines are each cell's bottom/right (except the last row/column).
      if (!edge.bottom) set('bottom');
      if (!edge.right) set('right');
      break;
    case 'top':
      set('top');
      break;
    case 'bottom':
      set('bottom');
      break;
    case 'left':
      set('left');
      break;
    case 'right':
      set('right');
      break;
  }
  return sides;
}

/** Merge border sides into a style (undefined clears a side). Returns a new style. */
export function applyBorderSides(style: XlsxCellStyle | undefined, sides: Partial<ExcelJS.Borders>): XlsxCellStyle | undefined {
  const next = { ...style } as Record<string, unknown>;
  const border: Record<string, unknown> = { ...(next.border as object | undefined) };
  for (const [key, value] of Object.entries(sides)) border[key] = value;
  next.border = border;
  return pruneStyle(next);
}


/** Number formats offered by the toolbar. `null` is General. */
export const NUMBER_FORMAT_PRESETS: Array<{ id: string; label: string; numFmt: string | null }> = [
  { id: 'general', label: 'General', numFmt: null },
  { id: 'number', label: 'Number', numFmt: '#,##0.00' },
  { id: 'currency', label: 'Currency', numFmt: '"$"#,##0.00' },
  { id: 'percent', label: 'Percent', numFmt: '0.00%' },
  { id: 'date', label: 'Date', numFmt: 'yyyy-mm-dd' },
];

/**
 * Apply an edit to a style, returning a new object (ExcelJS shares style
 * objects between cells, so they are never mutated). Keys the edit does not
 * touch, including ones this package does not understand, are preserved.
 * Returns undefined when nothing is left.
 */
export function applyStyleEdit(style: XlsxCellStyle | undefined, edit: StyleEdit): XlsxCellStyle | undefined {
  const next = { ...style } as Record<string, unknown>;
  const sub = (key: 'font' | 'alignment', field: string, value: unknown) => {
    next[key] = { ...(next[key] as object | undefined), [field]: value };
  };
  switch (edit.kind) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      sub('font', edit.kind, edit.value ? true : undefined);
      break;
    case 'fontColor':
      sub('font', 'color', edit.argb ? { argb: edit.argb } : undefined);
      break;
    case 'fontFamily':
      sub('font', 'name', edit.value ?? undefined);
      if (edit.value) sub('font', 'scheme', undefined);
      break;
    case 'fontSize':
      sub('font', 'size', typeof edit.value === 'number' ? edit.value : undefined);
      break;
    case 'fill':
      next.fill = edit.argb ? { type: 'pattern', pattern: 'solid', fgColor: { argb: edit.argb } } : undefined;
      break;
    case 'horizontal':
    case 'vertical':
      sub('alignment', edit.kind, edit.value ?? undefined);
      break;
    case 'wrapText':
      sub('alignment', 'wrapText', edit.value ? true : undefined);
      break;
    case 'numFmt':
      next.numFmt = edit.value ?? undefined;
      break;
  }
  return pruneStyle(next);
}

/** Drop cleared keys and empty sub-objects so "unbold" on a plain cell leaves no style behind. */
function pruneStyle(style: Record<string, unknown>): XlsxCellStyle | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(style)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) {
      const inner = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
      if (Object.keys(inner).length) out[key] = inner;
      continue;
    }
    out[key] = v;
  }
  return Object.keys(out).length ? (out as XlsxCellStyle) : undefined;
}

/** Whether a style already has a toggle on (decides whether the toolbar turns it on or off). */
export function styleHas(style: XlsxCellStyle | undefined, kind: 'bold' | 'italic' | 'underline' | 'strike'): boolean {
  return !!(style?.font as Record<string, unknown> | undefined)?.[kind];
}
