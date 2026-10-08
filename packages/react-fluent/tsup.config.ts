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
  external: ['@alaarab/ogrid-react', '@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', '@alaarab/ogrid-core/formula/assist', '@tanstack/react-virtual', '@fluentui/react-components', '@fluentui/react-icons', 'react', 'react-dom'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Resolve the JSX runtime to scripts/react-jsx so React 17 works under
    // strict ESM (see scripts/react-jsx/jsx-runtime.js).
    options.jsxImportSource = 'ogrid-react-jsx';
    options.alias = { ...options.alias, 'ogrid-react-jsx': '../../scripts/react-jsx' };
    options.banner = { js: "import './index.css';" };
  },
  esbuildPlugins: [sassPlugin({ transform: postcssModules({ generateScopedName: 'ogrid-fluent__[name]__[local]' }) })],
  outExtension: () => ({ js: '.js' }),
});
