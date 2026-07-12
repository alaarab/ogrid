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
  external: ['@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', '@tanstack/react-virtual', 'react', 'react-dom', '@testing-library/react'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  outExtension: () => ({ js: '.js' }),
});
