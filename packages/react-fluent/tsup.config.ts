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
  external: ['@alaarab/ogrid-react', '@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', '@tanstack/react-virtual', '@fluentui/react-components', '@fluentui/react-icons', 'react', 'react-dom'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.banner = { js: "import './index.css';" };
  },
  esbuildPlugins: [sassPlugin({ transform: postcssModules({ generateScopedName: 'ogrid-fluent__[name]__[local]' }) })],
  outExtension: () => ({ js: '.js' }),
});
