import { defineConfig } from 'tsup';
export default defineConfig([
  // Main MCP server binary (Node.js)
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist/esm',
    splitting: false,
    treeshake: true,
    clean: true,
    dts: false,
    target: 'esnext',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // Bridge client — browser-safe (no Node.js imports), separate entry point
  {
    entry: { 'bridge-client': 'src/bridge-client.ts' },
    format: ['esm'],
    outDir: 'dist/esm',
    splitting: false,
    treeshake: true,
    dts: true,
    target: 'es2020',
    platform: 'browser',
  },
]);
