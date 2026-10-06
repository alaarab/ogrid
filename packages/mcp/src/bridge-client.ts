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
 *       api: gridApiRef.current,           // IOGridApi: rows, columns, sort, filters, selection
 *       // getData / getColumns / getSort / getFilters override what the api reports
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

/**
 * Grid API used by the bridge. An `IOGridApi` (the `<OGrid>` ref) fits as-is:
 * filters go through `setFilterModel`, sort through `applyColumnState`, and
 * selection is read from `getSelectedRows`. `IOGridApi` has no page setter, so
 * pass `goToPage` yourself for go_to_page. `updateSort` / `updateFilter`, when
 * given, take precedence over the `IOGridApi` methods.
 */
export interface BridgeGridApi {
  updateSort?: (model: Array<{ columnId: string; direction: 'asc' | 'desc' }>) => void;
  updateFilter?: (columnId: string, value: unknown) => void;
  clearFilters?: () => void;
  goToPage?: (page: number) => void;
  getSelectedRows?: () => unknown[];
  // IOGridApi members (method syntax, so IOGridApi<T> stays assignable).
  setFilterModel?(filters: Record<string, unknown>): void;
  getColumnState?(): {
    visibleColumns?: string[];
    sort?: { field: string; direction: 'asc' | 'desc' };
    filters?: Record<string, unknown>;
  };
  getDisplayedRows?(): unknown[];
  applyColumnState?(state: { sort?: { field: string; direction: 'asc' | 'desc' } }): void;
  clearSort?(): void;
}

export interface ConnectGridOptions {
  /** Unique identifier for this grid instance (shown in list_grids). */
  gridId: string;
  /** Returns the currently displayed rows. Called on every state push. Defaults to `api.getDisplayedRows()`. */
  getData?: () => unknown[];
  /** Returns the current column definitions. Defaults to the visible column ids from `api.getColumnState()`. */
  getColumns?: () => BridgeColumnInfo[];
  /** Current pagination state. */
  getPagination?: () => { page: number; pageSize: number; totalCount: number; pageCount: number };
  /** Returns the current sort model. Called on every state push. Defaults to `api.getColumnState().sort`. */
  getSort?: () => Array<{ columnId: string; direction: 'asc' | 'desc' }>;
  /** Returns the current filter model. Called on every state push. Defaults to `api.getColumnState().filters`. */
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Aborts in-flight requests on disconnect, so nothing lands after unmount.
  const controller = new AbortController();
  const { signal } = controller;

  /** Serialize current grid state for the bridge. */
  function buildState(): Record<string, unknown> {
    // With only an IOGridApi, read everything the app did not supply from it.
    const columnState = api?.getColumnState?.();
    const data = getData?.() ?? api?.getDisplayedRows?.() ?? [];
    const columns = getColumns?.() ?? (columnState?.visibleColumns ?? []).map((columnId) => ({ columnId }));
    const pagination = getPagination?.() ?? {
      page: 1,
      pageSize: data.length,
      totalCount: data.length,
      pageCount: 1,
    };
    const sortModel =
      getSort?.() ??
      (columnState?.sort ? [{ columnId: columnState.sort.field, direction: columnState.sort.direction }] : []);
    const filterModel = getFilters?.() ?? columnState?.filters ?? {};
    const selectedRowIds = api?.getSelectedRows?.() ?? [];

    return {
      gridId,
      rowCount: data.length,
      data: data.slice(0, 200), // cap at 200 rows to keep payload small
      columns,
      sortModel,
      filterModel,
      selectedRowIds,
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
        signal,
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
        signal,
      });
    } catch {
      // ignore
    }
  }

  /** Handle a single command received from the bridge. */
  async function handleCommand(cmd: BridgeCommand): Promise<void> {
    if (stopped) return;
    let result: unknown = null;
    let error: string | undefined;
    const payload = cmd.payload ?? {};

    try {
      switch (cmd.type) {
        case 'update_cell': {
          const rowIndex = payload.rowIndex;
          const columnId = payload.columnId;
          const value = payload.value;
          if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex) || rowIndex < 0 || typeof columnId !== 'string') {
            error = 'update_cell needs { rowIndex: integer >= 0, columnId: string, value }';
          } else if (onCellUpdate) {
            onCellUpdate(rowIndex, columnId, value);
            result = { ok: true, rowIndex, columnId, value };
          } else {
            error = 'No onCellUpdate handler provided';
          }
          break;
        }
        case 'set_filter': {
          const columnId = payload.columnId;
          const value = payload.value;
          const isList = Array.isArray(value) && value.every((v) => typeof v === 'string');
          if (typeof columnId !== 'string' || (typeof value !== 'string' && !isList)) {
            error = 'set_filter needs { columnId: string, value: string | string[] }';
          } else if (api?.updateFilter) {
            api.updateFilter(columnId, value);
            result = { ok: true };
          } else if (api?.setFilterModel) {
            const filters = { ...(api.getColumnState?.().filters ?? {}) };
            if (value.length === 0) delete filters[columnId];
            else filters[columnId] = isList ? { type: 'multiSelect', value } : { type: 'text', value };
            api.setFilterModel(filters);
            result = { ok: true };
          } else {
            error = 'No api.updateFilter or api.setFilterModel available';
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
          const sortModel = payload.sortModel;
          const valid =
            Array.isArray(sortModel) &&
            sortModel.every(
              (s) =>
                s !== null &&
                typeof s === 'object' &&
                typeof (s as { columnId?: unknown }).columnId === 'string' &&
                ((s as { direction?: unknown }).direction === 'asc' ||
                  (s as { direction?: unknown }).direction === 'desc'),
            );
          if (!valid) {
            error = 'set_sort needs { sortModel: [{ columnId: string, direction: "asc" | "desc" }] }';
            break;
          }
          const model = sortModel as Array<{ columnId: string; direction: 'asc' | 'desc' }>;
          const first = model[0];
          if (api?.updateSort) {
            api.updateSort(model);
            result = { ok: true };
          } else if (first && api?.applyColumnState) {
            // IOGridApi sorts by a single column.
            api.applyColumnState({ sort: { field: first.columnId, direction: first.direction } });
            result = { ok: true };
          } else if (!first && api?.clearSort) {
            api.clearSort();
            result = { ok: true };
          } else {
            error = 'No api.updateSort or api.applyColumnState available';
          }
          break;
        }
        case 'go_to_page': {
          const page = payload.page;
          if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
            error = 'go_to_page needs { page: integer >= 1 }';
          } else if (api?.goToPage) {
            api.goToPage(page);
            result = { ok: true };
          } else {
            error = 'No api.goToPage available (IOGridApi has no page setter; pass goToPage)';
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
          signal,
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
        { signal },
      );
      if (res.ok) {
        const cmds = (await res.json()) as BridgeCommand[];
        for (const cmd of cmds) {
          await handleCommand(cmd);
        }
      }
    } catch {
      // Bridge not available  -  keep trying
    }
    // Push state
    await push();
  }

  /** Schedule the next tick only after the previous one finished, so ticks never overlap. */
  function schedule(): void {
    if (stopped) return;
    timer = setTimeout(() => {
      void tick().then(schedule);
    }, pollIntervalMs);
  }

  // Start
  void connect();
  schedule();

  return {
    disconnect() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      controller.abort();
    },
    push,
  };
}
