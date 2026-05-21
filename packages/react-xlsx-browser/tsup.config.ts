import { defineConfig } from 'tsup';

// Self-contained browser ESM. Inlines React, ReactDOM, ExcelJS, and every
// @alaarab/ogrid-* dep so no-bundler consumers can drop the file in a
// static vendor/ dir and `import()` it directly. ~1.5 MB raw / ~500 KB
// gzipped — pays for itself by removing the consumer's need to bundle
// the transitive React + xlsx graph themselves.
export default defineConfig({
  entry: { 'ogrid-xlsx': 'src/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  clean: false,
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
