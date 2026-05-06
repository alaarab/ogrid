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
// Format support: .xlsx + CSV/TSV. Built on ExcelJS (active, MIT, on
// npm). The previous SheetJS-backed builds are gone — `xlsx` on npm is
// stuck at the vulnerable 0.18.5. See CHANGELOG 2.12.0 for the swap.

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type ExcelJS from 'exceljs';
import { XlsxWorkbookGrid, type XlsxWorkbookGridProps } from './XlsxWorkbookGrid';
export { XlsxGrid, type XlsxGridProps } from './XlsxGrid';
export { XlsxWorkbookGrid, type XlsxWorkbookGridProps } from './XlsxWorkbookGrid';
export {
  workbookFromBlob,
  sheetToGridData,
  listSheets,
  type SheetGridData,
  type SheetRow,
} from './sheetMapper';

export interface MountOptions {
  /** Pre-parsed workbook (use this OR blob, not both). */
  workbook?: ExcelJS.Workbook;
  /** Raw blob — parsed lazily inside the component. */
  blob?: Blob;
  initialSheet?: string;
  density?: 'compact' | 'normal' | 'comfortable';
  height?: number | string;
  onSheetChange?: (sheetName: string) => void;
}

/** Imperative mount for non-React hosts. Returns an unmount function. */
export function mount(node: Element, opts: MountOptions): () => void {
  const root = createRoot(node);
  const props = (
    opts.workbook
      ? { workbook: opts.workbook, ...rest(opts) }
      : { blob: opts.blob as Blob, ...rest(opts) }
  ) as XlsxWorkbookGridProps;
  root.render(createElement(XlsxWorkbookGrid, props));
  return () => {
    // Defer unmount one microtask — React warns if you unmount inside an
    // active render tree (which can happen if a host event triggers
    // close synchronously during a child's commit).
    queueMicrotask(() => root.unmount());
  };
}

function rest(opts: MountOptions) {
  const { workbook: _w, blob: _b, ...r } = opts;
  return r;
}
