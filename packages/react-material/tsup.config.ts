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
  outExtension: () => ({ js: '.js' }),
});
