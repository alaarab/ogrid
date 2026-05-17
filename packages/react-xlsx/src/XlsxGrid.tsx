// Single-sheet OGrid render. Caller picks which sheet of the workbook
// to display via sheetName; the workbook itself is parsed once by the
// caller (or by XlsxWorkbookGrid) and passed in.

import { useMemo } from 'react';
import type ExcelJS from 'exceljs';
import { OGrid, type IOGridProps } from '@alaarab/ogrid-react-radix';
import { sheetToGridData, type SheetRow, type SheetToGridDataOptions } from './sheetMapper';

export interface XlsxGridProps {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  /** CSS height for the grid container. Defaults to '100%'. */
  height?: number | string;
  /** Override grid density. Defaults to 'compact' (matches Excel-like row size). */
  density?: 'compact' | 'normal' | 'comfortable';
  /** See {@link SheetToGridDataOptions.headerRow}. Defaults to 'auto'. */
  headerRow?: SheetToGridDataOptions['headerRow'];
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
}: XlsxGridProps) {
  const sheet = workbook.getWorksheet(sheetName);
  const { columns, rows, initialFormulas } = useMemo(
    () => sheetToGridData(sheet, { headerRow }),
    [sheet, headerRow],
  );

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
    initialFormulas,
    // Show the sheet in its real row order. OGrid otherwise defaults its
    // sort to the first column; an empty `defaultSortBy` opts out so a
    // spreadsheet preview reads top-to-bottom as authored. Columns stay
    // click-to-sort.
    defaultSortBy: '',
    virtualScroll: { enabled: true, paginate: false, rowHeight, columns: false },
    rowHeight,
    density,
    statusBar: true,
    columnChooser: false as const,
  } as unknown as IOGridProps<unknown>;

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column' }}>
      <OGrid {...gridProps} />
    </div>
  );
}
