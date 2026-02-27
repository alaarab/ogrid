/**
 * bundle-docs.mjs
 *
 * Copies all .mdx and .md files from the monorepo docs directory
 * (packages/docs/docs/) into packages/mcp/bundled-docs/, mirroring
 * the directory structure.
 *
 * MDX import statements (lines starting with `import `) are stripped
 * because the referenced React components are not available outside
 * the Docusaurus build. Everything else (frontmatter, prose, code
 * blocks) is preserved.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, '../../docs/docs');
const TARGET_DIR = join(__dirname, '../bundled-docs');

/** Recursively collect all .mdx / .md files. */
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && (extname(entry.name) === '.mdx' || extname(entry.name) === '.md')) {
      results.push(full);
    }
  }
  return results;
}

/** Strip MDX import lines (e.g. `import Foo from '@site/...'`). */
function stripImports(content) {
  return content
    .split('\n')
    .filter((line) => !line.match(/^import\s+/))
    .join('\n');
}

// ---- Main ----

// Clean target directory
try {
  rmSync(TARGET_DIR, { recursive: true, force: true });
} catch {
  // ignore if it doesn't exist
}

// Verify source exists
try {
  statSync(SOURCE_DIR);
} catch {
  console.error(`Source docs directory not found: ${SOURCE_DIR}`);
  console.error('This script must be run from within the OGrid monorepo.');
  process.exit(1);
}

const files = collectFiles(SOURCE_DIR);
let count = 0;

for (const filePath of files) {
  const relPath = filePath.slice(SOURCE_DIR.length + 1); // e.g. "features/filtering.mdx"
  const targetPath = join(TARGET_DIR, relPath);

  // Ensure target subdirectory exists
  mkdirSync(dirname(targetPath), { recursive: true });

  // Read, strip imports, write
  const raw = readFileSync(filePath, 'utf-8');
  const cleaned = stripImports(raw);
  writeFileSync(targetPath, cleaned, 'utf-8');
  count++;
}

console.log(`Bundled ${count} doc files into bundled-docs/`);
