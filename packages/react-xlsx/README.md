# @alaarab/ogrid-react-xlsx

Show an `.xlsx`, `.csv` or `.tsv` file as an OGrid spreadsheet, with sheet tabs, cell references and formulas, and export grids back to `.xlsx`. Built on ExcelJS and the Radix OGrid kit.

## Install

```bash
npm install @alaarab/ogrid-react-xlsx
```

Requires React 18 or 19.

## Usage

```tsx
import { XlsxWorkbookGrid } from '@alaarab/ogrid-react-xlsx';

<XlsxWorkbookGrid blob={file} height={600} />
```

Other entry points:

- `XlsxGrid` renders one sheet of an already-parsed ExcelJS workbook.
- `workbookFromBlob` and `sheetToGridData` parse without rendering.
- `exportToXlsx`, `workbookFromGridData` and `xlsxBlobFromWorkbook` handle export.
- `mount(node, { blob })` renders into a DOM node for non-React hosts. Call the returned function to unmount.

### Untrusted files

A few-KB file can declare a used range of billions of cells. Loading is capped by `maxRows`, `maxCols` and `maxCells` (defaults: 1,048,576 rows, 1,000 columns, 5,000,000 cells). Pass `limits` to `XlsxGrid`/`XlsxWorkbookGrid`, or the same options to `sheetToGridData`. When a sheet is cut, the grid shows a notice and `sheetToGridData` returns `truncated` with the full size.

### Bundle size

ExcelJS is imported statically, because every entry point needs it. To keep it out of your initial bundle, lazy-load the component that uses this package:

```tsx
const XlsxViewer = React.lazy(() => import('./XlsxViewer'));
```

For apps without a bundler, use `@alaarab/ogrid-react-xlsx-browser`.
