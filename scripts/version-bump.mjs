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
import { glob } from 'fs/promises';
import { join } from 'path';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node scripts/version-bump.mjs <version>');
  console.error('Example: node scripts/version-bump.mjs 2.6.0');
  process.exit(1);
}

const OGRID_PKG = /^@alaarab\/ogrid-/;
const DEP_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];

const files = ['package.json'];
for await (const f of glob('packages/*/package.json')) {
  files.push(f);
}

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
