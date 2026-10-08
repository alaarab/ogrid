# @alaarab/ogrid-react-xlsx-browser

A self-contained ES module graph of `@alaarab/ogrid-react-xlsx`, with React, ReactDOM, ExcelJS and every OGrid dependency included. It's for apps without a bundler: copy the files into a static `vendor/` directory and `import()` them.

A browser ESM package of `@alaarab/ogrid-react-xlsx`, with React, ReactDOM, ExcelJS and every OGrid dependency bundled. It's for apps without a bundler: copy the files into a static `vendor/` directory and `import()` the entry. Streaming modules and the worker load on demand.

## Install

```bash
npm install @alaarab/ogrid-react-xlsx-browser
```

Copy every `.js` and `.css` file from `dist/` into the same static directory. Import `ogrid-xlsx.js` and link `ogrid-xlsx.css` as below. Keep the sibling chunks beside the entry: optional UI, drag behavior and media load them on demand.

Copy **all `.js` files and the CSS in `dist/`**, including `xlsxWorker.js`, into your static assets. Keep relative paths and serve JS with a JavaScript MIME type. The worker is self-contained and requires no dependency installation on the host.

## Usage

```html
<link rel="stylesheet" href="/vendor/ogrid-xlsx.css" />
<div id="sheet" style="height: 600px"></div>
<script type="module">
  const { mount } = await import('/vendor/ogrid-xlsx.js');
  const blob = await (await fetch('/files/report.xlsx')).blob();
  const unmount = mount(document.getElementById('sheet'), { blob });
  // Call unmount() before removing the node.
</script>
```

The complete module graph measures about 615 kB with gzip, or 486.30 kB after minification and Brotli compression (the size gate), within its 505.8 kB budget. These totals include deferred chunks; the initial entry does not load optional UI or media. If you have a bundler, use `@alaarab/ogrid-react-xlsx` instead so React and ExcelJS aren't duplicated. See its README for the API and the load limits for untrusted files.

Blobs of at least 1 MiB without `onDocument` use a progressive worker preview automatically. Set
`streaming: true` to stream smaller files too. With `editable: true`, choose
**Enable editing** after loading to prepare the full document. Until then,
Export returns the original file byte-for-byte. Use `streaming: false` for
the eager formatted view. If you have a bundler, use
`@alaarab/ogrid-react-xlsx` so React and ExcelJS aren't duplicated.

## Rendering the exported components

This bundle inlines its own copy of React, so the re-exported `XlsxGrid` and `XlsxWorkbookGrid` components must only be rendered by the bundle's React through `mount()`. Do not render them from a host React app: you would end up with two React copies and an "Invalid hook call" error. With a bundler, import those components from `@alaarab/ogrid-react-xlsx` instead.
