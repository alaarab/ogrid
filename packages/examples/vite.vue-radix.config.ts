import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: 'src/vue-radix',
  cacheDir: 'node_modules/.vite-vue-radix',
  build: { outDir: '../../dist/vue-radix' },
  server: { port: 3020 },
});
