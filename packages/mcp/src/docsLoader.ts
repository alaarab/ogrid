import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeBlock {
  language: string;
  code: string;
  framework?: string;
}

export interface DocEntry {
  path: string;
  title: string;
  description: string;
  category: string;
  content: string;
  codeBlocks: CodeBlock[];
}

export interface DocsIndex {
  entries: DocEntry[];
  search(query: string, limit?: number): DocEntry[];
  getByPath(path: string): DocEntry | undefined;
  getByCategory(category: string): DocEntry[];
  getCodeExamples(
    query: string,
    framework?: string,
  ): Array<{ entry: DocEntry; block: CodeBlock }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Recursively collect all .mdx / .md files under `dir`. */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (
      entry.isFile() &&
      (extname(entry.name) === '.mdx' || extname(entry.name) === '.md')
    ) {
      results.push(full);
    }
  }
  return results;
}

/** Derive the doc category from the first path segment (e.g. "features"). */
function deriveCategory(relPath: string): string {
  const first = relPath.split('/')[0];
  return first ?? 'uncategorized';
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface Frontmatter {
  title: string;
  description: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(raw: string): Frontmatter {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { title: '', description: '' };
  const block = match[1];
  let title = '';
  let description = '';
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('title:')) {
      title = trimmed.slice('title:'.length).trim().replace(/^['"]|['"]$/g, '');
    } else if (trimmed.startsWith('description:')) {
      description = trimmed
        .slice('description:'.length)
        .trim()
        .replace(/^['"]|['"]$/g, '');
    }
  }
  return { title, description };
}

// ---------------------------------------------------------------------------
// Code block extraction
// ---------------------------------------------------------------------------

const CODE_BLOCK_RE = /```(\w*)\n([\s\S]*?)```/g;

/**
 * Detect framework from the code block language, its content, or the
 * surrounding heading / TabItem context.
 */
function detectFramework(
  language: string,
  code: string,
  surroundingContext: string,
): string | undefined {
  // Explicit language hints
  if (language === 'tsx' || language === 'jsx') return 'react';

  // Check surrounding TabItem context (most reliable for MDX docs)
  const ctxLower = surroundingContext.toLowerCase();
  if (ctxLower.includes('value="react"') || ctxLower.includes('label="react"'))
    return 'react';

  // Content heuristics
  if (code.includes('ogrid-react') || code.includes('from \'react\''))
    return 'react';

  return undefined;
}

/**
 * Extract all fenced code blocks from raw MDX content, with framework
 * detection based on surrounding context.
 */
function extractCodeBlocks(raw: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for safety
  CODE_BLOCK_RE.lastIndex = 0;
  while ((match = CODE_BLOCK_RE.exec(raw)) !== null) {
    const language = match[1] || 'text';
    const code = match[2].trim();

    // Grab ~300 chars before the code block for TabItem / heading context
    const precedingStart = Math.max(0, match.index - 300);
    const surroundingContext = raw.slice(precedingStart, match.index);

    const framework = detectFramework(language, code, surroundingContext);
    blocks.push({ language, code, framework });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Content cleaning (strip MDX-specific syntax for readable text)
// ---------------------------------------------------------------------------

function stripMdxContent(raw: string): string {
  let text = raw;

  // Remove frontmatter
  text = text.replace(FRONTMATTER_RE, '');

  // Remove import statements
  text = text.replace(/^import\s+.*?;\s*$/gm, '');

  // Remove fenced code blocks (they are indexed separately)
  text = text.replace(/```\w*\n[\s\S]*?```/g, '');

  // Strip JSX self-closing tags like <FilteringDemo />
  text = text.replace(/<[A-Z]\w*\s*\/>/g, '');

  // Strip JSX opening/closing tags but keep text content inside
  // e.g. <TabItem value="react" label="React" default>  to  ''
  // e.g. </TabItem>  to  ''
  text = text.replace(/<\/?[A-Z][\w.]*(?:\s[^>]*)?>/g, '');

  // Strip HTML-style tags too (lowercase like <br />, <hr />)
  text = text.replace(/<\/?[a-z][\w-]*(?:\s[^>]*)?\/?\s*>/g, '');

  // Strip admonition wrappers (:::tip, :::note, :::warning, etc.) but keep text
  text = text.replace(/^:::\w+.*$/gm, '');
  text = text.replace(/^:::$/gm, '');

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// ---------------------------------------------------------------------------
// Parsing a single file
// ---------------------------------------------------------------------------

function parseDocFile(filePath: string, docsDir: string): DocEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const relPath = relative(docsDir, filePath);
  const { title, description } = parseFrontmatter(raw);
  const category = deriveCategory(relPath);
  const content = stripMdxContent(raw);
  const codeBlocks = extractCodeBlocks(raw);

  return {
    path: relPath,
    title: title || relPath,
    description: description || '',
    category,
    content,
    codeBlocks,
  };
}

// ---------------------------------------------------------------------------
// Search scoring
// ---------------------------------------------------------------------------

function scoreEntry(entry: DocEntry, queryLower: string): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  const descLower = entry.description.toLowerCase();
  const contentLower = entry.content.toLowerCase();

  // Title match  -  highest weight
  if (titleLower.includes(queryLower)) {
    score += 100;
    // Bonus for exact title match
    if (titleLower === queryLower) score += 50;
    // Bonus for title starting with query
    if (titleLower.startsWith(queryLower)) score += 25;
  }

  // Description match  -  medium weight
  if (descLower.includes(queryLower)) {
    score += 50;
  }

  // Content match  -  base weight, plus density bonus
  if (contentLower.includes(queryLower)) {
    score += 10;
    // Count occurrences (up to 10) for density bonus
    let idx = 0;
    let count = 0;
    while (count < 10) {
      idx = contentLower.indexOf(queryLower, idx);
      if (idx === -1) break;
      count++;
      idx += queryLower.length;
    }
    score += count * 2;
  }

  // Category bonus: features and getting-started are often more relevant
  if (entry.category === 'features') score += 3;
  if (entry.category === 'getting-started') score += 2;

  return score;
}

/** Score for code example search  -  checks code content and language. */
function scoreCodeBlock(
  entry: DocEntry,
  block: CodeBlock,
  queryLower: string,
  framework?: string,
): number {
  let score = 0;

  // Framework filter: must match if specified
  if (framework && block.framework !== framework) return -1;

  // Entry-level relevance
  if (entry.title.toLowerCase().includes(queryLower)) score += 50;
  if (entry.description.toLowerCase().includes(queryLower)) score += 25;

  // Code content relevance
  if (block.code.toLowerCase().includes(queryLower)) score += 30;

  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function loadDocsIndex(docsDir: string): DocsIndex {
  // Verify the directory exists
  try {
    statSync(docsDir);
  } catch {
    throw new Error(`Docs directory not found: ${docsDir}`);
  }

  const files = collectFiles(docsDir);
  const entries = files.map((f) => parseDocFile(f, docsDir));

  // Pre-build a path lookup map for O(1) access
  const pathMap = new Map<string, DocEntry>();
  for (const entry of entries) {
    pathMap.set(entry.path, entry);
  }

  return {
    entries,

    search(query: string, limit = 5): DocEntry[] {
      const q = query.toLowerCase().trim();
      if (!q) return [];

      const scored = entries
        .map((entry) => ({ entry, score: scoreEntry(entry, q) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

      return scored.slice(0, limit).map((r) => r.entry);
    },

    getByPath(path: string): DocEntry | undefined {
      return pathMap.get(path);
    },

    getByCategory(category: string): DocEntry[] {
      return entries.filter((e) => e.category === category);
    },

    getCodeExamples(
      query: string,
      framework?: string,
    ): Array<{ entry: DocEntry; block: CodeBlock }> {
      const q = query.toLowerCase().trim();
      if (!q) return [];

      const results: Array<{
        entry: DocEntry;
        block: CodeBlock;
        score: number;
      }> = [];

      for (const entry of entries) {
        for (const block of entry.codeBlocks) {
          // Skip non-code languages (bash, css, etc. are fine for examples)
          const s = scoreCodeBlock(entry, block, q, framework);
          if (s > 0) {
            results.push({ entry, block, score: s });
          }
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 10).map(({ entry, block }) => ({ entry, block }));
    },
  };
}
