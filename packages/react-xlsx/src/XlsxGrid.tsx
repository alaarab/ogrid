// Single-sheet OGrid render. Caller picks which sheet of the workbook
// to display via sheetName; the workbook itself is parsed once by the
// caller (or by XlsxWorkbookGrid) and passed in. Sheet state (edits,
// styles, merges, undo) lives in an XlsxWorkbookDocument so it survives
// sheet switches and can be exported.

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type ExcelJS from 'exceljs';
import { OGrid, type IOGridProps, type ICellValueChangedEvent } from '@alaarab/ogrid-react-radix';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { IRecalcResult } from '@alaarab/ogrid-core/formula';
import { styleToCss, themePaletteOf, type CssStyle, type ThemePalette, type XlsxCellStyle } from './cellStyles';
import { FormatToolbar } from './FormatToolbar';
import { gridLayoutProps, readSelection } from './gridAdapter';
import { formatWithNumFmt } from './numFmt';
import { cellKey, type SheetRow, type SheetToGridDataOptions, type WorkbookLoadOptions } from './sheetMapper';
import { XlsxWorkbookDocument, type XlsxSheetState } from './xlsxDocument';

export interface XlsxGridProps {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  /**
   * Shared editable state. XlsxWorkbookGrid passes one for the whole
   * workbook; pass your own to keep edits across remounts or to export
   * (`await document.toBlob()`). Must wrap `workbook`.
   */
  document?: XlsxWorkbookDocument;
  /** CSS height for the grid container. Defaults to '100%'. */
  height?: number | string;
  /** Override grid density. Defaults to 'compact' (matches Excel-like row size). */
  density?: 'compact' | 'normal' | 'comfortable';
  /** See {@link SheetToGridDataOptions.headerRow}. Defaults to 'auto'. */
  headerRow?: SheetToGridDataOptions['headerRow'];
  /**
   * Load limits for untrusted files; see {@link SheetToGridDataOptions}.
   * When a sheet exceeds them a notice above the grid says what was cut.
   */
  limits?: Omit<WorkbookLoadOptions, 'headerRow'>;
  /** Allow cell editing (values and formulas). Defaults to false (read-only preview). */
  editable?: boolean;
  /** Show the formatting toolbar. Defaults to `editable`. */
  toolbar?: boolean;
  /** When set, the toolbar shows an Export button that downloads the workbook under this name. */
  exportFileName?: string;
}

/**
 * Fixed virtualized row height per density. Virtual scrolling needs a uniform
 * row height, so the grid is pinned to one of these (via both `virtualScroll.
 * rowHeight` and the top-level `rowHeight` prop) rather than letting rows size
 * to content. Sheet row heights are kept for export but not rendered.
 */
const ROW_HEIGHT_BY_DENSITY: Record<NonNullable<XlsxGridProps['density']>, number> = {
  compact: 28,
  normal: 36,
  comfortable: 44,
};

// Filled cells cover the cell's range tint; this paints the tint back on top.
const FILL_OVERLAY_CSS =
  '[data-in-range="true"]>span[style*="--ogrid-xlsx-fill"]::after{content:"";position:absolute;inset:0;' +
  'background:var(--ogrid-range-bg,rgba(33,115,70,0.12));pointer-events:none}';

/** Excel's built-in short date (numFmt 14) is locale-dependent; show ISO like the rest of OGrid. */
const LOCALE_DATE_FORMATS = new Set(['mm-dd-yy', 'm/d/yy', 'm/d/yyyy']);

function displayFormat(numFmt: string | undefined): string | undefined {
  return numFmt && LOCALE_DATE_FORMATS.has(numFmt.toLowerCase()) ? 'yyyy-mm-dd' : numFmt;
}

function valueKind(v: unknown): 'number' | 'text' | 'boolean' | 'empty' {
  if (v === '' || v == null) return 'empty';
  if (typeof v === 'number' || v instanceof Date) return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'text';
}

/** Typed text that looks like a number becomes one, as in Excel. */
function coerceTyped(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : v;
}

