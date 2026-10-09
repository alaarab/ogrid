# @alaarab/ogrid-react-xlsx

Show `.xlsx`, CSV or TSV files as an OGrid spreadsheet, edit a workbook and export `.xlsx`. Built on ExcelJS and the Radix kit. Requires React and ReactDOM 18 or 19.

```bash
npm install @alaarab/ogrid-react-xlsx react react-dom
```

```tsx
import { XlsxWorkbookGrid } from '@alaarab/ogrid-react-xlsx';

export function WorkbookEditor({ file }: { file: Blob }) {
  return <XlsxWorkbookGrid blob={file} height={600} editable exportFileName="book.xlsx" />;
}
```

Styles, number formats, widths, row heights, merges, freeze panes, validation, conditional formatting and notes round-trip. The toolbar edits fonts, borders, fills, alignment, number formats and merges. Row/column insert/delete shifts formulas, defined range names and worksheet metadata, with workbook-wide undo. Images display over cells; charts show title placeholders and pivots show saved cells. Sheet names, order and tab colors are preserved; this wrapper's tabs switch sheets rather than expose the general grid's tab-editing callbacks.

Blobs of at least 1 MiB without `onDocument` use a progressive worker value preview, with progress and Cancel. `streaming={true}` opts smaller files in; `streaming={false}` gives the eager formatted view. CSV/TSV use the eager loader. **Enable editing** prepares the full document; before editing, streamed export returns the original Blob byte-for-byte. Workers and streaming code load separately, with a cooperative preview fallback if Workers are unavailable.

For host-managed export, keep the document from `onDocument`:

```tsx
import { useRef } from 'react';
import { XlsxWorkbookGrid, type XlsxWorkbookDocument } from '@alaarab/ogrid-react-xlsx';

export function HostEditor({ file }: { file: Blob }) {
  const docRef = useRef<XlsxWorkbookDocument | null>(null);
  return (
    <>
      <button type="button" onClick={() => { void docRef.current?.download('book.xlsx'); }}>Save</button>
      <XlsxWorkbookGrid
        blob={file} height={600} editable
        onDocument={(doc) => { docRef.current = doc; }}
      />
    </>
  );
}
```

`onDocument` disables automatic streaming; explicit `streaming={true}` defers it until Enable editing. Documents expose `setCellValues`, `applyStyle`, `mergeCells`, `setFreeze`, `setRowHeight`, `insertRows`, `deleteRows`, `insertColumns`, `deleteColumns`, `undo`, `redo`, `toWorkbook`, `toBlob` and `download`.

Other entry points: `XlsxGrid` for a parsed sheet; `workbookFromBlob` / `sheetToGridData` for parsing; `streamWorkbook` for chunk/progress callbacks and lazy document loading; `exportToXlsx`, `workbookFromGridData`, `xlsxBlobFromWorkbook` for export; `mount` for DOM hosts.

Limits worth knowing:

- Charts/pivots require original bytes loaded through `blob` or `workbookFromBlob` and OGrid's Blob export helpers. Chart rendering, pivot authoring and media editing aren't implemented; media anchors and chart/pivot ranges don't shift with structure edits.
- ExcelJS cannot write native dynamic-array metadata itself. OGrid's OOXML export preserves imported metadata and emits it for new spills; raw ExcelJS `writeBuffer()` bypasses that and chart/pivot preservation.
- Streaming previews values and cached formula results. Editing, edited export and structural undo still use the full ExcelJS model. Default limits: 50 MiB input, 200 MiB uncompressed ZIP, 1,048,576 worksheet rows, 1,000 columns and 5,100,000 mapped cells per sheet; streaming shared strings are capped at 32 MiB. Configure `limits` / `streamOptions` and handle `onTruncated` as needed.
- XLSX rows without saved heights don't auto-fit wrap text; formatting a virtual selection affects rendered rows. Header promotion changes formula coordinates; use `headerRow="none"` when source row references must stay intact.

ExcelJS loads statically. Lazy-load the route that imports this package to keep it out of the initial app bundle. For no-bundler hosts, use `@alaarab/ogrid-react-xlsx-browser`.

See [XLSX API, fidelity and measured large-file limits](https://alaarab.github.io/ogrid/docs/features/xlsx-import) and [formulas/spills](https://alaarab.github.io/ogrid/docs/features/formulas). MIT licensed; version 2.19.0.
