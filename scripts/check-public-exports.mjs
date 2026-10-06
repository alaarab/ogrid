#!/usr/bin/env node
// Static public-API check. Runs on source, no build required.
//
// 1. Kit parity: @alaarab/ogrid-react-radix and @alaarab/ogrid-react-fluent
//    export the same set of names, so a consumer can switch kits by changing
//    one import.
// 2. Hook types: every `useX` hook a kit re-exports from @alaarab/ogrid-react
//    comes with its `UseXParams` / `UseXResult` types when react exports them.
// 3. Documented API: every name the docs site imports from an @alaarab/ogrid-*
//    package (in MDX code blocks or page imports) is actually exported by it.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGES = {
  '@alaarab/ogrid-core': 'packages/core/src/index.ts',
  '@alaarab/ogrid-inputs': 'packages/inputs/src/index.ts',
  '@alaarab/ogrid-react': 'packages/react/src/index.ts',
  '@alaarab/ogrid-react-radix': 'packages/react-radix/src/index.ts',
  '@alaarab/ogrid-react-fluent': 'packages/react-fluent/src/index.ts',
  '@alaarab/ogrid-react-inputs': 'packages/react-inputs/src/index.ts',
  '@alaarab/ogrid-react-xlsx': 'packages/react-xlsx/src/index.ts',
};
const KITS = ['@alaarab/ogrid-react-radix', '@alaarab/ogrid-react-fluent'];
const DOCS_DIR = 'packages/docs/docs';
// Placeholder identifiers used in docs prose examples, not real API.
const DOCS_PLACEHOLDERS = new Set(['useX']);

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function resolveRelative(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve "${spec}" from ${fromFile}`);
}

/** Names exported by a TypeScript module, following `export * from './x'` re-exports. */
function exportedNames(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = stripComments(readFileSync(file, 'utf8'));
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const entry = part.trim().replace(/^type\s+/, '');
      if (!entry) continue;
      const alias = entry.split(/\s+as\s+/).pop().trim();
      if (alias !== 'default') names.add(alias);
    }
  }
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
    for (const n of exportedNames(resolveRelative(file, m[1]), seen)) names.add(n);
  }
  return names;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.mdx?$/.test(entry)) yield full;
  }
}

const exportsByPackage = Object.fromEntries(
  Object.entries(PACKAGES).map(([name, file]) => [name, exportedNames(join(root, file))]),
);
const problems = [];

// 1. Kit parity.
const [radix, fluent] = KITS.map((k) => exportsByPackage[k]);
for (const name of radix) if (!fluent.has(name)) problems.push(`${KITS[1]} is missing "${name}" (exported by ${KITS[0]})`);
for (const name of fluent) if (!radix.has(name)) problems.push(`${KITS[0]} is missing "${name}" (exported by ${KITS[1]})`);

// 2. Hook Params/Result types travel with their hook.
const react = exportsByPackage['@alaarab/ogrid-react'];
for (const kit of KITS) {
  const kitExports = exportsByPackage[kit];
  for (const name of kitExports) {
    if (!/^use[A-Z]/.test(name) || !react.has(name)) continue;
    for (const suffix of ['Params', 'Result']) {
      const typeName = `Use${name.slice(3)}${suffix}`;
      if (react.has(typeName) && !kitExports.has(typeName)) {
        problems.push(`${kit} re-exports ${name} but not its ${typeName} type`);
      }
    }
  }
}

// 3. Docs import only real exports.
const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](@alaarab\/ogrid-[a-z-]+)['"]/g;
for (const file of walk(join(root, DOCS_DIR))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(importRe)) {
    const pkg = m[2];
    const available = exportsByPackage[pkg];
    if (!available) {
      problems.push(`${file}: imports from unknown package ${pkg}`);
      continue;
    }
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (!name || DOCS_PLACEHOLDERS.has(name)) continue;
      if (!available.has(name)) problems.push(`${file.slice(root.length + 1)}: "${name}" is not exported by ${pkg}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`check-public-exports: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
const summary = Object.entries(exportsByPackage).map(([n, s]) => `${n.replace('@alaarab/ogrid-', '')}=${s.size}`).join(', ');
console.log(`check-public-exports: ok (${summary})`);
