import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/fluent',
  build: { outDir: '../../dist/fluent' },
  server: { port: 3001 },
});
