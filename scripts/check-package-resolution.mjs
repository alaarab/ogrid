#!/usr/bin/env node
/** Verify a consumer resolves one matching core/react/radix installation.
 * Usage: node scripts/check-package-resolution.mjs /path/to/consumer 2.17.0
 * Check real paths as well as versions: --no-save tarball installs can leave
 * nested registry copies with the same version but different code.
 */
import assert from 'node:assert/strict';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const [consumer, version] = process.argv.slice(2);
assert(consumer && version, 'Usage: check-package-resolution.mjs <consumer> <version>');
const names = ['@alaarab/ogrid-core', '@alaarab/ogrid-react', '@alaarab/ogrid-react-radix'];
const requireFrom = (directory) => createRequire(join(resolve(directory), 'package.json'));

function resolvePackage(require, name) {
  let directory = dirname(realpathSync(require.resolve(name)));
  while (dirname(directory) !== directory) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name === name) return { directory, pkg };
    }
    directory = dirname(directory);
  }
  throw new Error(`Cannot find manifest for ${name}`);
}

const rootRequire = requireFrom(consumer);
const roots = new Map(names.map((name) => [name, resolvePackage(rootRequire, name)]));
for (const [name, { directory, pkg }] of roots) {
  assert.equal(pkg.version, version, `${name}: unexpected root version`);
  for (const [dependency, specifier] of Object.entries(pkg.dependencies ?? {})) {
    if (!roots.has(dependency)) continue;
    assert.equal(specifier, version, `${name}: internal dependency must pin ${dependency}@${version}`);
    const nested = resolvePackage(requireFrom(directory), dependency);
    assert.equal(nested.pkg.version, version, `${name}: nested ${dependency} version mismatch`);
    assert.equal(nested.directory, roots.get(dependency).directory,
      `${name}: nested ${dependency} is a different copy from the root installation`);
  }
  console.log(`${name}@${pkg.version}: ${directory}`);
}
console.log('Verified one matching core/react/radix dependency graph.');
