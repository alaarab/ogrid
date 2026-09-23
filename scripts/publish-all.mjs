#!/usr/bin/env node
/**
 * Idempotent lockstep publisher for the ogrid monorepo.
 *
 * Publishes every public workspace package in dependency order. Before each
 * publish it checks the registry: a package already published at its current
 * version is skipped, so a half-failed run can be safely re-run with the same
 * version.
 *
 * If a package fails, packages that depend on it (dependencies or
 * peerDependencies, not devDependencies) are NOT published: they would go live
 * pinned to a version that doesn't exist on the registry. Unrelated packages
 * still get their attempt, and the script exits non-zero with a summary.
 *
 * The dist-tag defaults to `latest` for plain versions and `next` for
 * prereleases (e.g. 3.0.0-beta.1), so a prerelease never becomes `latest`.
 *
 * Usage:
 *   node scripts/publish-all.mjs                 # publish
 *   node scripts/publish-all.mjs --tag beta      # publish under an explicit dist-tag
 *   node scripts/publish-all.mjs --dry-run       # validate: `npm pack --dry-run` every package
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

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tagIndex = args.indexOf('--tag');
const explicitTag = tagIndex >= 0 ? args[tagIndex + 1] : undefined;
if (tagIndex >= 0 && !explicitTag) {
  console.error('--tag needs a value');
  process.exit(1);
}

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

/** Internal (@alaarab/ogrid-*) runtime dependencies of a package. */
function internalDeps(pkg) {
  const names = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
  return names.filter((n) => n.startsWith('@alaarab/ogrid-'));
}

const skipped = [];
const published = [];
const failed = [];
const blocked = [];
/** Package names that did not make it to the registry in this run. */
const unavailable = new Set();

for (const dir of PACKAGES) {
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const label = `${pkg.name}@${pkg.version}`;
  const tag = explicitTag ?? (pkg.version.includes('-') ? 'next' : 'latest');

  if (dryRun) {
    // Validate what would be packed (files list, missing dist, etc.) even if
    // the version is already on the registry.
    try {
      execFileSync('npm', ['pack', '--dry-run'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
      console.log(`- ${label} packs OK (would publish with tag "${tag}")`);
      published.push(label);
    } catch {
      console.error(`! ${label} npm pack --dry-run FAILED`);
      failed.push(label);
    }
    continue;
  }

  if (isPublished(pkg.name, pkg.version)) {
    console.log(`- ${label} already on registry, skipping`);
    skipped.push(label);
    continue;
  }

  const missing = internalDeps(pkg).filter((n) => unavailable.has(n));
  if (missing.length > 0) {
    console.error(`! ${label} NOT published: depends on ${missing.join(', ')}, which failed`);
    blocked.push(label);
    unavailable.add(pkg.name);
    continue;
  }

  try {
    console.log(`- publishing ${label} (tag "${tag}") ...`);
    execFileSync('npm', ['publish', '--access=public', '--tag', tag], { cwd: dir, stdio: 'inherit' });
    published.push(label);
  } catch {
    console.error(`! ${label} FAILED`);
    failed.push(label);
    unavailable.add(pkg.name);
  }
}

console.log(
  `\n${dryRun ? '[dry run] ' : ''}${dryRun ? 'validated' : 'published'}: ${published.length}, skipped: ${skipped.length}, failed: ${failed.length}, blocked: ${blocked.length}`,
);
if (failed.length > 0 || blocked.length > 0) {
  if (failed.length > 0) console.error(`Failed packages:\n  ${failed.join('\n  ')}`);
  if (blocked.length > 0) console.error(`Blocked by a failed dependency:\n  ${blocked.join('\n  ')}`);
  if (!dryRun) console.error('Re-run with the same version to retry; published packages are skipped.');
  process.exit(1);
}
