/**
 * OGrid Live Testing Bridge
 *
 * An HTTP server (default port 7890) that running OGrid instances connect to.
 * The MCP server holds a BridgeStore in-process and queries it directly when
 * tools like list_grids / get_grid_state / send_grid_command are invoked.
 *
 * Protocol (used by bridge-client.ts in the browser):
 *   POST   /grids/connect                -  register / heartbeat
 *   PUT    /grids/:id/state              -  push current grid state
 *   GET    /grids/:id/commands           -  poll for pending commands
 *   POST   /grids/:id/commands/:cmdId/result   -  post command result
 *
 * Internal (used by MCP tools via BridgeStore directly):
 *   bridgeStore.listGrids()
 *   bridgeStore.getState(gridId)
 *   bridgeStore.enqueueCommand(gridId, cmd)
 *   bridgeStore.waitForResult(cmdId, timeoutMs)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridColumnInfo {
  columnId: string;
  headerName?: string;
  type?: string;
}

export interface GridStateSnapshot {
  gridId: string;
  connectedAt: number;
  lastSeen: number;
  rowCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  data: unknown[];
  columns: GridColumnInfo[];
  sortModel: Array<{ columnId: string; direction: 'asc' | 'desc' }>;
  filterModel: Record<string, unknown>;
  selectedRowIndices: number[];
}

export type GridCommandType =
  | 'update_cell'
  | 'set_filter'
  | 'clear_filters'
  | 'set_sort'
  | 'go_to_page';

export interface GridCommand {
  id: string;
  type: GridCommandType;
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'completed' | 'error';
  result?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// BridgeStore  -  in-process state, shared between HTTP handler and MCP tools
// ---------------------------------------------------------------------------

export class BridgeStore {
  private readonly grids = new Map<string, GridStateSnapshot>();
  private readonly commandQueues = new Map<string, GridCommand[]>();
  private readonly commandResults = new Map<string, GridCommand>();
  private cmdSeq = 0;

  // ---- Called by HTTP handler ----

  upsertGrid(gridId: string, partial: Partial<GridStateSnapshot>): void {
    const existing = this.grids.get(gridId);
    const now = Date.now();
    this.grids.set(gridId, {
      connectedAt: existing?.connectedAt ?? now,
      lastSeen: now,
      rowCount: 0,
      totalCount: 0,
      page: 1,
      pageSize: 50,
      pageCount: 1,
      data: [],
      columns: [],
      sortModel: [],
      filterModel: {},
      selectedRowIndices: [],
      ...existing,
      ...partial,
      // gridId must always be the canonical value  -  set last so partial can't override it
      gridId,
    });
    if (!this.commandQueues.has(gridId)) {
      this.commandQueues.set(gridId, []);
    }
  }

  popPendingCommands(gridId: string): GridCommand[] {
    const queue = this.commandQueues.get(gridId) ?? [];
    const pending = queue.filter((c) => c.status === 'pending');
    // Mark them as in-flight (still pending until result arrives, but don't re-send)
    // Return only once
    const unsent = pending.filter((c) => !(c as GridCommand & { sent?: boolean }).sent);
    for (const cmd of unsent) {
      (cmd as GridCommand & { sent?: boolean }).sent = true;
    }
    return unsent;
  }

  resolveCommand(cmdId: string, result: unknown, error?: string): void {
    for (const queue of this.commandQueues.values()) {
      const cmd = queue.find((c) => c.id === cmdId);
      if (cmd) {
        cmd.status = error ? 'error' : 'completed';
        cmd.result = result;
        cmd.error = error;
        this.commandResults.set(cmdId, { ...cmd });
        return;
      }
    }
  }

  // ---- Called by MCP tools ----

  listGrids(): GridStateSnapshot[] {
    // Filter to grids seen in last 30 seconds
    const cutoff = Date.now() - 30_000;
    return [...this.grids.values()].filter((g) => g.lastSeen > cutoff);
  }

  getState(gridId: string): GridStateSnapshot | undefined {
    return this.grids.get(gridId);
  }

  enqueueCommand(
    gridId: string,
    type: GridCommandType,
    payload: Record<string, unknown>,
  ): GridCommand | null {
    if (!this.grids.has(gridId)) return null;
    const cmd: GridCommand = {
      id: `cmd-${++this.cmdSeq}-${Date.now()}`,
      type,
      payload,
      createdAt: Date.now(),
      status: 'pending',
    };
    const queue = this.commandQueues.get(gridId) ?? [];
    queue.push(cmd);
    this.commandQueues.set(gridId, queue);
    return cmd;
  }

  waitForResult(cmdId: string, timeoutMs = 5000): Promise<GridCommand> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        const cmd = this.commandResults.get(cmdId);
        if (cmd) {
          resolve(cmd);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error(`Command ${cmdId} timed out after ${timeoutMs}ms`));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || 'null'));
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

// The bridge binds to 127.0.0.1 and only talks to a local dev app. Reflect the
// request Origin only when it's a localhost origin instead of using a wildcard,
// so an arbitrary website a developer visits can't read/write grid state on the
// loopback bridge.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function corsOrigin(req: IncomingMessage): string {
  const origin = req.headers.origin;
  return origin && LOCALHOST_ORIGIN.test(origin) ? origin : '';
}

function send(req: IncomingMessage, res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const allow = corsOrigin(req);
  if (allow) headers['Access-Control-Allow-Origin'] = allow;
  res.writeHead(status, headers);
  res.end(json);
}

export function startBridgeServer(
  store: BridgeStore,
  port = 7890,
): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // CORS pre-flight — reflect localhost origins only (see send()).
      if (req.method === 'OPTIONS') {
        const headers: Record<string, string> = {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          Vary: 'Origin',
        };
        const allow = corsOrigin(req);
        if (allow) headers['Access-Control-Allow-Origin'] = allow;
        res.writeHead(204, headers);
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const parts = url.pathname.replace(/^\//, '').split('/');

      try {
        // GET /health
        if (req.method === 'GET' && parts[0] === 'health') {
          send(req, res,200, { ok: true, grids: store.listGrids().length });
          return;
        }

        // POST /grids/connect  { gridId, ...initialState }
        if (req.method === 'POST' && parts[0] === 'grids' && parts[1] === 'connect') {
          const body = (await readBody(req)) as Record<string, unknown>;
          const gridId = String(body?.['gridId'] ?? '');
          if (!gridId) { send(req, res,400, { error: 'gridId required' }); return; }
          store.upsertGrid(gridId, body as Partial<GridStateSnapshot>);
          send(req, res,200, { ok: true });
          return;
        }

        // PUT /grids/:id/state  { ...stateUpdate }
        if (req.method === 'PUT' && parts[0] === 'grids' && parts[2] === 'state') {
          const gridId = parts[1];
          const body = (await readBody(req)) as Record<string, unknown>;
          store.upsertGrid(gridId, body as Partial<GridStateSnapshot>);
          send(req, res,200, { ok: true });
          return;
        }

        // GET /grids/:id/commands
        if (req.method === 'GET' && parts[0] === 'grids' && parts[2] === 'commands') {
          const gridId = parts[1];
          // Heartbeat  -  update lastSeen
          const state = store.getState(gridId);
          if (state) store.upsertGrid(gridId, {});
          const cmds = store.popPendingCommands(gridId);
          send(req, res,200, cmds);
          return;
        }

        // POST /grids/:id/commands/:cmdId/result  { result?, error? }
        if (
          req.method === 'POST' &&
          parts[0] === 'grids' &&
          parts[2] === 'commands' &&
          parts[4] === 'result'
        ) {
          const cmdId = parts[3];
          const body = (await readBody(req)) as Record<string, unknown>;
          store.resolveCommand(cmdId, body?.['result'], body?.['error'] as string | undefined);
          send(req, res,200, { ok: true });
          return;
        }

        send(req, res,404, { error: 'Not found' });
      } catch (err) {
        send(req, res,500, { error: String(err) });
      }
    });

    httpServer.on('error', reject);
    httpServer.listen(port, '127.0.0.1', () => {
      console.error(`[ogrid-mcp] Bridge server listening on http://localhost:${port}`);
      resolve(
        () =>
          new Promise<void>((res) => {
            httpServer.close(() => res());
          }),
      );
    });
  });
}
