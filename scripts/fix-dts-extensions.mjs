#!/usr/bin/env node
// Rewrite extensionless relative specifiers in emitted .d.ts files
// ('./types' -> './types/index.js', './utils/x' -> './utils/x.js').
//
// The packages compile with moduleResolution "Bundler", so tsc emits
// declarations with bare relative paths. Consumers on moduleResolution
// node16/nodenext (with "type": "module") can't resolve those, and with
// skipLibCheck the affected types silently become `any`.
//
// Usage: node scripts/fix-dts-extensions.mjs <dir> [<dir> ...]
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function fixSpecifier(file, spec) {
  if (/\.(js|mjs|cjs|json|css|scss)$/.test(spec)) return spec;
  const base = resolve(dirname(file), spec);
  if (existsSync(`${base}.d.ts`)) return `${spec}.js`;
  if (existsSync(join(base, 'index.d.ts'))) return `${spec.replace(/\/$/, '')}/index.js`;
  return spec;
}

let changed = 0;
for (const dir of process.argv.slice(2)) {
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const src = readFileSync(file, 'utf8');
    const out = src.replace(SPECIFIER_RE, (m, lead, q, spec) => {
      const fixed = fixSpecifier(file, spec);
      return fixed === spec ? m : `${lead}${q}${fixed}${q}`;
    });
    if (out !== src) {
      writeFileSync(file, out);
      changed++;
    }
  }
}
console.log(`fix-dts-extensions: updated ${changed} file(s)`);
