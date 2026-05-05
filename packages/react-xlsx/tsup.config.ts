import { defineConfig } from 'tsup';

// SheetJS is bundled into this package — the whole point is "drop a Blob,
// get a grid" with no extra install. Everything else (react, ogrid)
// stays external so consumers control versions and the bundle stays small.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: false,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  minify: true,
  external: [
    '@alaarab/ogrid-react',
    '@alaarab/ogrid-core',
    '@alaarab/ogrid-core/formula',
    '@alaarab/ogrid-react-radix',
    'react',
    'react-dom',
    'react/jsx-runtime',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  outExtension: () => ({ js: '.js' }),
});
