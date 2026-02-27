import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadDocsIndex } from './docsLoader.js';
import { createOGridMcpServer } from './server.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try monorepo path first, fall back to bundled docs
const monorepoDocs = join(__dirname, '../../../docs/docs');
const bundledDocs = join(__dirname, '../../bundled-docs');
const docsDir =
  process.env['OGRID_DOCS_PATH'] ??
  (existsSync(monorepoDocs) ? monorepoDocs : bundledDocs);

const index = loadDocsIndex(docsDir);
const server = createOGridMcpServer(index);
const transport = new StdioServerTransport();
await server.connect(transport);
