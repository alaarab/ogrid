import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/material',
  build: { outDir: '../../dist/material' },
  server: { port: 3002 },
});
