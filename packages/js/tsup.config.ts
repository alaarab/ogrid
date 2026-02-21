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
  // Bundle core into js so consumers only traverse one package.
  noExternal: ['@alaarab/ogrid-core'],
  outExtension: () => ({ js: '.js' }),
});
