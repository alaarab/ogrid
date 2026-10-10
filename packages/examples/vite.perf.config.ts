import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

/**
 * Large-grid benchmark build (src/radix/perf-large-grid.html).
 *
 * OGRID_PERF_RADIX points `@alaarab/ogrid-react-radix` at another install of
 * the package (e.g. a published version in /tmp/v2.18.0/node_modules/...) so
 * the same page can be measured against older releases. OGRID_PERF_OUT picks
 * the output directory.
 */
const radixOverride = process.env.OGRID_PERF_RADIX;

export default defineConfig({
  plugins: [react()],
  root: 'src/radix',
  cacheDir: 'node_modules/.vite-perf',
  // Relative asset URLs so a build can be served from any directory.
  base: './',
  resolve: {
    alias: radixOverride ? { '@alaarab/ogrid-react-radix': radixOverride } : {},
    // Published installs bring no React/Radix of their own; use the examples' copies.
    dedupe: ['react', 'react-dom', '@radix-ui/react-checkbox', '@radix-ui/react-popover'],
  },
  build: {
    outDir: process.env.OGRID_PERF_OUT ?? '../../dist/perf',
    emptyOutDir: true,
    // OGRID_PERF_MINIFY=0 keeps function names readable in CPU profiles.
    minify: process.env.OGRID_PERF_MINIFY !== '0',
    rollupOptions: {
      input: { perf: fileURLToPath(new URL('./src/radix/perf-large-grid.html', import.meta.url)) },
    },
  },
  preview: { port: 3009, strictPort: true },
});
