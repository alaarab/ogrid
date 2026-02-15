import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  root: 'src/angular-material',
  build: { outDir: '../../dist/angular-material' },
  server: { port: 3011 },
  optimizeDeps: {
    exclude: ['@alaarab/ogrid-angular', '@alaarab/ogrid-angular-material']
  },
});
