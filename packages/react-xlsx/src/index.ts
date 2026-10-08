// Public surface for @alaarab/ogrid-react-xlsx.
//
// Two ways to use this package:
//
//   1. React consumers — import the components directly:
//      import { XlsxWorkbookGrid } from '@alaarab/ogrid-react-xlsx';
//      <XlsxWorkbookGrid blob={file} />
//
//   2. Imperative consumers (vanilla JS / no-build apps) — call mount():
//      import { mount } from '@alaarab/ogrid-react-xlsx';
//      const unmount = mount(domNode, { blob });
//      // ... when done:
//      unmount();
//
// React 19 does not auto-unmount when the host node is removed from the
// DOM, so imperative consumers MUST call the returned unmount() before
// detaching the node, or event listeners + state will leak.
//
// React: 18 or 19 (mount() uses react-dom/client, which React 17 lacks).
//
// Format support: .xlsx + CSV/TSV. Built on ExcelJS (active, MIT, on
// npm). The previous SheetJS-backed builds are gone — `xlsx` on npm is
// stuck at the vulnerable 0.18.5. See CHANGELOG 2.12.0 for the swap.

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type ExcelJS from 'exceljs';
import { XlsxWorkbookGrid, type XlsxWorkbookGridProps } from './XlsxWorkbookGrid';
export { XlsxGrid, type XlsxGridProps, type XlsxTruncationNotice } from './XlsxGrid';
export { XlsxWorkbookGrid, type XlsxWorkbookGridProps } from './XlsxWorkbookGrid';
export { streamWorkbook, type StreamedXlsxWorkbook, type XlsxStreamOptions, type XlsxStreamChunk, type XlsxStreamSheet } from './streamingClient';
export {
  workbookFromBlob,
  sheetToGridData,
  listSheets,
  cellKey,
  columnWidthToPx,
  pxToColumnWidth,
  isDefaultStyle,
  DEFAULT_COLUMN_WIDTH_CHARS,
  type SheetGridData,
  type SheetFormatting,
  type SheetRow,
  type SheetToGridDataOptions,
  type WorkbookLoadOptions,
  DEFAULT_MAX_ROWS,
  DEFAULT_MAX_COLS,
  DEFAULT_MAX_CELLS,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_UNCOMPRESSED_BYTES,
} from './sheetMapper';
export {
  exportToXlsx,
  workbookFromGridData,
  xlsxBlobFromWorkbook,
  XLSX_MIME_TYPE,
  type XlsxExportOptions,
} from './exportToXlsx';
export { XlsxWorkbookDocument, type XlsxSheetState } from './xlsxDocument';
export { conditionalFormatsOf, type ConditionalFormatLayout } from './conditionalFormats';
export { FormatToolbar, type FormatToolbarProps } from './FormatToolbar';
export { formatWithNumFmt, formatGeneral, isDateFormat, type FormattedValue } from './numFmt';
export {
  styleToCss,
  colorToCss,
  applyStyleEdit,
  applyBorderSides,
  borderSidesForCell,
  themePaletteOf,
  NUMBER_FORMAT_PRESETS,
  COMMON_FONTS,
  DEFAULT_THEME_PALETTE,
  type XlsxCellStyle,
  type StyleEdit,
  type ThemePalette,
  type BorderOptions,
  type BorderScope,
  type BorderLineStyle,
} from './cellStyles';
export { readSelection, type IMergedCell, type XlsxSelection } from './gridAdapter';

export interface MountOptions {
  streaming?: XlsxWorkbookGridProps['streaming'];
  streamOptions?: XlsxWorkbookGridProps['streamOptions'];
  onStreamedWorkbook?: XlsxWorkbookGridProps['onStreamedWorkbook'];
  onLoadProgress?: XlsxWorkbookGridProps['onLoadProgress'];
  /** Pre-parsed workbook (use this OR blob, not both). */
  workbook?: ExcelJS.Workbook;
  /** Raw blob — parsed lazily inside the component. */
  blob?: Blob;
  initialSheet?: string;
  density?: 'compact' | 'normal' | 'comfortable';
  height?: number | string;
  onSheetChange?: (sheetName: string) => void;
  /** See {@link SheetToGridDataOptions.headerRow}. Defaults to 'auto'. */
  headerRow?: 'auto' | 'header' | 'none';
  /** Load limits for untrusted files; see {@link XlsxWorkbookGridProps.limits}. */
  limits?: XlsxWorkbookGridProps['limits'];
  onTruncated?: XlsxWorkbookGridProps['onTruncated'];
  /** Allow cell editing. Defaults to false. */
  editable?: boolean;
  /** Outline existing invalid cells with red ellipses. */
  circleInvalidData?: boolean;
  /** Show the formatting toolbar. Defaults to `editable`. */
  toolbar?: boolean;
  /** Toolbar Export button file name; omit to hide the button. */
  exportFileName?: string;
  /** Receives the editable document (for `await doc.toBlob()`). */
  onDocument?: XlsxWorkbookGridProps['onDocument'];
}

const mountedRoots = new WeakMap<Element, { root: Root; pendingUnmount: boolean; generation: number }>();

/** Imperative mount for non-React hosts. Returns an unmount function. */
export function mount(node: Element, opts: MountOptions): () => void {
  if (!opts.workbook && !opts.blob) throw new Error('A workbook or blob is required');
  let entry = mountedRoots.get(node);
  if (!entry) {
    entry = { root: createRoot(node), pendingUnmount: false, generation: 0 };
    mountedRoots.set(node, entry);
  }
  const mounted = entry;
  const generation = ++mounted.generation;
  mounted.pendingUnmount = false;
  const props = (
    opts.workbook
      ? { workbook: opts.workbook, ...rest(opts) }
      : { blob: opts.blob as Blob, ...rest(opts) }
  ) as XlsxWorkbookGridProps;
  mounted.root.render(createElement(XlsxWorkbookGrid, { ...props, key: generation }));
  return () => {
    // Defer unmount one microtask — React warns if you unmount inside an
    // active render tree (which can happen if a host event triggers
    // close synchronously during a child's commit).
    if (mounted.generation !== generation || mounted.pendingUnmount) return;
    mounted.pendingUnmount = true;
    queueMicrotask(() => {
      if (mounted.generation !== generation || !mounted.pendingUnmount) return;
      mounted.root.unmount();
      mountedRoots.delete(node);
    });
  };
}

function rest(opts: MountOptions) {
  const { workbook: _w, blob: _b, ...r } = opts;
  return r;
}

export { readDataValidations, writeDataValidations, validationSourceResolver } from './dataValidation';
