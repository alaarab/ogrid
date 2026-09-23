#!/usr/bin/env node
// Run @arethetypeswrong/cli against every public package (packed, as npm
// would ship it) for ESM consumers: node16/nodenext and bundler resolution.
// CSS subpath exports are excluded: they have no types by design.
// Run after `npm run build`.
import { execFileSync } from 'node:child_process';

const PACKAGES = [
  ['packages/core', []],
  ['packages/inputs', []],
  ['packages/react', []],
  ['packages/react-radix', ['styles/preset-shadcn.css']],
  ['packages/react-fluent', []],
  ['packages/react-inputs', []],
  ['packages/react-xlsx', []],
  ['packages/react-xlsx-browser', ['ogrid-xlsx.css']],
  ['packages/mcp', []],
];

let failed = 0;
for (const [dir, excluded] of PACKAGES) {
  const args = ['attw', '--pack', '--profile', 'esm-only', '--format', 'ascii'];
  if (excluded.length > 0) args.push('--exclude-entrypoints', ...excluded);
  try {
    execFileSync('bunx', args, { cwd: dir, stdio: 'inherit' });
  } catch {
    console.error(`! ${dir}: type resolution problems`);
    failed++;
  }
}
if (failed > 0) process.exit(1);
