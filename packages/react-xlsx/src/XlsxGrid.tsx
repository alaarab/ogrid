// Single-sheet OGrid render. Caller picks which sheet of the workbook
// to display via sheetName; the workbook itself is parsed once by the
// caller (or by XlsxWorkbookGrid) and passed in.

import { useMemo } from 'react';
import type ExcelJS from 'exceljs';
import { OGrid, type IOGridProps } from '@alaarab/ogrid-react-radix';
import { createBuiltInFunctions, tokenize, type IGridDataAccessor } from '@alaarab/ogrid-core/formula';
import { headerReferencingFormulas, normalizeCellValue, sheetToGridData, type SheetRow, type SheetToGridDataOptions, type WorkbookLoadOptions } from './sheetMapper';

export interface XlsxGridProps {
  workbook: ExcelJS.Workbook;
  sheetName: string;
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
}

// The formula engine loads initialFormulas once per OGrid instance, so each
// mapped sheet (new sheet, workbook or header mode) gets a fresh grid. That
// also resets sort and undo.
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

/**
 * Fixed virtualized row height per density. Virtual scrolling needs a uniform
 * row height, so the grid is pinned to one of these (via both `virtualScroll.
 * rowHeight` and the top-level `rowHeight` prop) rather than letting rows size
 * to content.
 */
const ROW_HEIGHT_BY_DENSITY: Record<NonNullable<XlsxGridProps['density']>, number> = {
  compact: 28,
  normal: 36,
  comfortable: 44,
};

export function XlsxGrid({
  workbook,
  sheetName,
  height = '100%',
  density = 'compact',
  headerRow,
  limits,
}: XlsxGridProps) {
  const sheet = workbook.getWorksheet(sheetName);
  const maxRows = limits?.maxRows;
  const maxCols = limits?.maxCols;
  const maxCells = limits?.maxCells;
  const { columns, rows, initialFormulas, truncated, parseTruncated } = useMemo(
    () => sheetToGridData(sheet, { headerRow, maxRows, maxCols, maxCells }),
    [sheet, headerRow, maxRows, maxCols, maxCells],
  );
  const sheets = useMemo(() => {
    const accessors: Record<string, IGridDataAccessor> = Object.create(null);
    for (const worksheet of workbook.worksheets) {
      accessors[worksheet.name] = {
        getCellValue: (col, row) => normalizeCellValue(worksheet.findRow(row + 1)?.findCell(col + 1)?.value),
        getRowCount: () => worksheet.rowCount,
        getColumnCount: () => worksheet.columnCount,
      };
    }
    return accessors;
  }, [workbook]);
  const supportedFormulas = useMemo(() => {
    const functions = createBuiltInFunctions();
    return initialFormulas.filter((f) => {
      // Keep the file's cached result when the engine cannot interpret it.
      // All formulas remain available in sheetToGridData for export.
      if (rows[f.row]?.[columns[f.col]?.columnId ?? ''] === undefined) return true;
      if (headerReferencingFormulas.has(f)) return false;
      try {
        return tokenize(f.formula.slice(1)).every((token) =>
          (token.type !== 'FUNCTION' || functions.has(token.value.toUpperCase())) &&
          (token.type !== 'SHEET_REF' || Object.prototype.hasOwnProperty.call(sheets, token.value)) &&
          token.type !== 'IDENTIFIER',
        );
      } catch {
        return false;
      }
    });
  }, [initialFormulas, columns, rows, sheets]);

  if (!sheet) {
    return <div style={{ padding: 16, opacity: 0.7 }}>Sheet not found: {sheetName}</div>;
  }

  const rowHeight = ROW_HEIGHT_BY_DENSITY[density];

  // Cast: sheetMapper emits @alaarab/ogrid-core's IColumnDef where
  // cellEditor is `unknown`, while OGrid wants @alaarab/ogrid-react's
  // narrower variant. We never set cellEditor in the mapper so the
  // narrowing is sound at runtime. createOGrid()'s memo+forwardRef
  // also drops the generic at the call site, so T resolves to unknown.
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
    initialFormulas: supportedFormulas,
    sheets,
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
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column' }}>
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
      <OGrid key={gridKeyFor(initialFormulas)} {...gridProps} />
    </div>
  );
}
