import { defineConfig } from 'tsup';
export default defineConfig({
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
});
