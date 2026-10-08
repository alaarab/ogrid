import { defineConfig } from 'tsup';

// Everything stays external: react, the ogrid packages, and ExcelJS (a
// regular dependency, so it installs automatically). ExcelJS is imported
// statically because every entry point needs it and workbookFromGridData is
// synchronous; apps that want it off the initial bundle should lazy-load the
// route or component that uses this package (React.lazy / dynamic import).
// @alaarab/ogrid-react-xlsx-browser is the self-contained bundle.
export default defineConfig([{
  entry: ['src/index.ts', 'src/xlsxWorkerFactory.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  // XLSX media display and OOXML passthrough load on demand.
  splitting: true,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  minify: true,
  external: [
    '@alaarab/ogrid-react',
    '@alaarab/ogrid-core',
    '@alaarab/ogrid-core/formula', '@alaarab/ogrid-core/formula/assist',
    '@alaarab/ogrid-react-radix',
    'react',
    'react-dom',
    'react/jsx-runtime',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  outExtension: () => ({ js: '.js' }),
}, {
  entry: ['src/xlsxWorker.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: false,
  clean: false,
  dts: false,
  target: 'es2020',
  platform: 'browser',
  minify: true,
  noExternal: [/.*/],
  esbuildOptions(options) { options.define = { 'process.env.NODE_ENV': '"production"' }; },
  outExtension: () => ({ js: '.js' }),
}]);
