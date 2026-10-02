#!/usr/bin/env node
// Prepend the "use client" directive to built React entry files so React Server
// Component frameworks (Next.js App Router) treat the package as client code.
// It can't come from tsup's `banner`: the `treeshake` (Rollup) pass drops
// module-level directives ('Module level directives cause errors when bundled
// ... was ignored'). Idempotent: skips files that already start with it.
//
// Usage (run from a package directory):
//   node ../../scripts/add-use-client.mjs [dist/esm/index.js ...]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = process.argv.slice(2);
if (targets.length === 0) targets.push('dist/esm/index.js');

for (const target of targets) {
  const file = resolve(process.cwd(), target);
  if (!existsSync(file)) {
    console.error(`add-use-client: ${target} not found`);
    process.exitCode = 1;
    continue;
  }
  const source = readFileSync(file, 'utf8');
  if (/^\s*["']use client["'];?/.test(source)) continue;
  writeFileSync(file, `"use client";\n${source}`);
  console.log(`add-use-client: prepended directive to ${target}`);
}
