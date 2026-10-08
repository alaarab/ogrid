import { defineConfig } from 'tsup';

// Self-contained browser ESM. Inlines React, ReactDOM, ExcelJS, and every
// @alaarab/ogrid-* dep so no-bundler consumers can copy dist/ into a
// static vendor/ directory and import the entry directly. Optional UI and
// media passthrough remain separate chunks, without external dependencies.
export default defineConfig({
  entry: { 'ogrid-xlsx': 'src/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  splitting: true,
  treeshake: true,
  clean: false,
  // Types are copied from @alaarab/ogrid-react-xlsx by scripts/copy-types.mjs.
  dts: false,
  target: 'es2020',
  platform: 'browser',
  minify: true,
  noExternal: [/.*/],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.define = {
      ...options.define,
      'process.env.NODE_ENV': '"production"',
    };
  },
  outExtension: () => ({ js: '.js' }),
});
