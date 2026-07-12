#!/usr/bin/env node
/**
 * Idempotent lockstep publisher for the ogrid monorepo.
 *
 * Publishes every public workspace package in dependency order. Before each
 * publish it checks the registry: a package already published at its current
 * version is skipped, so a half-failed run can be safely re-run with the same
 * version. Failures don't abort the run — remaining packages still get their
 * attempt, and the script exits non-zero with a summary if anything failed.
 *
 * Usage:
 *   node scripts/publish-all.mjs             # publish
 *   node scripts/publish-all.mjs --dry-run   # report what would happen
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Dependency order: each package's internal deps appear before it.
const PACKAGES = [
  'packages/core',
  'packages/inputs',
  'packages/react',
  'packages/react-radix',
  'packages/react-fluent',
  'packages/react-inputs',
  'packages/react-xlsx',
  'packages/react-xlsx-browser',
  'packages/mcp',
];

const dryRun = process.argv.includes('--dry-run');

function isPublished(name, version) {
  try {
    const out = execFileSync('npm', ['view', `${name}@${version}`, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out === version;
  } catch {
    // npm view exits non-zero when the version (or package) doesn't exist.
    return false;
  }
}

const skipped = [];
const published = [];
const failed = [];

for (const dir of PACKAGES) {
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const label = `${pkg.name}@${pkg.version}`;

  if (isPublished(pkg.name, pkg.version)) {
    console.log(`- ${label} already on registry, skipping`);
    skipped.push(label);
    continue;
  }

  if (dryRun) {
    console.log(`- ${label} would be published (dry run)`);
    published.push(label);
    continue;
  }

  try {
    console.log(`- publishing ${label} ...`);
    execFileSync('npm', ['publish', '--access=public'], { cwd: dir, stdio: 'inherit' });
    published.push(label);
  } catch {
    console.error(`! ${label} FAILED`);
    failed.push(label);
  }
}

console.log(
  `\n${dryRun ? '[dry run] ' : ''}published: ${published.length}, skipped: ${skipped.length}, failed: ${failed.length}`,
);
if (failed.length > 0) {
  console.error(`Failed packages:\n  ${failed.join('\n  ')}`);
  console.error('Re-run with the same version to retry only the failures.');
  process.exit(1);
}
