#!/usr/bin/env node
/**
 * Version bump script for the ogrid monorepo.
 *
 * Updates "version" fields AND all @alaarab/ogrid-* dependency
 * references across all package.json files in a single pass.
 *
 * Usage: node scripts/version-bump.mjs 2.6.0
 */

import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node scripts/version-bump.mjs <version>');
  console.error('Example: node scripts/version-bump.mjs 2.6.0');
  process.exit(1);
}

const OGRID_PKG = /^@alaarab\/ogrid-/;
const DEP_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];

// Drive the bump off root workspaces so frozen packages (Angular/Vue, omitted
// from the workspaces array) stay pinned at their last shipped version.
const root = JSON.parse(readFileSync('package.json', 'utf8'));
const workspacePaths = (root.workspaces ?? []).map((p) => `${p}/package.json`);
const files = ['package.json', ...workspacePaths];

let updated = 0;

for (const file of files.sort()) {
  const raw = readFileSync(file, 'utf8');
  const pkg = JSON.parse(raw);
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

console.log(`\nBumped ${updated} package(s) to ${version}`);
console.log('Run `npm install` to update package-lock.json');
