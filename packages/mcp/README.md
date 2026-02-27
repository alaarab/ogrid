# @alaarab/ogrid-mcp

MCP (Model Context Protocol) server for OGrid documentation. Lets AI assistants search and retrieve OGrid docs, code examples, and API references across all supported frameworks (React, Angular, Vue, vanilla JS).

## Usage

### Claude Desktop

Add this to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ogrid": {
      "command": "npx",
      "args": ["-y", "@alaarab/ogrid-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add ogrid -- npx -y @alaarab/ogrid-mcp
```

### Direct execution

```bash
npx @alaarab/ogrid-mcp
```

## Tools

The server exposes 4 tools:

| Tool | Description |
|------|-------------|
| `search_docs` | Search OGrid documentation by keyword. Returns matching docs with title, description, and content excerpt. |
| `list_docs` | List available documentation pages, optionally filtered by category (`features`, `getting-started`, `guides`, `api`). |
| `get_docs` | Get the full content of a documentation page by its path. |
| `get_code_example` | Find code examples matching a query, optionally filtered by framework (`react`, `angular`, `vue`, `js`). |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OGRID_DOCS_PATH` | Absolute path to the docs directory containing `.mdx`/`.md` files. | `packages/docs/docs` relative to the package install location |

## How it works

On startup, the server indexes all `.mdx` and `.md` files from the docs directory. It parses frontmatter (title, description), extracts fenced code blocks with framework detection, and builds a searchable in-memory index. Search results are ranked by title match, description match, content density, and category relevance.
