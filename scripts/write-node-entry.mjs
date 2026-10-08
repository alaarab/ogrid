#!/usr/bin/env node
// Write a stylesheet-free copy of a kit's built entry for plain-Node loaders.
//
// The kit entries start with `import './index.css'` so bundlers pick up the
// styles with no extra import. Node itself has no CSS loader, so anything that
// loads the package with Node's own resolver (Vite SSR and Vitest externalized
// deps, SSR smoke scripts) throws ERR_UNKNOWN_FILE_EXTENSION on that import.
// package.json routes those loaders here through the "node" export condition;
// bundlers match the earlier "module" condition and keep getting the styled
// entry.
//
// Usage (run from a package directory, after add-use-client):
//   node ../../scripts/write-node-entry.mjs [dist/esm/index.js] [dist/esm/index.node.js]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [source = 'dist/esm/index.js', target = 'dist/esm/index.node.js'] = process.argv.slice(2);
const sourcePath = resolve(process.cwd(), source);
if (!existsSync(sourcePath)) {
  console.error(`write-node-entry: ${source} not found`);
  process.exit(1);
}
const code = readFileSync(sourcePath, 'utf8');
const cssImport = /import\s*['"]\.\/index\.css['"];?/;
if (!cssImport.test(code)) {
  // Split chunks stay stylesheet-free for Node. Only the browser entry
  // imports the combined CSS, after its React Server Component directive.
  if (!existsSync(resolve(sourcePath, '../index.css'))) {
    console.error(`write-node-entry: ${source} has no sibling index.css`);
    process.exit(1);
  }
  const directive = /^\s*["']use client["'];?/;
  const styled = directive.test(code)
    ? code.replace(directive, match => `${match}\nimport './index.css';`)
    : `import './index.css';\n${code}`;
  writeFileSync(sourcePath, styled);
}
writeFileSync(resolve(process.cwd(), target), code.replace(cssImport, ''));
console.log(`write-node-entry: wrote ${target}`);
