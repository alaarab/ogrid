import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/js',
  cacheDir: 'node_modules/.vite-js',
  build: { outDir: '../../dist/js' },
  server: { port: 3030 },
});
