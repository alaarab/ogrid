# @alaarab/ogrid-mcp

MCP server that lets AI editors (Claude Code, Cursor, VS Code Copilot, etc.) search and retrieve OGrid documentation — and, optionally, inspect and drive live OGrid instances in your running app through a local testing bridge.

## Install

Add to your editor's MCP configuration:

```json
{
  "mcpServers": {
    "ogrid": { "command": "npx", "args": ["-y", "@alaarab/ogrid-mcp"] }
  }
}
```

Or run directly:

```bash
npx @alaarab/ogrid-mcp            # docs server (stdio)
npx @alaarab/ogrid-mcp --bridge   # docs server + live testing bridge on port 7890
npx @alaarab/ogrid-mcp --version  # print version
```

## Tools

Documentation tools (always available):

| Tool | Description |
| --- | --- |
| `search_docs` | Search OGrid documentation by keyword. Returns matching docs with title, description, and content excerpt. |
| `list_docs` | List available documentation pages, optionally filtered by category (`features`, `getting-started`, `guides`, `api`). |
| `get_docs` | Get the full content of a documentation page by path (e.g. `features/sorting`, `api/column-def`). |
| `get_code_example` | Find code examples from the docs matching a query, optionally filtered by framework. |
| `detect_version` | Detect which OGrid version and framework a project uses by reading its `package.json`. |

Live-bridge tools (available when the bridge is enabled):

| Tool | Description |
| --- | --- |
| `list_grids` | List OGrid instances currently connected to the bridge: grid IDs, row counts, page info, last-seen timestamps. |
| `get_grid_state` | Get a connected grid's current state: displayed rows, columns, sort, filters, pagination, and selection. |
| `send_grid_command` | Send a command to a connected grid (sort, filter, paginate, edit a cell, …) and wait for the result. |

## Resources

| URI | Description |
| --- | --- |
| `ogrid://quick-reference` | Key props, install commands, and common patterns. |
| `ogrid://migration-guide` | Full migration guide from AG Grid with side-by-side API mapping. |
| `ogrid://docs/{path}` | Any documentation page by path. |

## Live testing bridge

The bridge lets an AI assistant observe and drive real OGrid instances in your running app — useful for agentic testing and debugging.

1. Start the server with the bridge enabled: `npx @alaarab/ogrid-mcp --bridge` (or set `OGRID_BRIDGE_PORT` to pick a port; `--bridge` defaults to `7890`).
2. In your app, connect a grid to the bridge:

```tsx
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';

const connection = connectGridToBridge({
  gridId: 'employees',
  getData: () => rows,
  getColumns: () => columns,
  api: gridApiRef.current, // optional: enables send_grid_command actions
  // bridgeUrl: 'http://localhost:7890' (default), pollIntervalMs: 500 (default)
});

// later: connection.disconnect();
```

3. The assistant can now call `list_grids`, `get_grid_state`, and `send_grid_command` against your live app.

The bridge client polls the local bridge over HTTP and never talks to anything but `bridgeUrl`.

## Documentation

See the [OGrid docs](https://alaarab.github.io/ogrid/) — in particular the [MCP guide](https://alaarab.github.io/ogrid/docs/guides/mcp) and [MCP live testing guide](https://alaarab.github.io/ogrid/docs/guides/mcp-live-testing).
