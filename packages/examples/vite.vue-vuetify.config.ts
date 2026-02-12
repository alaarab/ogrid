import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: 'src/vue-vuetify',
  build: { outDir: '../../dist/vue-vuetify' },
  server: { port: 3021 },
});
