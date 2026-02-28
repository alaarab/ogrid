import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      outDir: 'dist/types',
      exclude: ['src/**/__tests__/**'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist/esm',
    rollupOptions: {
      external: [
        'vue',
        '@alaarab/ogrid-core',
        '@alaarab/ogrid-vue',
        '@headlessui/vue',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          // Keep CSS files next to their component
          return assetInfo.names?.[0] ?? assetInfo.name ?? '[name][extname]';
        },
      },
    },
    cssCodeSplit: true,
    minify: 'esbuild',
  },
  css: {
    preprocessorOptions: {
      scss: {},
    },
  },
});
