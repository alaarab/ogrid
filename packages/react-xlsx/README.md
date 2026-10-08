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

Cells show the workbook's styles and number formats, and column widths come from the sheet. To edit and save:

```tsx
<XlsxWorkbookGrid blob={file} editable exportFileName="book.xlsx" onDocument={(doc) => (docRef.current = doc)} />
// later: const blob = await docRef.current.toBlob();
```

`editable` turns on value/formula editing and a formatting toolbar (bold, italic, underline, strikethrough, colors, alignment, number format, merge/unmerge) with undo. Export keeps every sheet and writes back only what changed, so styles, validations, frozen panes, merges, hyperlinks and the rest of the file survive. The docs page lists exactly what round-trips.

Other entry points:

- `XlsxGrid` renders one sheet of an already-parsed ExcelJS workbook.
- `workbookFromBlob` and `sheetToGridData` parse without rendering.
- `exportToXlsx`, `workbookFromGridData` and `xlsxBlobFromWorkbook` handle export.
- `mount(node, { blob })` renders into a DOM node for non-React hosts. Call the returned function to unmount.

### Untrusted files

A few-KB file can declare a used range of billions of cells. Grid mapping is capped by `maxRows`, `maxCols` and `maxCells` (defaults: 1,048,576 worksheet rows, 1,000 columns, 5,000,000 cells). Pass `limits` to `XlsxGrid`/`XlsxWorkbookGrid`, or the same options to `sheetToGridData`. When a sheet is cut, the grid shows a notice and `sheetToGridData` returns `truncated` with the full size. A `NaN` limit uses the default, `Infinity` removes the limit, and other values are rounded down to at least one.

`workbookFromBlob(blob, options)` and blob-backed `XlsxWorkbookGrid` also enforce `maxFileBytes` (default 50 MiB) before reading, and `maxUncompressedBytes` (default 200 MiB) against the ZIP directory before ExcelJS parsing. Multi-volume archives are rejected. CSV parsing stops at the row/cell limits and drops columns beyond the column limit; `parseTruncated` indicates that the original extent is unknown. These byte limits can be configured in `limits`. Pre-parsed workbooks bypass byte checks.

XLSX row/cell limits bound grid mapping, **not ExcelJS parsing**. ExcelJS still inflates and parses the complete workbook, and ZIP sizes are declared metadata rather than a bound enforced during decompression. Use a trusted or independently bounded parser when a strict parse-time memory limit is required.

### Formulas

Imported formulas start with `=`. Shared formulas expand to each cell's references. Promoting a header row rebases local references, including absolute rows, into grid data coordinates the way deleting that row would in Excel: a range that starts on it shrinks, and a single reference to it becomes `#REF!`. The grid shows the file's cached result for those formulas instead of recalculating them. Sheet-qualified references keep worksheet coordinates and read other sheets' cached values. The grid preserves cached results for unsupported syntax, functions, named ranges or missing sheets; those formulas remain in `sheetToGridData().initialFormulas` for export but are not loaded into the live engine.

Export accepts formulas in grid data coordinates, removes the leading `=`, and adds the worksheet header offset to local references. Keep `items` and `columns` in the order used to key the formulas. Export creates one sheet; callers exporting cross-sheet formulas must provide the referenced sheets themselves. Non-finite numeric values become empty cells, and invalid sheet names are sanitized.

### Bundle size

ExcelJS is imported statically, because every entry point needs it. To keep it out of your initial bundle, lazy-load the component that uses this package:

```tsx
const XlsxViewer = React.lazy(() => import('./XlsxViewer'));
```

For apps without a bundler, use `@alaarab/ogrid-react-xlsx-browser`.
