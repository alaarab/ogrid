/**
 * Strip MDX import lines (e.g. `import Foo from '@site/...'`), which reference
 * Docusaurus components that aren't available outside the docs build.
 * Imports inside fenced code blocks are part of the examples and are kept.
 */
export function stripImports(content) {
  let inFence = false;
  return content
    .split('\n')
    .filter((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      return inFence || !/^import\s+/.test(line);
    })
    .join('\n');
}