/** Display-layer columns: numFmt formatting + cell styles, read live from the sheet state. */
function useStyledColumns(state: XlsxSheetState | undefined, palette: ThemePalette, editable: boolean): IColumnDef<SheetRow>[] {
  return useMemo(() => {
    if (!state) return [];
    const cssCache = new WeakMap<XlsxCellStyle, Map<string, CssStyle | undefined>>();
    const cssFor = (style: XlsxCellStyle | undefined, kind: ReturnType<typeof valueKind>, color: string | undefined) => {
      if (!style) return color ? styleToCss(undefined, palette, kind, { color }) : undefined;
      let byKind = cssCache.get(style);
      if (!byKind) { byKind = new Map(); cssCache.set(style, byKind); }
      const k = `${kind}|${color ?? ''}`;
      if (!byKind.has(k)) byKind.set(k, styleToCss(style, palette, kind, color ? { color } : undefined));
      return byKind.get(k);
    };
    return state.columns.map((col) => {
      const columnId = col.columnId;
      const cellValueOf = (item: SheetRow) => {
        const raw = item[columnId];
        return typeof raw === 'string' && raw.startsWith('=') && raw.length > 1
          ? state.formulaResults.get(cellKey(item.__rowIdx, columnId))
          : raw;
      };
      return {
        ...col,
        editable,
        valueFormatter: (value: unknown, item: SheetRow) => {
          const style = state.styles.get(cellKey(item.__rowIdx, columnId));
          const formatted = formatWithNumFmt(value, displayFormat(style?.numFmt));
          return formatted ? formatted.text : value == null ? '' : String(value);
        },
        // Copy/paste carries the stored value, not the display text, so pasting
        // "$1,234.00" back is never needed; formula cells copy their formula.
        clipboardFormatter: (value: unknown) =>
          value instanceof Date ? value.toISOString().slice(0, 10) : value == null ? '' : String(value),
        cellStyle: (item: SheetRow) => {
          const style = state.styles.get(cellKey(item.__rowIdx, columnId));
          const value = cellValueOf(item);
          if (!style) return undefined as unknown as React.CSSProperties;
          const color = style.numFmt ? formatWithNumFmt(value, displayFormat(style.numFmt))?.color : undefined;
          return cssFor(style, valueKind(value), color) as React.CSSProperties;
        },
      } as IColumnDef<SheetRow>;
    });
  }, [state, palette, editable]);
}

