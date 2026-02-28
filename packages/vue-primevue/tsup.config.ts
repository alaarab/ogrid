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
  minify: true,
  external: ['@alaarab/ogrid-vue', '@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', 'vue', 'primevue'],
  outExtension: () => ({ js: '.js' }),
});
