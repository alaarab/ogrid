import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  root: 'src/angular-primeng',
  cacheDir: 'node_modules/.vite-angular-primeng',
  build: { outDir: '../../dist/angular-primeng' },
  server: { port: 3012 },
});
