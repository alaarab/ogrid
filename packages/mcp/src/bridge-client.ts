/**
 * OGrid MCP Bridge Client
 *
 * Include this in your dev app to connect a running OGrid instance to the
 * MCP bridge server, enabling MCP-connected editors to read
 * grid state and send test commands in real time.
 *
 * Usage (React):
 *   import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
 *
 *   useEffect(() => {
 *     const bridge = connectGridToBridge({
 *       gridId: 'my-grid',
 *       getData: () => filteredRows,       // current displayed data
 *       getColumns: () => columns,
 *       api: gridApiRef.current,           // IOGridApi (for filter/sort/page commands)
 *       onCellUpdate: (rowIndex, columnId, value) => {
 *         setData(prev => prev.map((row, i) =>
 *           i === rowIndex ? { ...row, [columnId]: value } : row
 *         ));
 *       },
 *     });
 *     return () => bridge.disconnect();
 *   }, []);
 *
 * This module contains NO Node.js-specific imports  -  safe to bundle in browsers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeColumnInfo {
  columnId: string;
  headerName?: string;
  type?: string;
}

export interface BridgeCommand {
  id: string;
  type: 'update_cell' | 'set_filter' | 'clear_filters' | 'set_sort' | 'go_to_page';
  payload: Record<string, unknown>;
}

/** Minimal subset of IOGridApi used by the bridge. */
export interface BridgeGridApi {
  updateSort?: (model: Array<{ columnId: string; direction: 'asc' | 'desc' }>) => void;
  updateFilter?: (columnId: string, value: unknown) => void;
  clearFilters?: () => void;
  goToPage?: (page: number) => void;
  getSelectedRows?: () => unknown[];
}

export interface ConnectGridOptions {
  /** Unique identifier for this grid instance (shown in list_grids). */
  gridId: string;
  /** Returns the currently displayed rows. Called on every state push. */
  getData: () => unknown[];
  /** Returns the current column definitions. */
  getColumns: () => BridgeColumnInfo[];
  /** Current pagination state. */
  getPagination?: () => { page: number; pageSize: number; totalCount: number; pageCount: number };
  /** Returns the current sort model. Called on every state push. */
  getSort?: () => Array<{ columnId: string; direction: 'asc' | 'desc' }>;
  /** Returns the current filter model. Called on every state push. */
  getFilters?: () => Record<string, unknown>;
  /** IOGridApi reference for filter/sort/page commands. */
  api?: BridgeGridApi;
  /** Called when the editor sends an update_cell command. */
  onCellUpdate?: (rowIndex: number, columnId: string, value: unknown) => void;
  /** Bridge server URL (default: http://localhost:7890). */
  bridgeUrl?: string;
  /** How often to push state and poll commands (ms, default: 500). */
  pollIntervalMs?: number;
}

export interface BridgeConnection {
  /** Stop polling and disconnect. */
  disconnect: () => void;
  /** Manually push current state immediately. */
  push: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

export function connectGridToBridge(options: ConnectGridOptions): BridgeConnection {
  const {
    gridId,
    getData,
    getColumns,
    getPagination,
    getSort,
    getFilters,
    api,
    onCellUpdate,
    bridgeUrl = 'http://localhost:7890',
    pollIntervalMs = 500,
  } = options;

  let stopped = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  /** Serialize current grid state for the bridge. */
  function buildState(): Record<string, unknown> {
    const data = getData();
    const columns = getColumns();
    const pagination = getPagination?.() ?? {
      page: 1,
      pageSize: data.length,
      totalCount: data.length,
      pageCount: 1,
    };
    const sortModel = getSort?.() ?? [];
    const filterModel = getFilters?.() ?? {};

    return {
      gridId,
      rowCount: data.length,
      data: data.slice(0, 200), // cap at 200 rows to keep payload small
      columns,
      sortModel,
      filterModel,
      ...pagination,
    };
  }

  /** Register / heartbeat with the bridge. */
  async function connect(): Promise<void> {
    try {
      await fetch(`${bridgeUrl}/grids/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildState()),
      });
    } catch {
      // Bridge not running  -  silently ignore
    }
  }

  /** Push current state to bridge. */
  async function push(): Promise<void> {
    if (stopped) return;
    try {
      await fetch(`${bridgeUrl}/grids/${encodeURIComponent(gridId)}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildState()),
      });
    } catch {
      // ignore
    }
  }

  /** Handle a single command received from the bridge. */
  async function handleCommand(cmd: BridgeCommand): Promise<void> {
    let result: unknown = null;
    let error: string | undefined;

    try {
      switch (cmd.type) {
        case 'update_cell': {
          const rowIndex = cmd.payload['rowIndex'] as number;
          const columnId = cmd.payload['columnId'] as string;
          const value = cmd.payload['value'];
          if (onCellUpdate) {
            onCellUpdate(rowIndex, columnId, value);
            result = { ok: true, rowIndex, columnId, value };
          } else {
            error = 'No onCellUpdate handler provided';
          }
          break;
        }
        case 'set_filter': {
          const columnId = cmd.payload['columnId'] as string;
          const value = cmd.payload['value'];
          if (api?.updateFilter) {
            api.updateFilter(columnId, value);
            result = { ok: true };
          } else {
            error = 'No api.updateFilter available';
          }
          break;
        }
        case 'clear_filters': {
          if (api?.clearFilters) {
            api.clearFilters();
            result = { ok: true };
          } else {
            error = 'No api.clearFilters available';
          }
          break;
        }
        case 'set_sort': {
          const sortModel = cmd.payload['sortModel'] as Array<{
            columnId: string;
            direction: 'asc' | 'desc';
          }>;
          if (api?.updateSort) {
            api.updateSort(sortModel);
            result = { ok: true };
          } else {
            error = 'No api.updateSort available';
          }
          break;
        }
        case 'go_to_page': {
          const page = cmd.payload['page'] as number;
          if (api?.goToPage) {
            api.goToPage(page);
            result = { ok: true };
          } else {
            error = 'No api.goToPage available';
          }
          break;
        }
        default:
          error = `Unknown command type: ${cmd.type}`;
      }
    } catch (e) {
      error = String(e);
    }

    // Report result back
    try {
      await fetch(
        `${bridgeUrl}/grids/${encodeURIComponent(gridId)}/commands/${encodeURIComponent(cmd.id)}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result, error }),
        },
      );
    } catch {
      // ignore
    }
  }

  /** Poll for commands and push state. */
  async function tick(): Promise<void> {
    if (stopped) return;
    // Poll commands
    try {
      const res = await fetch(
        `${bridgeUrl}/grids/${encodeURIComponent(gridId)}/commands`,
      );
      if (res.ok) {
        const cmds = (await res.json()) as BridgeCommand[];
        for (const cmd of cmds) {
          void handleCommand(cmd);
        }
      }
    } catch {
      // Bridge not available  -  keep trying
    }
    // Push state
    await push();
  }

  // Start
  void connect();
  intervalId = setInterval(() => void tick(), pollIntervalMs);

  return {
    disconnect() {
      stopped = true;
      if (intervalId !== null) clearInterval(intervalId);
    },
    push,
  };
}
