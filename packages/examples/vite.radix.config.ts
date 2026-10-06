import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/radix',
  cacheDir: 'node_modules/.vite-radix',
  build: {
    outDir: '../../dist/radix',
    emptyOutDir: true,
    // Every page, including the filter-options fixture the e2e suite visits.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./src/radix/index.html', import.meta.url)),
        filterOptions: fileURLToPath(new URL('./src/radix/filter-options.html', import.meta.url)),
      },
    },
  },
  server: { port: 3003 },
  preview: { port: 3003, strictPort: true },
});
