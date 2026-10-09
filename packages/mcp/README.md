# @alaarab/ogrid-mcp

Standalone MCP server for bundled OGrid documentation, with an optional local HTTP bridge to inspect and control a running grid. No grid runtime dependency. MIT licensed. Requires Node >= 18.

Add to your editor's MCP configuration:

```json
{
  "mcpServers": {
    "ogrid": { "command": "npx", "args": ["-y", "@alaarab/ogrid-mcp"] }
  }
}
```

```bash
npx -y @alaarab/ogrid-mcp            # Docs server over stdio
npx -y @alaarab/ogrid-mcp --bridge   # Also start the live bridge on port 7890
npx -y @alaarab/ogrid-mcp --version  # Print the package version
```

| Tools | Purpose |
|---|---|
| `search_docs`, `list_docs`, `get_docs` | Find and retrieve documentation |
| `get_code_example`, `detect_version` | Find examples and inspect a project's package.json |
| `list_grids`, `get_grid_state`, `send_grid_command` | Inspect/control connected grids; only registered when the bridge is listening |

Resources: `ogrid://quick-reference`, `ogrid://migration-guide`, `ogrid://docs/{path}`. Set `OGRID_DOCS_PATH` to override the bundled docs directory; `OGRID_BRIDGE_PORT` selects a port and enables the bridge.

In a dev app with the bridge running, connect the grid through the client subpath:

```tsx
import { useEffect, type RefObject } from 'react';
import type { IOGridApi } from '@alaarab/ogrid-react';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';

interface Row { id: string; name: string }

export function useLiveBridge(apiRef: RefObject<IOGridApi<Row> | null>) {
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const connection = connectGridToBridge({ gridId: 'employees', api });
    return () => connection.disconnect();
  }, [apiRef]);
}
```

Call the hook in the component that renders the grid. The API supplies displayed rows, visible column IDs, sort/filter state and selection, with sort/filter commands. Pass `onCellUpdate` for edits and a `goToPage` method on the bridge API for pagination; the client defaults to polling `http://localhost:7890` every 500 ms. State payloads contain at most 200 displayed rows.

See the [MCP guide](https://alaarab.github.io/ogrid/docs/guides/mcp) and [live testing guide](https://alaarab.github.io/ogrid/docs/guides/mcp-live-testing).
