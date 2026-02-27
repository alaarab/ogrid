import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadDocsIndex } from './docsLoader.js';
import { createOGridMcpServer } from './server.js';
import { BridgeStore, startBridgeServer } from './bridge.js';
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

// ---------------------------------------------------------------------------
// Bridge server (optional — enabled by OGRID_BRIDGE_PORT or --bridge flag)
// ---------------------------------------------------------------------------

const bridgeStore = new BridgeStore();
const bridgePort = process.env['OGRID_BRIDGE_PORT']
  ? parseInt(process.env['OGRID_BRIDGE_PORT'], 10)
  : process.argv.includes('--bridge')
    ? 7890
    : null;

if (bridgePort !== null) {
  try {
    await startBridgeServer(bridgeStore, bridgePort);
  } catch (err) {
    console.error(`[ogrid-mcp] Failed to start bridge server on port ${bridgePort}: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = createOGridMcpServer(index, bridgeStore);
const transport = new StdioServerTransport();
await server.connect(transport);
