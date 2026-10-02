# @alaarab/ogrid-react-xlsx-browser

A single self-contained ES module of `@alaarab/ogrid-react-xlsx`, with React, ReactDOM, ExcelJS and every OGrid package inlined. It's for apps without a bundler: copy the files into a static `vendor/` directory and `import()` them.

## Install

```bash
npm install @alaarab/ogrid-react-xlsx-browser
```

Copy `dist/ogrid-xlsx.js` and `dist/ogrid-xlsx.css` from the package into your static assets.

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

The bundle is about 1.5 MB raw (about 500 KB gzipped). If you have a bundler, use `@alaarab/ogrid-react-xlsx` instead so React and ExcelJS aren't duplicated. See its README for the API and the load limits for untrusted files.

## Rendering the exported components

This bundle inlines its own copy of React, so the re-exported `XlsxGrid` and `XlsxWorkbookGrid` components must only be rendered by the bundle's React through `mount()`. Do not render them from a host React app: you would end up with two React copies and an "Invalid hook call" error. With a bundler, import those components from `@alaarab/ogrid-react-xlsx` instead.
