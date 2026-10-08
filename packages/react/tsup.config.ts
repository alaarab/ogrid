import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/testing/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: false,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  minify: true,
  external: ['@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', '@alaarab/ogrid-core/formula/assist', '@tanstack/react-virtual', 'react', 'react-dom', '@testing-library/react'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Resolve the JSX runtime to scripts/react-jsx so React 17 works under
    // strict ESM (see scripts/react-jsx/jsx-runtime.js).
    options.jsxImportSource = 'ogrid-react-jsx';
    options.alias = { ...options.alias, 'ogrid-react-jsx': '../../scripts/react-jsx' };
  },
  outExtension: () => ({ js: '.js' }),
});
