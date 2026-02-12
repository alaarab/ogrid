import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  root: 'src/angular-radix',
  build: { outDir: '../../dist/angular-radix' },
  server: { port: 3010 },
});
