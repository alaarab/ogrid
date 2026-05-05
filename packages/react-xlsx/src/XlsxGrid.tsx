// Single-sheet OGrid render. Caller picks which sheet of the workbook
// to display via sheetName; the workbook itself is parsed once by the
// caller (or by XlsxWorkbookGrid) and passed in.

import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import { OGrid, type IOGridProps } from '@alaarab/ogrid-react-radix';
import { sheetToGridData, type SheetRow } from './sheetMapper';

export interface XlsxGridProps {
  workbook: XLSX.WorkBook;
  sheetName: string;
  /** CSS height for the grid container. Defaults to '100%'. */
  height?: number | string;
  /** Override grid density. Defaults to 'compact' (matches Excel-like row size). */
  density?: 'compact' | 'normal' | 'comfortable';
}

export function XlsxGrid({ workbook, sheetName, height = '100%', density = 'compact' }: XlsxGridProps) {
  const sheet = workbook.Sheets[sheetName];
  const { columns, rows, initialFormulas } = useMemo(
    () => (sheet ? sheetToGridData(sheet) : { columns: [], rows: [], initialFormulas: [] }),
    [sheet],
  );

  if (!sheet) {
    return <div style={{ padding: 16, opacity: 0.7 }}>Sheet not found: {sheetName}</div>;
  }

  // Cast: sheetMapper emits @alaarab/ogrid-core's IColumnDef where
  // cellEditor is `unknown`, while OGrid wants @alaarab/ogrid-react's
  // narrower variant. We never set cellEditor in the mapper so the
  // narrowing is sound at runtime. createOGrid()'s memo+forwardRef
  // also drops the generic at the call site, so T resolves to unknown.
  //
  // Config matches the canonical formula+cellRef story in
  // packages/react-radix/src/OGrid/OGrid.stories.tsx — explicit
  // virtualScroll:{columns:false}, no layoutMode (default 'content'),
  // no columnReorder (read-only preview). statusBar gives a familiar
  // Excel-style row-count footer at the bottom of the modal.
  const gridProps = {
    columns,
    data: rows,
    getRowId: (row: SheetRow) => row.__rowIdx,
    cellReferences: true,
    formulas: true,
    initialFormulas,
    virtualScroll: { columns: false },
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
