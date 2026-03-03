# @alaarab/ogrid-mcp

MCP server that lets AI editors search and retrieve OGrid documentation across all supported frameworks.

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
npx @alaarab/ogrid-mcp
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
