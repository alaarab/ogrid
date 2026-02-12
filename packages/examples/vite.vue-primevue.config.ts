import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: 'src/vue-primevue',
  build: { outDir: '../../dist/vue-primevue' },
  server: { port: 3022 },
});
