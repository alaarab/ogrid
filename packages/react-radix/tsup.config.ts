import { defineConfig } from 'tsup';
import { sassPlugin, postcssModules } from 'esbuild-sass-plugin';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: false,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  minify: true,
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.banner = { js: "import './index.css';" };
  },
  esbuildPlugins: [sassPlugin({ transform: postcssModules({ generateScopedName: 'ogrid-radix__[name]__[local]' }) })],
  outExtension: () => ({ js: '.js' }),
});
