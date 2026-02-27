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

The server exposes 5 tools:

| Tool | Description |
|------|-------------|
| `search_docs` | Search OGrid documentation by keyword. Returns matching docs with title, description, and content excerpt. |
| `list_docs` | List available documentation pages, optionally filtered by category (`features`, `getting-started`, `guides`, `api`). |
| `get_docs` | Get the full content of a documentation page by its path. |
| `get_code_example` | Find code examples matching a query, optionally filtered by framework (`react`, `angular`, `vue`, `js`). |
| `detect_version` | Detect which OGrid version and framework is installed in the user's project by reading their package.json. |

## Resources

| URI | Description |
|-----|-------------|
| `ogrid://quick-reference` | Key props, install commands, and common patterns. |
| `ogrid://migration-guide` | Full migration guide from AG Grid to OGrid with side-by-side API mapping. |
| `ogrid://docs/{path}` | Any documentation page by path (e.g. `ogrid://docs/features/sorting`). |

## Prompts

| Name | Description |
|------|-------------|
| `migrate-from-ag-grid` | Step-by-step guide to migrate from AG Grid to OGrid. Returns the full migration guide with instructions for the AI to analyze your AG Grid usage and provide specific migration steps. |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OGRID_DOCS_PATH` | Absolute path to the docs directory containing `.mdx`/`.md` files. | `packages/docs/docs` relative to the package install location |

## How it works

On startup, the server indexes all `.mdx` and `.md` files from the docs directory. It parses frontmatter (title, description), extracts fenced code blocks with framework detection, and builds a searchable in-memory index. Search results are ranked by title match, description match, content density, and category relevance.
