import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadDocsIndex } from '../docsLoader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDocs(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ogrid-mcp-test-'));
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

// ---------------------------------------------------------------------------
// loadDocsIndex — directory validation
// ---------------------------------------------------------------------------

describe('loadDocsIndex', () => {
  test('throws when directory does not exist', () => {
    expect(() => loadDocsIndex('/nonexistent/path/xyz')).toThrow('Docs directory not found');
  });

  test('returns empty entries for empty directory', () => {
    const dir = makeTmpDocs({});
    try {
      const index = loadDocsIndex(dir);
      expect(index.entries).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });

  // -------------------------------------------------------------------------
  // Frontmatter parsing
  // -------------------------------------------------------------------------

  test('parses title and description from frontmatter', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---',
        'title: Sorting',
        'description: Sort rows by any column',
        '---',
        '',
        'Sort rows by clicking column headers.',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      const entry = index.entries[0];
      expect(entry.title).toBe('Sorting');
      expect(entry.description).toBe('Sort rows by any column');
    } finally {
      cleanup(dir);
    }
  });

  test('falls back to relative path as title when no frontmatter', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': 'No frontmatter here.',
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.entries[0].title).toContain('sorting');
    } finally {
      cleanup(dir);
    }
  });

  test('derives category from first path segment', () => {
    const dir = makeTmpDocs({
      'features/filtering.mdx': '---\ntitle: Filtering\ndescription: Filter data\n---\nContent.',
      'getting-started/quick-start.mdx': '---\ntitle: Quick Start\ndescription: Get started\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      const features = index.entries.find((e) => e.title === 'Filtering');
      const gs = index.entries.find((e) => e.title === 'Quick Start');
      expect(features?.category).toBe('features');
      expect(gs?.category).toBe('getting-started');
    } finally {
      cleanup(dir);
    }
  });

  // -------------------------------------------------------------------------
  // Code block extraction + framework detection
  // -------------------------------------------------------------------------

  test('extracts tsx code blocks as react framework', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---\ntitle: Sorting\ndescription: Sort docs\n---',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '<OGrid data={rows} columns={cols} />',
        '```',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      const entry = index.entries[0];
      expect(entry.codeBlocks).toHaveLength(1);
      expect(entry.codeBlocks[0].language).toBe('tsx');
      expect(entry.codeBlocks[0].framework).toBe('react');
    } finally {
      cleanup(dir);
    }
  });

  test('detects react from TabItem context in MDX', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---\ntitle: Sorting\ndescription: Sort docs\n---',
        '<TabItem value="react" label="React" default>',
        '```ts',
        'const x = 1;',
        '```',
        '</TabItem>',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.entries[0].codeBlocks[0].framework).toBe('react');
    } finally {
      cleanup(dir);
    }
  });

  // -------------------------------------------------------------------------
  // Recursive file collection
  // -------------------------------------------------------------------------

  test('collects .md files in addition to .mdx', () => {
    const dir = makeTmpDocs({
      'guides/migration.md': '---\ntitle: Migration\ndescription: Migrate\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].title).toBe('Migration');
    } finally {
      cleanup(dir);
    }
  });

  test('recursively collects files in nested directories', () => {
    const dir = makeTmpDocs({
      'a/b/c/deep.mdx': '---\ntitle: Deep\ndescription: Nested doc\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.entries).toHaveLength(1);
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// search()
// ---------------------------------------------------------------------------

describe('DocsIndex.search', () => {
  let dir: string;
  let cleanup: () => void;

  beforeAll(() => {
    dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---\ntitle: Sorting\ndescription: Sort rows by column\n---',
        'Sorting lets you order rows. Click a column header to sort.',
      ].join('\n'),
      'features/filtering.mdx': [
        '---\ntitle: Filtering\ndescription: Filter rows by value\n---',
        'Filtering narrows down displayed rows.',
      ].join('\n'),
      'getting-started/quick-start.mdx': [
        '---\ntitle: Quick Start\ndescription: Get started fast\n---',
        'Install and configure OGrid in minutes.',
      ].join('\n'),
    });
    cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  });

  afterAll(() => cleanup());

  test('returns empty array for empty query', () => {
    const index = loadDocsIndex(dir);
    expect(index.search('')).toHaveLength(0);
  });

  test('returns results for a matching query', () => {
    const index = loadDocsIndex(dir);
    const results = index.search('sorting');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Sorting');
  });

  test('title match ranks above content-only match', () => {
    const index = loadDocsIndex(dir);
    // "sort" appears in both the Sorting title and the Filtering content
    // ("Sort rows" is in Sorting's description too)
    const results = index.search('sort');
    expect(results[0].title).toBe('Sorting');
  });

  test('returns empty array when no docs match and no category bonus applies', () => {
    // Build a fresh index with no features/getting-started categories
    // so the category bonus does not inflate scores for unrelated queries.
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

  test('respects limit parameter', () => {
    const index = loadDocsIndex(dir);
    const results = index.search('a', 1); // 'a' will match many docs
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test('default limit is 5', () => {
    // Build a dir with 8 docs that all match
    const bigDir = makeTmpDocs(
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `features/doc${i}.mdx`,
          `---\ntitle: Column ${i}\ndescription: Column desc\n---\nColumn sorting feature.`,
        ])
      )
    );
    try {
      const index = loadDocsIndex(bigDir);
      const results = index.search('column');
      expect(results.length).toBeLessThanOrEqual(5);
    } finally {
      fs.rmSync(bigDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// getByPath()
// ---------------------------------------------------------------------------

describe('DocsIndex.getByPath', () => {
  test('retrieves a doc by its relative path', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      const entry = index.getByPath('features/sorting.mdx');
      expect(entry).toBeDefined();
      expect(entry?.title).toBe('Sorting');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns undefined for unknown path', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.getByPath('notexist.mdx')).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// getByCategory()
// ---------------------------------------------------------------------------

describe('DocsIndex.getByCategory', () => {
  test('returns docs belonging to the given category', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
      'features/filtering.mdx': '---\ntitle: Filtering\ndescription: Filter\n---\nContent.',
      'guides/migration.mdx': '---\ntitle: Migration\ndescription: Migrate\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      const features = index.getByCategory('features');
      expect(features).toHaveLength(2);
      expect(features.every((e) => e.category === 'features')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns empty array for unknown category', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': '---\ntitle: Sorting\ndescription: Sort\n---\nContent.',
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.getByCategory('nonexistent')).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// getCodeExamples()
// ---------------------------------------------------------------------------

describe('DocsIndex.getCodeExamples', () => {
  test('returns empty array for empty query', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---\ntitle: Sorting\ndescription: Sort docs\n---',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '```',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      expect(index.getCodeExamples('')).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('finds code examples matching query', () => {
    const dir = makeTmpDocs({
      'features/sorting.mdx': [
        '---\ntitle: Sorting\ndescription: Sort docs\n---',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '<OGrid data={rows} columns={cols} />',
        '```',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      const examples = index.getCodeExamples('sorting');
      expect(examples.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('framework filter excludes non-matching code blocks', () => {
    const dir = makeTmpDocs({
      'features/multi.mdx': [
        '---\ntitle: React Framework\ndescription: Framework examples\n---',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '```',
        '```ts',
        "// plain ts snippet, no framework hint",
        '```',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      const reactExamples = index.getCodeExamples('ogrid', 'react');
      expect(reactExamples.every((e) => e.block.framework === 'react')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('no framework filter returns all matching examples', () => {
    const dir = makeTmpDocs({
      'features/multi.mdx': [
        '---\ntitle: React Framework\ndescription: Framework examples\n---',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-radix';",
        '```',
        '```tsx',
        "import { OGrid } from '@alaarab/ogrid-react-fluent';",
        '```',
      ].join('\n'),
    });
    try {
      const index = loadDocsIndex(dir);
      const all = index.getCodeExamples('ogrid');
      expect(all.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
