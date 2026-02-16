import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  root: 'src/angular-radix',
  cacheDir: 'node_modules/.vite-angular-radix',
  build: { outDir: '../../dist/angular-radix' },
  server: { port: 3010 },
  optimizeDeps: {
    exclude: ['@alaarab/ogrid-angular', '@alaarab/ogrid-angular-radix']
  },
});
