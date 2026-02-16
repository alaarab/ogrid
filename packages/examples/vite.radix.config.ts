import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/radix',
  cacheDir: 'node_modules/.vite-radix',
  build: { outDir: '../../dist/radix' },
  server: { port: 3003 },
});
