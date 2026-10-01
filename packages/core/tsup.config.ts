import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/formula/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: true,
  treeshake: true,
  clean: false, // rimraf dist handles cleanup
  dts: false,   // tsc --emitDeclarationOnly handles types
  target: 'es2020',
  minify: true,
  outExtension: () => ({ js: '.js' }),
});
