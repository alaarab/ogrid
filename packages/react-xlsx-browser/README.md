# @alaarab/ogrid-react-xlsx-browser

Self-contained browser ESM bundle of `ogrid-react-xlsx`, including React, ReactDOM, ExcelJS and OGrid dependencies. For static pages and other hosts without a bundler. No host React installation is required.

```bash
npm install @alaarab/ogrid-react-xlsx-browser
```

Copy the **complete `dist/` directory** into your static `vendor/` directory, including all JS/CSS chunks and `xlsxWorker.js`. Keep relative paths and serve JavaScript with a JavaScript MIME type. Optional UI, media and streaming code load on demand.

```html
<link rel="stylesheet" href="/vendor/ogrid-xlsx.css" />
<div id="sheet" style="height: 600px"></div>
<script type="module">
  const { mount } = await import('/vendor/ogrid-xlsx.js');
  const blob = await (await fetch('/files/report.xlsx')).blob();
  const node = document.getElementById('sheet');
  if (!node) throw new Error('Sheet container is missing');
  const unmount = mount(node, {
    blob, editable: true, exportFileName: 'report.xlsx',
  });
  // Call unmount() before removing the node.
</script>
```

This includes the workbook editor's formatting, merges/freezing, structure edits, validation, notes, images and chart/pivot preservation. Charts show placeholders rather than rendered charts. The same [fidelity and load limits](https://alaarab.github.io/ogrid/docs/features/xlsx-import) apply.

Blobs of at least 1 MiB without `onDocument` use a progressive worker preview. Use `streaming: false` for the eager formatted view. With `editable: true`, Enable editing prepares the full document; unedited streamed export returns the original bytes.

The v2.19.0 size-limit entry measures **506.66 kB minified + Brotli**, within its 522 kB budget; the validation dialog measures 9.39 kB separately. These are independent entry measurements, not the total download of `dist/`; see the [root size table](../../README.md#bundle-sizes-minified--brotli).

Use `mount()` to render with the bundle's React. Rendering its exported components in a host React tree creates a second React copy. Apps with a bundler should use `@alaarab/ogrid-react-xlsx` instead.

See the [XLSX guide](https://alaarab.github.io/ogrid/docs/features/xlsx-import#browser-bundle-no-bundler). MIT licensed; version 2.19.0.
