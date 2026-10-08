import { defineConfig, type Options } from 'tsup';

const shared: Options = {
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: false,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  minify: true,
  external: ['@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', '@alaarab/ogrid-core/formula/assist', '@tanstack/react-virtual', 'react', 'react-dom', '@testing-library/react', './DragDataGridTable.js'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Resolve the JSX runtime to scripts/react-jsx so React 17 works under
    // strict ESM (see scripts/react-jsx/jsx-runtime.js).
    options.jsxImportSource = 'ogrid-react-jsx';
    options.alias = { ...options.alias, 'ogrid-react-jsx': '../../scripts/react-jsx' };
  },
  outExtension: () => ({ js: '.js' }),
};

// Build the optional feature independently: sharing its hook with the public
// hook re-export would hoist drag code into the initial table chunk.
export default defineConfig([
  { ...shared, splitting: true, entry: { index: 'src/index.ts', 'testing/index': 'src/testing/index.ts', 'data-validation': 'src/components/DataValidationForm.tsx' } },
  { ...shared, entry: { DragDataGridTable: 'src/components/DragDataGridTable.tsx' } },
]);
