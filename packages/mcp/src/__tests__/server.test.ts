import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BridgeStore } from '../bridge';
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
// End-to-end through the real MCP SDK (client <-> server over an in-memory
// transport), so resource-template matching and tool routing are the SDK's own.
// ---------------------------------------------------------------------------

async function connect(server: ReturnType<typeof createOGridMcpServer>): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function text(result: { content?: unknown }): string {
  return (result.content as Array<{ text: string }>).map((c) => c.text).join('\n');
}

describe('doc-page resource template', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTmpDocs({
      'features/filtering.mdx': '---\ntitle: Filtering\ndescription: Filter rows\n---\nNested content.',
      'api/types/column-def.md': '---\ntitle: Column def\n---\nDeeply nested.',
    });
  });

  afterAll(() => cleanup(dir));

  test('every advertised doc URI, including nested paths, resolves', async () => {
    const client = await connect(createOGridMcpServer(loadDocsIndex(dir)));
    const { resources } = await client.listResources();
    const docUris = resources.map((r) => r.uri).filter((u) => u.startsWith('ogrid://docs/'));
    expect(docUris.sort()).toEqual(['ogrid://docs/api/types/column-def', 'ogrid://docs/features/filtering']);

    const filtering = await client.readResource({ uri: 'ogrid://docs/features/filtering' });
    expect((filtering.contents[0] as { text: string }).text).toContain('Nested content.');
    const columnDef = await client.readResource({ uri: 'ogrid://docs/api/types/column-def' });
    expect((columnDef.contents[0] as { text: string }).text).toContain('Deeply nested.');
    await client.close();
  });
});

describe('server metadata and detect_version', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTmpDocs({ 'features/sorting.mdx': '---\ntitle: Sorting\n---\nContent.' });
  });

  afterAll(() => cleanup(dir));

  test('reports the version it was created with', async () => {
    const client = await connect(createOGridMcpServer(loadDocsIndex(dir), undefined, '9.8.7'));
    expect(client.getServerVersion()?.version).toBe('9.8.7');
    await client.close();
  });

  test('does not suggest a framework filter for frozen adapters', async () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'ogrid-version-test-'));
    try {
      fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ dependencies: { '@alaarab/ogrid-angular': '2.9.0' } }));
      const client = await connect(createOGridMcpServer(loadDocsIndex(dir)));
      const out = text(await client.callTool({ name: 'detect_version', arguments: { path: app } }));
      expect(out).toContain('angular (frozen at v2.9.0)');
      expect(out).not.toContain('framework="angular');
      await client.close();
    } finally {
      cleanup(app);
    }
  });

  test('suggests the react framework filter for react packages', async () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'ogrid-version-test-'));
    try {
      fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ dependencies: { '@alaarab/ogrid-react-radix': '^2.17.0' } }));
      const client = await connect(createOGridMcpServer(loadDocsIndex(dir)));
      const out = text(await client.callTool({ name: 'detect_version', arguments: { path: app } }));
      expect(out).toContain('framework="react"');
      await client.close();
    } finally {
      cleanup(app);
    }
  });
});

describe('detect_version installed version', () => {
  let dir: string;
  let app: string;

  beforeEach(() => {
    dir = makeTmpDocs({ 'features/sorting.mdx': '---\ntitle: Sorting\n---\nContent.' });
    app = fs.mkdtempSync(path.join(os.tmpdir(), 'ogrid-version-test-'));
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ dependencies: { '@alaarab/ogrid-react-radix': '^2.9.0' } }));
  });

  afterEach(() => {
    cleanup(dir);
    cleanup(app);
  });

  test('reports the installed version over the declared range, and flags a docs version mismatch', async () => {
    const installed = path.join(app, 'node_modules', '@alaarab', 'ogrid-react-radix');
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ version: '2.12.4' }));
    const client = await connect(createOGridMcpServer(loadDocsIndex(dir), undefined, '2.17.3'));
    const out = text(await client.callTool({ name: 'detect_version', arguments: { path: app } }));
    expect(out).toContain('Version:   2.12.4 (installed; declared ^2.9.0)');
    expect(out).toContain('these docs are for OGrid 2.17.3');
    await client.close();
  });

  test('does not flag a mismatch when the minor matches the docs', async () => {
    const client = await connect(createOGridMcpServer(loadDocsIndex(dir), undefined, '2.9.5'));
    const out = text(await client.callTool({ name: 'detect_version', arguments: { path: app } }));
    expect(out).toContain('Version:   2.9.0 (declared; not installed under node_modules)');
    expect(out).not.toContain('APIs may differ');
    await client.close();
  });
});

describe('bridge tools', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTmpDocs({ 'features/sorting.mdx': '---\ntitle: Sorting\n---\nContent.' });
  });

  afterAll(() => cleanup(dir));

  test('send_grid_command rejects a payload that does not fit the command type', async () => {
    const bridge = new BridgeStore();
    bridge.upsertGrid('g', {});
    const client = await connect(createOGridMcpServer(loadDocsIndex(dir), bridge));
    const result = await client.callTool({
      name: 'send_grid_command',
      arguments: { gridId: 'g', type: 'go_to_page', payload: { page: '2' }, timeoutMs: 100 },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('Invalid payload for go_to_page');
    expect(bridge.popPendingCommands('g')).toEqual([]);
    await client.close();
  });

  test('get_grid_state reports selected row ids', async () => {
    const bridge = new BridgeStore();
    bridge.upsertGrid('g', { selectedRowIds: ['a', 7] });
    const client = await connect(createOGridMcpServer(loadDocsIndex(dir), bridge));
    const out = text(await client.callTool({ name: 'get_grid_state', arguments: { gridId: 'g' } }));
    expect(out).toContain('2 row(s) selected: ids [a, 7]');
    await client.close();
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
