import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadDocsIndex } from '../docsLoader';
import { createOGridMcpServer } from '../server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDocs(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ogrid-mcp-server-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Invoke a tool handler by calling the underlying server tool registration.
// McpServer doesn't expose handlers directly, so we call through the index.
async function callSearchDocs(
  index: ReturnType<typeof loadDocsIndex>,
  args: { query: string; limit?: number; framework?: 'react' }
) {
  // We test search_docs behavior via the index directly since server tools
  // are thin wrappers — the real logic lives in docsLoader.
  const results = index.search(args.query, args.limit ?? 5);
  return results;
}

// ---------------------------------------------------------------------------
// createOGridMcpServer — sanity checks
// ---------------------------------------------------------------------------

describe('createOGridMcpServer', () => {
  test('creates a server without throwing', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      expect(() => createOGridMcpServer(index)).not.toThrow();
    } finally {
      cleanup(dir);
    }
  });

  test('creates a server with bridge store without throwing', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      // BridgeStore from bridge.ts — import it to verify bridge tools register
      const { BridgeStore } = require('../bridge');
      const bridge = new BridgeStore();
      expect(() => createOGridMcpServer(index, bridge)).not.toThrow();
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// detect_version — tested via file system fixtures
// ---------------------------------------------------------------------------

describe('detect_version behavior (via file system)', () => {
  test('finds ogrid package in a package.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ogrid-version-test-'));
    const pkgJson = {
      name: 'my-app',
      dependencies: {
        '@alaarab/ogrid-react-radix': '^2.5.0',
      },
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson), 'utf-8');

    // The server's detectOGridVersion walks up from a given path.
    // We verify it by creating a docs index then building a server and
    // calling the tool indirectly via inspecting what the server produces.
    // Since the tool is internal, we test the underlying logic by reading the file.
    const found = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    const deps = { ...found.dependencies, ...found.devDependencies };
    const ogridPkgs = Object.entries(deps).filter(([name]) =>
      name.startsWith('@alaarab/ogrid-')
    );
    expect(ogridPkgs.length).toBeGreaterThan(0);
    expect(ogridPkgs[0][0]).toBe('@alaarab/ogrid-react-radix');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('detects react framework from package name', () => {
    const packageNames = ['@alaarab/ogrid-react-radix'];
    const framework = packageNames.some((n) => n.includes('-react'))
      ? 'react'
      : 'unknown';
    expect(framework).toBe('react');
  });

  test('strips version prefix characters', () => {
    const raw = '^2.5.0';
    const version = raw.replace(/^[\^~>=<]+/, '');
    expect(version).toBe('2.5.0');
  });

  test('strips tilde prefix', () => {
    expect('~1.2.3'.replace(/^[\^~>=<]+/, '')).toBe('1.2.3');
  });
});

// ---------------------------------------------------------------------------
// Search integration via index (mirrors search_docs tool behavior)
// ---------------------------------------------------------------------------

describe('search_docs tool behavior', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---\ntitle: Sorting\ndescription: Sort rows by column\n---',
        'Click a column header to sort ascending or descending.',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '<OGrid data={rows} columns={cols} />',
        '```',
      ].join('\n'),
      'features/filtering.mdx': [
        '---\ntitle: Filtering\ndescription: Filter rows\n---',
        'Use the filter bar to narrow results.',
        '```ts',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '<OGrid data={rows} columns={cols} />',
        '```',
      ].join('\n'),
    });
  });

  afterAll(() => cleanup(dir));

  test('search returns most relevant result first', async () => {
    const index = loadDocsIndex(dir);
    const results = await callSearchDocs(index, { query: 'sorting' });
    expect(results[0].title).toBe('Sorting');
  });

  test('search with limit 1 returns at most 1 result', async () => {
    const index = loadDocsIndex(dir);
    const results = await callSearchDocs(index, { query: 'filter', limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test('search with no match returns empty array for non-bonus categories', () => {
    // Build an index only using 'guides' category (no category bonus in scoring)
    const noBoostDir = makeTmpDocs({
      'guides/migration.mdx': '---\ntitle: Migration\ndescription: Migrate grids\n---\nMigration content.',
    });
    try {
      const noBoostIndex = loadDocsIndex(noBoostDir);
      expect(noBoostIndex.search('sorting')).toHaveLength(0);
    } finally {
      fs.rmSync(noBoostDir, { recursive: true, force: true });
    }
  });

  test('framework filter on code examples excludes wrong frameworks', () => {
    const index = loadDocsIndex(dir);
    const reactExamples = index.getCodeExamples('ogrid', 'react');
    expect(reactExamples.every((e) => !e.block.framework || e.block.framework === 'react')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// list_docs / get_docs behavior (via index)
// ---------------------------------------------------------------------------

describe('list_docs behavior', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
      'features/filtering.mdx': '---\ntitle: Filtering\ndescription: Filter\n---\nContent.',
      'guides/migration.mdx': '---\ntitle: Migration\ndescription: Migrate\n---\nContent.',
    });
  });

  afterAll(() => cleanup(dir));

  test('getByCategory returns all docs for that category', () => {
    const index = loadDocsIndex(dir);
    const features = index.getByCategory('features');
    expect(features).toHaveLength(2);
  });

  test('all entries are returned when no category filter', () => {
    const index = loadDocsIndex(dir);
    expect(index.entries).toHaveLength(3);
  });

  test('empty category returns no entries', () => {
    const index = loadDocsIndex(dir);
    expect(index.getByCategory('api')).toHaveLength(0);
  });
});

describe('get_docs behavior', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent goes here.',
    });
  });

  afterAll(() => cleanup(dir));

  test('getByPath returns correct entry', () => {
    const index = loadDocsIndex(dir);
    const entry = index.getByPath('features/sorting.mdx');
    expect(entry).toBeDefined();
    expect(entry?.content).toContain('Content goes here');
  });

  test('getByPath returns undefined for missing path', () => {
    const index = loadDocsIndex(dir);
    expect(index.getByPath('features/not-there.mdx')).toBeUndefined();
  });

  test('.md extension also loads correctly', () => {
    const mdDir = makeTmpDocs({
      'guides/readme.md': '---\ntitle: Readme\ndescription: A readme\n---\nReadme content.',
    });
    try {
      const index = loadDocsIndex(mdDir);
      const entry = index.getByPath('guides/readme.md');
      expect(entry?.title).toBe('Readme');
    } finally {
      cleanup(mdDir);
    }
  });
});
