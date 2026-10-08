import { defineConfig } from 'tsup';
import { compile } from 'sass';
import { scopedClassName, compactModules } from '../../scripts/scoped-classname.mjs';
import { lazyStylesheet } from '../../scripts/lazy-stylesheet.mjs';
import { sassPlugin, postcssModules } from 'esbuild-sass-plugin';
import { singleStylesheet } from '../../scripts/single-stylesheet.mjs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  splitting: true,
  treeshake: true,
  clean: false,
  dts: false,
  target: 'es2020',
  minify: true,
  external: ['@alaarab/ogrid-react', '@alaarab/ogrid-react/data-validation', '@alaarab/ogrid-core', '@alaarab/ogrid-core/formula', '@alaarab/ogrid-core/formula/assist', '@tanstack/react-virtual', '@fluentui/react-components', '@fluentui/react-icons', 'react', 'react-dom'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    // Resolve the JSX runtime to scripts/react-jsx so React 17 works under
    // strict ESM (see scripts/react-jsx/jsx-runtime.js).
    options.jsxImportSource = 'ogrid-react-jsx';
    options.alias = { ...options.alias, 'ogrid-react-jsx': '../../scripts/react-jsx' };
  },
  esbuildPlugins: [
    // Keep modal-only SCSS with the lazy dialog, including in browser consumers.
    lazyStylesheet(compile, compactModules(postcssModules({ generateScopedName: scopedClassName('f', new URL('./src/', import.meta.url)) }))),
    sassPlugin({ transform: compactModules(postcssModules({ generateScopedName: scopedClassName('f', new URL('./src/', import.meta.url)) })) }), singleStylesheet()],
  outExtension: () => ({ js: '.js' }),
});
