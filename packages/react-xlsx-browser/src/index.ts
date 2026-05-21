// Re-export everything from the regular React package. tsup with
// `noExternal: [/.*/]` then inlines @alaarab/ogrid-react-xlsx and every
// dep behind it (React, ReactDOM, ExcelJS, ogrid-core/react/react-radix)
// into a single browser-ready ESM file at dist/ogrid-xlsx.js.
export * from '@alaarab/ogrid-react-xlsx';
