import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/js',
  build: { outDir: '../../dist/js' },
  server: { port: 3030 },
});
