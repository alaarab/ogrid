import { defineConfig } from 'tsup';
import { copyFileSync } from 'node:fs';
import { singleStylesheet } from '../../scripts/single-stylesheet.mjs';

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
  esbuildPlugins: [{
    name: 'self-contained-xlsx-worker',
    setup(build) {
      build.onResolve({ filter: /xlsxWorkerFactory(?:\.js)?$/ }, () => ({ path: 'xlsx-worker', namespace: 'worker-factory' }));
      build.onLoad({ filter: /.*/, namespace: 'worker-factory' }, () => ({ contents: `export function createXlsxWorker() { return new Worker(new URL('./xlsxWorker.js', import.meta.url), { type: 'module' }); }`, loader: 'js' }));
    },
  }, singleStylesheet('ogrid-xlsx')],
  onSuccess: async () => { copyFileSync(new URL('../react-xlsx/dist/esm/xlsxWorker.js', import.meta.url), new URL('./dist/xlsxWorker.js', import.meta.url)); },
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.define = {
      ...options.define,
      'process.env.NODE_ENV': '"production"',
    };
  },
  outExtension: () => ({ js: '.js' }),
});