export function XlsxGrid({
  workbook,
  sheetName,
  document: documentProp,
  height = '100%',
  density = 'compact',
  headerRow,
  limits,
  editable = false,
  toolbar,
  exportFileName,
}: XlsxGridProps) {
  const maxRows = limits?.maxRows;
  const maxCols = limits?.maxCols;
  const maxCells = limits?.maxCells;
  const ownDocument = useMemo(
    () => (documentProp ? null : new XlsxWorkbookDocument(workbook, { headerRow, maxRows, maxCols, maxCells })),
    [documentProp, workbook, headerRow, maxRows, maxCols, maxCells],
  );
  const doc = (documentProp ?? ownDocument) as XlsxWorkbookDocument;
  useSyncExternalStore(doc.subscribe, doc.getVersion, doc.getVersion);
  const state = doc.sheet(sheetName);
  const palette = useMemo(() => themePaletteOf(workbook), [workbook]);
  const columns = useStyledColumns(state, palette, editable);
  const sheets = useMemo(() => doc.sheetAccessors(), [doc]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const onCellValueChanged = useCallback((e: ICellValueChangedEvent<SheetRow>) => {
    doc.setCellValues(sheetName, [{ rowId: e.item.__rowIdx, columnId: e.columnId, value: coerceTyped(e.newValue) }]);
  }, [doc, sheetName]);
  const onUndo = useCallback(() => doc.undo(sheetName), [doc, sheetName]);
  const onRedo = useCallback(() => doc.redo(sheetName), [doc, sheetName]);
  const onFormulaRecalc = useCallback((r: IRecalcResult) => doc.recordFormulaResults(sheetName, r), [doc, sheetName]);
  const onColumnResized = useCallback((columnId: string, width: number) => doc.setColumnWidth(sheetName, columnId, width), [doc, sheetName]);
  const getSelection = useCallback(
    () => readSelection(wrapperRef.current, (attr) => {
      const n = Number(attr);
      return Number.isInteger(n) ? n : undefined;
    }),
    [],
  );

  if (!state) {
    return <div style={{ padding: 16, opacity: 0.7 }}>Sheet not found: {sheetName}</div>;
  }

  const { rows, source } = state;
  const { truncated, parseTruncated } = source;
  const rowHeight = ROW_HEIGHT_BY_DENSITY[density];
  const showToolbar = toolbar ?? editable;

  // Cast: the mapped columns use @alaarab/ogrid-core's IColumnDef where
  // cellEditor is `unknown`, while OGrid wants @alaarab/ogrid-react's
  // narrower variant (the mapper only sets 'select'). createOGrid()'s
  // memo+forwardRef also drops the generic at the call site.
  //
  // Formulas: the sheet state stores engine-evaluable formulas as "=..."
  // text in the rows. Passing onUndo makes the document the owner of the
  // history, and in that mode the grid's engine follows formula text in
  // the data (loads it on mount, re-reads it after edits and undo), while
  // every formula edit arrives at onCellValueChanged as text to store.
  //
  // Virtual scrolling: a spreadsheet sheet can be tens or hundreds of
  // thousands of rows long, so the grid runs fully virtualized.
  // `enabled: true` turns on row virtualization; `paginate: false` makes
  // it span the whole sheet instead of a 25-row page, giving continuous
  // scroll over the entire dataset. `rowHeight` is fixed (the
  // virtualization model requires a uniform row height) and the matching
  // top-level `rowHeight` prop pins the rendered rows to it. Past ~931k
  // rows the core scaled-spacer engages automatically to beat the browser
  // element-height cap. statusBar gives an Excel-style row-count footer.
  const gridProps = {
    columns,
    data: rows,
    getRowId: (row: SheetRow) => row.__rowIdx,
    cellReferences: true,
    formulas: true,
    sheets,
    onFormulaRecalc,
    editable,
    ...(editable ? { onCellValueChanged } : {}),
    onUndo,
    onRedo,
    canUndo: doc.canUndo(sheetName),
    canRedo: doc.canRedo(sheetName),
    onColumnResized,
    // Merged cells and frozen rows: passed through for the grid props landing upstream.
    ...gridLayoutProps({ mergedCells: state.merges, frozenRows: source.formatting.frozen.rows }),
    // Show the sheet in its real row order. OGrid otherwise defaults its
    // sort to the first column; an empty `defaultSortBy` opts out so a
    // spreadsheet preview reads top-to-bottom as authored. Columns stay
    // click-to-sort.
    defaultSortBy: '',
    virtualScroll: { enabled: true, paginate: false, rowHeight, columns: columns.length > 100 },
    rowHeight,
    density,
    statusBar: true,
    columnChooser: false as const,
  } as unknown as IOGridProps<unknown>;

  return (
    <div ref={wrapperRef} style={{ width: '100%', height, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <style>{FILL_OVERLAY_CSS}</style>
      {showToolbar && (
        <FormatToolbar
          document={doc}
          sheetName={sheetName}
          getSelection={getSelection}
          exportFileName={exportFileName}
        />
      )}
      {truncated && (
        <div role="status" style={{ padding: '4px 8px', fontSize: 12, opacity: 0.8 }}>
          Showing {rows.length.toLocaleString()} of {truncated.rowCount.toLocaleString()} rows and{' '}
          {columns.length.toLocaleString()} of {truncated.columnCount.toLocaleString()} columns (sheet too large to load in full).
        </div>
      )}
      {parseTruncated && (
        <div role="status" style={{ padding: '4px 8px', fontSize: 12, opacity: 0.8 }}>
          CSV parsing stopped at the configured load limits.
        </div>
      )}
      {/* One grid per sheet state: the formula engine loads a sheet's formulas once per OGrid instance. */}
      <OGrid key={gridKeyFor(state)} {...gridProps} />
    </div>
  );
}

const gridKeys = new WeakMap<object, number>();
let gridKeyCounter = 0;
function gridKeyFor(data: object): number {
  let key = gridKeys.get(data);
  if (key === undefined) {
    key = ++gridKeyCounter;
    gridKeys.set(data, key);
  }
  return key;
}
