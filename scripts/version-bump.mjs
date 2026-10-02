#!/usr/bin/env node
/**
 * Version bump script for the ogrid monorepo.
 *
 * Updates "version" fields AND all @alaarab/ogrid-* dependency
 * references across all package.json files in a single pass.
 *
 * Usage: node scripts/version-bump.mjs 2.6.0
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
// Full semver (optional prerelease/build); anchored so trailing junk is rejected.
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/version-bump.mjs <version>');
  console.error('Example: node scripts/version-bump.mjs 2.6.0');
  process.exit(1);
}

const OGRID_PKG = /^@alaarab\/ogrid-/;
const DEP_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];

// Drive the bump off the root workspaces array so every workspace package
// (and only workspace packages) gets the new version.
const root = JSON.parse(readFileSync('package.json', 'utf8'));
const workspacePaths = (root.workspaces ?? []).map((p) => `${p}/package.json`);
const files = ['package.json', ...workspacePaths];

let updated = 0;
const workspaceNames = new Set();

for (const file of files.sort()) {
  const raw = readFileSync(file, 'utf8');
  const pkg = JSON.parse(raw);
  if (OGRID_PKG.test(pkg.name)) workspaceNames.add(pkg.name);
  let changed = false;

  if (pkg.version && pkg.version !== version) {
    pkg.version = version;
    changed = true;
  }

  for (const section of DEP_SECTIONS) {
    if (!pkg[section]) continue;
    for (const [name, val] of Object.entries(pkg[section])) {
      if (OGRID_PKG.test(name) && val !== version) {
        pkg[section][name] = version;
        changed = true;
      }
    }
  }

  if (changed) {
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${file}`);
    updated++;
  }
}

// Bun 1.4 can refresh workspace versions while retaining old internal
// dependency snapshots. Update those exact workspace references before the
// install refreshes workspace versions; leave external resolutions untouched.
if (existsSync('bun.lock')) {
  const lock = readFileSync('bun.lock', 'utf8');
  const nextLock = lock.replace(/("(@alaarab\/ogrid-[^"]+)"\s*:\s*")[^"]*(")/g,
    (match, prefix, name, suffix) => workspaceNames.has(name) ? `${prefix}${version}${suffix}` : match);
  if (nextLock !== lock) {
    writeFileSync('bun.lock', nextLock);
    console.log('  bun.lock (internal dependency snapshots)');
  }
}

// Cut the CHANGELOG: [Unreleased] becomes this version's heading, and a
// fresh empty [Unreleased] section is inserted above it. Skipped when the
// section is missing (already cut) or empty (nothing to release under it).
const CHANGELOG = 'CHANGELOG.md';
const changelog = readFileSync(CHANGELOG, 'utf8');
const unreleased = '## [Unreleased]';
if (changelog.includes(`## [${version}]`)) {
  console.log(`CHANGELOG.md already has a [${version}] heading, leaving it as is`);
} else if (changelog.includes(unreleased)) {
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    CHANGELOG,
    changelog.replace(unreleased, `${unreleased}\n\n## [${version}] - ${today}`),
  );
  console.log(`  CHANGELOG.md ([Unreleased] cut to [${version}] - ${today})`);
} else {
  console.log('CHANGELOG.md has no [Unreleased] section, leaving it as is');
}

console.log(`\nBumped ${updated} package(s) to ${version}`);
console.log('Run `bun install` to update bun.lock');
