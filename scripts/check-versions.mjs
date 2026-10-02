#!/usr/bin/env bun
// Check manifests and Bun's workspace snapshots before committing or publishing.
import { readFileSync } from 'node:fs';
import { JSONC } from 'bun';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const root = readJson('package.json');
const workspaces = JSONC.parse(readFileSync('bun.lock', 'utf8')).workspaces;
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const errors = [];

for (const path of ['', ...root.workspaces]) {
  const manifestPath = path ? `${path}/package.json` : 'package.json';
  const manifest = path ? readJson(manifestPath) : root;
  const snapshot = workspaces?.[path];
  if (manifest.version !== root.version) errors.push(`${manifestPath}: version ${manifest.version} != ${root.version}`);
  if (!snapshot) {
    errors.push(`bun.lock: missing workspace ${path || '(root)'}`);
    continue;
  }
  if (path && snapshot.version !== root.version) errors.push(`bun.lock: ${path} version ${snapshot.version} != ${root.version}`);
  for (const section of sections) {
    const names = new Set([...Object.keys(manifest[section] ?? {}), ...Object.keys(snapshot[section] ?? {})]);
    for (const name of names) {
      if (!name.startsWith('@alaarab/ogrid-')) continue;
      if (manifest[section]?.[name] !== root.version) errors.push(`${manifestPath}: ${section}.${name} != ${root.version}`);
      if (snapshot[section]?.[name] !== root.version) errors.push(`bun.lock: ${path || '(root)'} ${section}.${name} != ${root.version}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`All ${root.workspaces.length} workspace versions and internal manifest/lockfile references match ${root.version}`);
