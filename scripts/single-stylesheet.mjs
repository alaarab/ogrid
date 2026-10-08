import { resolve } from 'node:path';

/** Esbuild includes lazy imports' CSS in the entry's CSS bundle. Ship that
 * complete stylesheet alone; JS chunks intentionally have no CSS loader.
 * Check the build graph so a newly introduced lazy stylesheet cannot silently
 * escape the documented import (including in the no-bundler XLSX build).
 */
export function singleStylesheet(entry = 'index') {
  return {
    name: 'ogrid-single-stylesheet',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length || !result.outputFiles || !result.metafile) return;
        const cssPath = resolve(build.initialOptions.outdir, `${entry}.css`);
        const outputs = Object.entries(result.metafile.outputs);
        const css = outputs.find(([path]) => resolve(path) === cssPath)?.[1];
        if (!css) return { errors: [{ text: `Missing ${entry}.css` }] };
        const inputs = new Set(Object.keys(css.inputs));
        for (const [path, output] of outputs) {
          if (!path.endsWith('.css')) continue;
          for (const input of Object.keys(output.inputs)) {
            if (!inputs.has(input)) {
              return { errors: [{ text: `${input} is missing from ${entry}.css` }] };
            }
          }
        }
        result.outputFiles = result.outputFiles.filter(file => !file.path.endsWith('.css') || file.path === cssPath);
      });
    },
  };
}
