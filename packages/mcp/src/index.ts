import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadDocsIndex } from './docsLoader.js';
import { createOGridMcpServer } from './server.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir =
  process.env['OGRID_DOCS_PATH'] ??
  join(__dirname, '../../../docs/docs');

const index = loadDocsIndex(docsDir);
const server = createOGridMcpServer(index);
const transport = new StdioServerTransport();
await server.connect(transport);
