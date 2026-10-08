// Re-export everything from the regular React package. tsup with
// `noExternal: [/.*/]` then inlines @alaarab/ogrid-react-xlsx and every
// dep behind it (React, ReactDOM, ExcelJS, ogrid-core/react/react-radix)
// into a browser-ready ESM entry and its local lazy chunks in dist/.
//
// WARNING: this bundle contains its own copy of React. The re-exported
// components (XlsxGrid, XlsxWorkbookGrid) are only safe when rendered by
// this bundle's React via mount(). Do NOT render them from a host React
// app  -  that renders two Reacts and throws "Invalid hook call". Bundler
// users should import the components from @alaarab/ogrid-react-xlsx instead.
export * from '@alaarab/ogrid-react-xlsx';
