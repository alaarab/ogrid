import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: false,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  // Bundle these into the react package so consumers don't need to
  // traverse extra packages during their build.
  noExternal: ['@alaarab/ogrid-core', '@tanstack/react-virtual'],
  outExtension: () => ({ js: '.js' }),
});
