import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/fluent',
  cacheDir: 'node_modules/.vite-fluent',
  build: {
    outDir: '../../dist/fluent',
    emptyOutDir: true,
    // Every page, including the filter-options fixture the e2e suite visits.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./src/fluent/index.html', import.meta.url)),
        filterOptions: fileURLToPath(new URL('./src/fluent/filter-options.html', import.meta.url)),
      },
    },
  },
  server: { port: 3001 },
  preview: { port: 3001, strictPort: true },
});
