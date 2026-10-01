import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadDocsIndex } from './docsLoader.js';
import { createOGridMcpServer } from './server.js';
import { BridgeStore, startBridgeServer } from './bridge.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as { version: string };

// --version flag
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}

// Try monorepo path first, fall back to bundled docs
const monorepoDocs = join(__dirname, '../../../docs/docs');
const bundledDocs = join(__dirname, '../../bundled-docs');
const docsDir =
  process.env.OGRID_DOCS_PATH ??
  (existsSync(monorepoDocs) ? monorepoDocs : bundledDocs);

let index: ReturnType<typeof loadDocsIndex>;
try {
  index = loadDocsIndex(docsDir);
} catch (err) {
  console.error(`[ogrid-mcp] ${err instanceof Error ? err.message : String(err)}`);
  console.error('[ogrid-mcp] Set OGRID_DOCS_PATH to a directory of OGrid .md/.mdx docs.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bridge server (optional  -  enabled by OGRID_BRIDGE_PORT or --bridge flag)
// ---------------------------------------------------------------------------

const bridgePort = process.env.OGRID_BRIDGE_PORT
  ? Number(process.env.OGRID_BRIDGE_PORT)
  : process.argv.includes('--bridge')
    ? 7890
    : null;

// Only register the bridge tools when the bridge is actually listening.
let bridgeStore: BridgeStore | undefined;
let closeBridge: (() => Promise<void>) | undefined;
if (bridgePort !== null) {
  if (!Number.isInteger(bridgePort) || bridgePort < 1 || bridgePort > 65535) {
    console.error(`[ogrid-mcp] Invalid OGRID_BRIDGE_PORT "${process.env.OGRID_BRIDGE_PORT}"; expected an integer from 1 to 65535. Bridge disabled.`);
  } else {
    const store = new BridgeStore();
    try {
      closeBridge = await startBridgeServer(store, bridgePort);
      bridgeStore = store;
    } catch (err) {
      console.error(`[ogrid-mcp] Failed to start bridge server on port ${bridgePort}: ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = createOGridMcpServer(index, bridgeStore, pkg.version);
const transport = new StdioServerTransport();

// The stdio transport doesn't notice stdin closing, and a listening bridge
// would keep the process (and its port) alive after the client is gone.
// Closing it lets the process exit once in-flight work is done.
const stopBridge = () => void closeBridge?.().catch(() => {});
server.server.onclose = stopBridge;
process.stdin.on('end', stopBridge);

await server.connect(transport);
