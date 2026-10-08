import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Compile modal SCSS modules into their lazy JS instead of the entry CSS.
 * The component renders __css in a style element. Source consumers still get
 * normal SCSS module loading; no browser globals execute during SSR imports.
 */
export function lazyStylesheet(compile, transform) {
  return {
    name: 'ogrid-lazy-stylesheet',
    setup(build) {
      build.onLoad({ filter: /DataValidationDialog\.module\.scss$/ }, async ({ path }) => {
        const result = compile(path, { style: 'compressed' });
        const module = await transform(result.css, dirname(path), path);
        return {
          contents: `export default {...${module.pluginData.exports},__css:${JSON.stringify(module.contents)}};`,
          loader: 'js',
          watchFiles: result.loadedUrls.filter(url => url.protocol === 'file:').map(fileURLToPath),
        };
      });
    },
  };
}
