/** Test packed public exports with isolated supported React installations. Build first. */
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const offline = args.includes('--offline');
const requestedVersions = args.filter(arg => arg !== '--offline');
const versions = requestedVersions.length ? requestedVersions : ['17.0.2', '18.3.1'];
for (const version of versions) {
  if (!['17.0.2', '18.3.1'].includes(version)) throw new Error(`Unsupported fixture React version: ${version}`);
}
const packed = await mkdtemp(join(tmpdir(), 'ogrid-react-compat-'));
try {
  const names = ['core', 'inputs', 'react', 'react-radix', 'react-fluent', 'react-inputs'];
  const output = execFileSync('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', packed, ...names.flatMap(name => ['--workspace', join(root, 'packages', name)])], { cwd: root, encoding: 'utf8', timeout: 180_000, killSignal: 'SIGKILL' });
  const tarballs = JSON.parse(output).map(pkg => join(packed, pkg.filename));
  for (const version of versions) {
    const fixture = join(packed, version);
    await mkdir(fixture);
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    execFileSync('npm', ['install', offline ? '--offline' : '--prefer-offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', `react@${version}`, `react-dom@${version}`, 'happy-dom@20.14.5', '@radix-ui/react-checkbox@1.3.11', '@radix-ui/react-popover@1.1.23', '@fluentui/react-components@9.74.9', '@fluentui/react-icons@2.0.343', ...tarballs], { cwd: fixture, stdio: 'inherit', timeout: 180_000, killSignal: 'SIGKILL' });
    await writeFile(join(fixture, 'smoke.mjs'), await readFile(new URL('./fixtures/react-compat-smoke.mjs', import.meta.url)));
    execFileSync('node', ['smoke.mjs'], { cwd: fixture, stdio: 'inherit', timeout: 180_000, killSignal: 'SIGKILL', env: { ...process.env, NODE_ENV: 'production' } });
  }
} finally {
  await rm(packed, { recursive: true, force: true });
}
