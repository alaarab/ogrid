import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { DocsIndex } from './docsLoader.js';
import type { BridgeStore } from './bridge.js';

// ---------------------------------------------------------------------------
// detect_version helpers
// ---------------------------------------------------------------------------

interface VersionDetectResult {
  found: boolean;
  version?: string;
  framework?: string;
  packages?: Array<{ name: string; version: string }>;
  packageJsonPath?: string;
}

function detectFramework(packageNames: string[]): string {
  if (packageNames.some((n) => n.includes('-react'))) return 'react';
  if (packageNames.some((n) => n.includes('-angular'))) return 'angular';
  if (packageNames.some((n) => n.includes('-vue'))) return 'vue';
  if (packageNames.some((n) => n.endsWith('-js'))) return 'js';
  return 'unknown';
}

function detectOGridVersion(searchPath: string): VersionDetectResult {
  let dir = searchPath;
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw) as Record<string, unknown>;
        const allDeps: Record<string, string> = {
          ...((pkg['dependencies'] as Record<string, string>) ?? {}),
          ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
          ...((pkg['peerDependencies'] as Record<string, string>) ?? {}),
        };
        const ogridPkgs = Object.entries(allDeps)
          .filter(([name]) => name.startsWith('@alaarab/ogrid-'))
          .map(([name, version]) => ({ name, version: String(version) }));

        if (ogridPkgs.length > 0) {
          const framework = detectFramework(ogridPkgs.map((p) => p.name));
          const version = ogridPkgs[0].version.replace(/^[\^~>=<]+/, '');
          return { found: true, version, framework, packages: ogridPkgs, packageJsonPath: pkgPath };
        }
      } catch {
        // malformed package.json  -  keep walking up
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { found: false };
}

// ---------------------------------------------------------------------------
// Resource URI helpers
// ---------------------------------------------------------------------------

/** Strip file extension from a doc path to create a clean resource URI segment. */
function toResourcePath(docPath: string): string {
  return docPath.replace(/\.(mdx|md)$/, '');
}

/** Reverse: add back .mdx suffix for index lookup (try both). */
function fromResourcePath(resourcePath: string, index: DocsIndex): ReturnType<DocsIndex['getByPath']> {
  return (
    index.getByPath(resourcePath + '.mdx') ??
    index.getByPath(resourcePath + '.md') ??
    index.getByPath(resourcePath)
  );
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createOGridMcpServer(index: DocsIndex, bridge?: BridgeStore): McpServer {
  const server = new McpServer({
    name: 'ogrid-docs',
    version: '2.3.0',
    instructions: `OGrid documentation server. OGrid is a lightweight multi-framework data grid for React, Angular, Vue, and vanilla JS.

Tools: search_docs (keyword search), list_docs (browse by category), get_docs (full page), get_code_example (code snippets), detect_version (detect OGrid version in your project).
Resources: ogrid://quick-reference (key API overview), ogrid://docs/{path} (any doc page by path).
Categories: features, getting-started, guides, api.`,
  });

  // -------------------------------------------------------------------------
  // Tool: search_docs
  // -------------------------------------------------------------------------
  server.tool(
    'search_docs',
    'Search OGrid documentation by keyword. Returns matching docs with title, description, and content excerpt.',
    {
      query: z.string().describe('Search query string'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Max results to return (default 5)'),
      framework: z
        .enum(['react', 'angular', 'vue', 'js'])
        .optional()
        .describe('Filter code examples to this framework'),
    },
    async ({ query, limit, framework }) => {
      const results = index.search(query, limit ?? 5);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No documentation found for "${query}". Try a different search term or use list_docs to browse available docs.`,
            },
          ],
        };
      }

      const formatted = results
        .map((entry, i) => {
          const excerpt =
            entry.content.length > 400 ? entry.content.slice(0, 400) + '...' : entry.content;

          // If framework filter given, show only code blocks for that framework
          const relevantCode = framework
            ? entry.codeBlocks.filter((b) => !b.framework || b.framework === framework).slice(0, 1)
            : [];

          const codeSnippet =
            relevantCode.length > 0
              ? `\n\`\`\`${relevantCode[0].language}\n${relevantCode[0].code.slice(0, 300)}\n\`\`\``
              : '';

          return [
            `## ${i + 1}. ${entry.title}`,
            `**Path:** ${entry.path}  |  **Category:** ${entry.category}`,
            `**Description:** ${entry.description}`,
            '',
            excerpt,
            codeSnippet,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n---\n\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${results.length} result(s) for "${query}":\n\n${formatted}`,
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Tool: list_docs
  // -------------------------------------------------------------------------
  server.tool(
    'list_docs',
    'List available OGrid documentation pages, optionally filtered by category (features, getting-started, guides, api).',
    {
      category: z
        .string()
        .optional()
        .describe('Filter by category: features, getting-started, guides, api'),
    },
    async ({ category }) => {
      const entries = category ? index.getByCategory(category) : index.entries;

      if (entries.length === 0) {
        const available = [...new Set(index.entries.map((e) => e.category))];
        return {
          content: [
            {
              type: 'text' as const,
              text: category
                ? `No docs found in category "${category}". Available categories: ${available.join(', ')}`
                : 'No documentation entries found.',
            },
          ],
        };
      }

      const formatted = entries
        .map(
          (entry) =>
            `- **${entry.title}**  -  ${entry.description}\n  Path: \`${entry.path}\` | Resource: \`ogrid://docs/${toResourcePath(entry.path)}\``,
        )
        .join('\n');

      const header = category
        ? `Documentation in "${category}" (${entries.length} pages):`
        : `All documentation (${entries.length} pages):`;

      return {
        content: [{ type: 'text' as const, text: `${header}\n\n${formatted}` }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Tool: get_docs
  // -------------------------------------------------------------------------
  server.tool(
    'get_docs',
    'Get the full content of an OGrid documentation page by its path.',
    {
      path: z.string().describe('Document path (e.g. "features/sorting" or "api/column-def")'),
    },
    async ({ path }) => {
      const entry = fromResourcePath(path, index);

      if (!entry) {
        const available = index.entries.map((e) => `  - ${toResourcePath(e.path)}`).join('\n');
        return {
          content: [
            {
              type: 'text' as const,
              text: `Document not found: "${path}"\n\nAvailable paths:\n${available}`,
            },
          ],
        };
      }

      const header = [
        `# ${entry.title}`,
        `**Category:** ${entry.category}`,
        `**Description:** ${entry.description}`,
        '',
        '---',
        '',
      ].join('\n');

      return {
        content: [{ type: 'text' as const, text: header + entry.content }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Tool: get_code_example
  // -------------------------------------------------------------------------
  server.tool(
    'get_code_example',
    'Find code examples from OGrid docs matching a query, optionally filtered by framework.',
    {
      query: z.string().describe('Search query for code examples'),
      framework: z
        .enum(['react', 'angular', 'vue', 'js'])
        .optional()
        .describe('Filter by framework: react, angular, vue, js'),
    },
    async ({ query, framework }) => {
      const examples = index.getCodeExamples(query, framework);

      if (examples.length === 0) {
        const hint = framework ? ` for framework "${framework}"` : '';
        return {
          content: [
            {
              type: 'text' as const,
              text: `No code examples found matching "${query}"${hint}. Try a broader search term or remove the framework filter.`,
            },
          ],
        };
      }

      const limited = examples.slice(0, 5);
      const formatted = limited
        .map((example, i) => {
          const frameworkLabel = example.block.framework ? ` (${example.block.framework})` : '';
          return [
            `### Example ${i + 1}: ${example.entry.title}${frameworkLabel}`,
            '',
            '```' + example.block.language,
            example.block.code,
            '```',
          ].join('\n');
        })
        .join('\n\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${examples.length} code example(s) for "${query}"${framework ? ` (${framework})` : ''}:\n\n${formatted}`,
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Tool: detect_version
  // -------------------------------------------------------------------------
  server.tool(
    'detect_version',
    'Detect which OGrid version and framework is installed in the user\'s project by reading their package.json.',
    {
      path: z
        .string()
        .optional()
        .describe(
          'Directory to search from (defaults to current working directory). The tool walks up the directory tree to find the nearest package.json with OGrid dependencies.',
        ),
    },
    async ({ path }) => {
      const searchPath = path ?? process.cwd();
      const result = detectOGridVersion(searchPath);

      if (!result.found) {
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                `No OGrid packages found in package.json (searched from: ${searchPath}).`,
                '',
                'Install OGrid for your framework:',
                '  React (Radix):    npm install @alaarab/ogrid-react-radix',
                '  React (Material): npm install @alaarab/ogrid-react-material',
                '  React (Fluent):   npm install @alaarab/ogrid-react-fluent',
                '  Angular Material: npm install @alaarab/ogrid-angular-material',
                '  Angular PrimeNG:  npm install @alaarab/ogrid-angular-primeng',
                '  Vue Vuetify:      npm install @alaarab/ogrid-vue-vuetify',
                '  Vue PrimeVue:     npm install @alaarab/ogrid-vue-primevue',
                '  Vanilla JS:       npm install @alaarab/ogrid-js',
              ].join('\n'),
            },
          ],
        };
      }

      const pkgList = (result.packages ?? [])
        .map((p) => `  - ${p.name}: ${p.version}`)
        .join('\n');

      const frameworkTip =
        result.framework !== 'unknown'
          ? `\n\nTip: use \`get_code_example\` with framework="${result.framework}" or \`search_docs\` with framework="${result.framework}" to get framework-specific results.`
          : '';

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `✅ OGrid detected in ${result.packageJsonPath}`,
              '',
              `Version:   ${result.version}`,
              `Framework: ${result.framework}`,
              '',
              'Packages installed:',
              pkgList,
              frameworkTip,
            ]
              .filter((l) => l !== undefined)
              .join('\n'),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Resource: ogrid://quick-reference (static)
  // -------------------------------------------------------------------------
  server.resource(
    'quick-reference',
    'ogrid://quick-reference',
    { description: 'OGrid quick-reference: key props, install commands, and common patterns', mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: [
            '# OGrid Quick Reference',
            '',
            '## Install',
            '```bash',
            '# React (choose one)',
            'npm install @alaarab/ogrid-react-radix',
            'npm install @alaarab/ogrid-react-material',
            'npm install @alaarab/ogrid-react-fluent',
            '',
            '# Angular (choose one)',
            'npm install @alaarab/ogrid-angular-material',
            'npm install @alaarab/ogrid-angular-primeng',
            'npm install @alaarab/ogrid-angular-radix',
            '',
            '# Vue (choose one)',
            'npm install @alaarab/ogrid-vue-vuetify',
            'npm install @alaarab/ogrid-vue-primevue',
            'npm install @alaarab/ogrid-vue-radix',
            '',
            '# Vanilla JS',
            'npm install @alaarab/ogrid-js',
            '```',
            '',
            '## Core Props (IOGridProps)',
            '| Prop | Type | Description |',
            '|------|------|-------------|',
            '| `data` | `T[]` | Client-side row data |',
            '| `columns` | `IColumnDef<T>[]` | Column definitions |',
            '| `dataSource` | `IDataSource<T>` | Server-side data source |',
            '| `pagination` | `boolean \\| number` | Enable pagination (number = page size) |',
            '| `rowSelection` | `"single" \\| "multiple"` | Row selection mode |',
            '| `formulas` | `boolean` | Enable formula engine (=SUM, =IF, etc.) |',
            '| `cellReferences` | `boolean` | Excel-style A1 column headers + name box |',
            '| `workerSort` | `boolean \\| "auto"` | Web Worker sort/filter |',
            '| `columnChooser` | `boolean \\| "toolbar" \\| "sidebar"` | Column visibility control |',
            '| `sideBar` | `boolean \\| ISideBarDef` | Sidebar panel |',
            '| `toolbar` | `ReactNode` | Custom toolbar content |',
            '| `onRowSelectionChanged` | `(rows: T[]) => void` | Row selection callback |',
            '| `onCellValueChanged` | `(e: ICellValueChangedEvent) => void` | Cell edit callback |',
            '',
            '## IColumnDef Key Fields',
            '| Field | Type | Description |',
            '|-------|------|-------------|',
            '| `columnId` | `string` | Unique column ID (maps to data key) |',
            '| `headerName` | `string` | Column header label |',
            '| `type` | `"text" \\| "numeric" \\| "date" \\| "boolean"` | Data type |',
            '| `filter` | `"none" \\| "text" \\| "multiSelect" \\| "date"` | Filter type |',
            '| `editable` | `boolean \\| (row) => boolean` | Enable inline editing |',
            '| `width` | `number` | Column width in px |',
            '| `pinned` | `"left" \\| "right"` | Pin column |',
            '| `sortable` | `boolean` | Enable sorting |',
            '| `hidden` | `boolean` | Hide column by default |',
            '| `valueGetter` | `(row: T) => unknown` | Custom value extractor |',
            '| `renderCell` | `(value, row) => ReactNode` | Custom cell renderer (React) |',
            '',
            '## Common Patterns',
            '',
            '### Client-side data',
            '```tsx',
            'import { OGrid } from "@alaarab/ogrid-react-radix";',
            'const columns = [',
            '  { columnId: "name", headerName: "Name", type: "text", filter: "text" },',
            '  { columnId: "age",  headerName: "Age",  type: "numeric", sortable: true },',
            '];',
            '<OGrid data={rows} columns={columns} pagination={50} />',
            '```',
            '',
            '### Server-side data',
            '```tsx',
            'const dataSource = {',
            '  fetchPage: async ({ page, pageSize, sortModel, filterModel }) => {',
            '    const res = await fetch(`/api/data?page=${page}&size=${pageSize}`);',
            '    const json = await res.json();',
            '    return { rows: json.data, totalCount: json.total };',
            '  }',
            '};',
            '<OGrid dataSource={dataSource} columns={columns} pagination={50} />',
            '```',
            '',
            '### Formula support',
            '```tsx',
            '<OGrid data={rows} columns={columns} formulas cellReferences />',
            '// Users can type =SUM(A1:C3), =IF(A1>0,"yes","no"), etc.',
            '```',
          ].join('\n'),
        },
      ],
    }),
  );

  // -------------------------------------------------------------------------
  // Resource: ogrid://migration-guide (static)
  // -------------------------------------------------------------------------
  server.resource(
    'migration-guide',
    'ogrid://migration-guide',
    { description: 'Full migration guide from AG Grid to OGrid with side-by-side API mapping', mimeType: 'text/markdown' },
    async (uri) => {
      const entry =
        index.getByPath('guides/migration-from-ag-grid.mdx') ??
        index.getByPath('guides/migration-from-ag-grid.md') ??
        index.getByPath('guides/migration-from-ag-grid');

      const text = entry
        ? `# ${entry.title}\n> ${entry.description}\n\n${entry.content}`
        : '# Migration from AG Grid\n\nMigration guide not found in docs index. Use `search_docs` with query "migration" to find available migration content.';

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text,
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Prompt: migrate-from-ag-grid
  // -------------------------------------------------------------------------
  server.prompt(
    'migrate-from-ag-grid',
    'Step-by-step guide to migrate from AG Grid to OGrid',
    async () => {
      const entry =
        index.getByPath('guides/migration-from-ag-grid.mdx') ??
        index.getByPath('guides/migration-from-ag-grid.md') ??
        index.getByPath('guides/migration-from-ag-grid');

      const guideContent = entry
        ? entry.content
        : 'Migration guide not found. Please use `search_docs` with query "migration" to find available content.';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'I want to migrate my project from AG Grid to OGrid. Use the following migration guide to help me step by step.',
                '',
                '---',
                '',
                guideContent,
                '',
                '---',
                '',
                'Please analyze my current AG Grid usage and provide specific migration steps. For each AG Grid API, prop, or pattern I use, show me the OGrid equivalent with a code example.',
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Resource template: ogrid://docs/{path}  -  any doc page by path
  // -------------------------------------------------------------------------
  server.resource(
    'doc-page',
    new ResourceTemplate('ogrid://docs/{path}', {
      list: async () => ({
        resources: index.entries.map((entry) => ({
          uri: `ogrid://docs/${toResourcePath(entry.path)}`,
          name: entry.title,
          description: entry.description,
          mimeType: 'text/markdown',
        })),
      }),
    }),
    { description: 'OGrid documentation page. Use path like "features/filtering" or "api/column-def".', mimeType: 'text/markdown' },
    async (uri, { path }) => {
      const entry = fromResourcePath(path as string, index);

      if (!entry) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/markdown',
              text: `# Not Found\n\nNo documentation found at path: "${path}"\n\nUse \`list_docs\` tool or \`resources/list\` to see available paths.`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: [
              `# ${entry.title}`,
              `> ${entry.description}`,
              '',
              entry.content,
            ].join('\n'),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Bridge tools (only registered when a BridgeStore is provided)
  // -------------------------------------------------------------------------

  if (bridge) {
    // -----------------------------------------------------------------------
    // Tool: list_grids
    // -----------------------------------------------------------------------
    server.tool(
      'list_grids',
      'List OGrid instances currently connected to the live testing bridge. Returns grid IDs, row counts, page info, and last-seen timestamps.',
      {},
      async () => {
        const grids = bridge.listGrids();
        if (grids.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  'No OGrid instances connected.',
                  '',
                  'To connect your app, add the bridge client:',
                  '```js',
                  "import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';",
                  "const bridge = connectGridToBridge({ gridId: 'my-grid', getData: () => rows, getColumns: () => columns });",
                  '```',
                  '',
                  'Then start the MCP server with bridge enabled:',
                  '  OGRID_BRIDGE_PORT=7890 npx @alaarab/ogrid-mcp',
                  '   -  or  - ',
                  '  npx @alaarab/ogrid-mcp --bridge',
                ].join('\n'),
              },
            ],
          };
        }

        const formatted = grids
          .map((g) => {
            const age = Math.round((Date.now() - g.lastSeen) / 1000);
            return [
              `**${g.gridId}**`,
              `  Rows: ${g.rowCount} displayed / ${g.totalCount} total`,
              `  Page: ${g.page} / ${g.pageCount} (${g.pageSize} per page)`,
              `  Columns: ${g.columns.map((c) => c.columnId).join(', ')}`,
              `  Active filters: ${Object.keys(g.filterModel).length}`,
              `  Last seen: ${age}s ago`,
            ].join('\n');
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text' as const,
              text: `${grids.length} connected grid(s):\n\n${formatted}`,
            },
          ],
        };
      },
    );

    // -----------------------------------------------------------------------
    // Tool: get_grid_state
    // -----------------------------------------------------------------------
    server.tool(
      'get_grid_state',
      'Get the current state of a connected OGrid instance: displayed rows, columns, sort, filters, pagination, and selection.',
      {
        gridId: z.string().describe('Grid ID as registered by connectGridToBridge()'),
        includeData: z
          .boolean()
          .optional()
          .describe('Whether to include the full row data (default: false  -  shows only summary)'),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Max rows to include when includeData=true (default: 20)'),
      },
      async ({ gridId, includeData, maxRows }) => {
        const state = bridge.getState(gridId);
        if (!state) {
          const available = bridge.listGrids().map((g) => g.gridId);
          return {
            content: [
              {
                type: 'text' as const,
                text:
                  available.length > 0
                    ? `Grid "${gridId}" not found. Available grids: ${available.join(', ')}`
                    : `Grid "${gridId}" not found. No grids are currently connected.`,
              },
            ],
          };
        }

        const age = Math.round((Date.now() - state.lastSeen) / 1000);
        const colNames = state.columns
          .map((c) => `${c.columnId}${c.type ? ` (${c.type})` : ''}`)
          .join(', ');
        const sortDesc =
          state.sortModel.length > 0
            ? state.sortModel.map((s) => `${s.columnId} ${s.direction}`).join(', ')
            : 'none';
        const filterDesc =
          Object.keys(state.filterModel).length > 0
            ? JSON.stringify(state.filterModel)
            : 'none';

        const sections: string[] = [
          `# Grid: ${gridId}`,
          `Last seen: ${age}s ago`,
          '',
          `## Pagination`,
          `Page ${state.page} of ${state.pageCount} | ${state.rowCount} rows displayed | ${state.totalCount} total`,
          `Page size: ${state.pageSize}`,
          '',
          `## Columns (${state.columns.length})`,
          colNames,
          '',
          `## Sort`,
          sortDesc,
          '',
          `## Filters`,
          filterDesc,
          '',
          `## Selection`,
          state.selectedRowIndices.length > 0
            ? `${state.selectedRowIndices.length} row(s) selected: indices [${state.selectedRowIndices.slice(0, 10).join(', ')}${state.selectedRowIndices.length > 10 ? ', ...' : ''}]`
            : 'None',
        ];

        if (includeData) {
          const limit = maxRows ?? 20;
          const rows = state.data.slice(0, limit);
          sections.push('', `## Data (first ${rows.length} of ${state.rowCount} rows)`);
          sections.push('```json');
          sections.push(JSON.stringify(rows, null, 2));
          sections.push('```');
          if (state.rowCount > limit) {
            sections.push(`\n_${state.rowCount - limit} more rows not shown. Increase maxRows to see more._`);
          }
        }

        return {
          content: [{ type: 'text' as const, text: sections.join('\n') }],
        };
      },
    );

    // -----------------------------------------------------------------------
    // Tool: send_grid_command
    // -----------------------------------------------------------------------
    server.tool(
      'send_grid_command',
      [
        'Send a command to a connected OGrid instance and wait for the result.',
        '',
        'Command types:',
        '  update_cell    -  { rowIndex: number, columnId: string, value: unknown }',
        '  set_filter     -  { columnId: string, value: string | string[] }',
        '  clear_filters  -  {}',
        '  set_sort       -  { sortModel: [{ columnId, direction: "asc"|"desc" }] }',
        '  go_to_page     -  { page: number }',
      ].join('\n'),
      {
        gridId: z.string().describe('Grid ID as registered by connectGridToBridge()'),
        type: z
          .enum(['update_cell', 'set_filter', 'clear_filters', 'set_sort', 'go_to_page'])
          .describe('Command type'),
        payload: z
          .record(z.unknown())
          .describe('Command-specific payload (see tool description for fields per type)'),
        timeoutMs: z
          .number()
          .int()
          .min(100)
          .max(30000)
          .optional()
          .describe('How long to wait for the app to execute the command (default: 5000ms)'),
      },
      async ({ gridId, type, payload, timeoutMs }) => {
        const state = bridge.getState(gridId);
        if (!state) {
          const available = bridge.listGrids().map((g) => g.gridId);
          return {
            content: [
              {
                type: 'text' as const,
                text:
                  available.length > 0
                    ? `Grid "${gridId}" not found. Available: ${available.join(', ')}`
                    : `Grid "${gridId}" not found. No grids are currently connected.`,
              },
            ],
          };
        }

        const cmd = bridge.enqueueCommand(gridId, type, payload as Record<string, unknown>);
        if (!cmd) {
          return {
            content: [{ type: 'text' as const, text: `Failed to enqueue command for grid "${gridId}".` }],
          };
        }

        try {
          const result = await bridge.waitForResult(cmd.id, timeoutMs ?? 5000);
          if (result.status === 'error') {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Command failed: ${result.error ?? 'unknown error'}\n\nCommand: ${JSON.stringify({ type, payload }, null, 2)}`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  `✅ Command executed successfully`,
                  '',
                  `Type: ${type}`,
                  `Payload: ${JSON.stringify(payload)}`,
                  `Result: ${JSON.stringify(result.result)}`,
                  '',
                  `Call get_grid_state to see the updated grid state.`,
                ].join('\n'),
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  `⏱️ Command timed out after ${timeoutMs ?? 5000}ms.`,
                  '',
                  'The OGrid app may not be polling for commands. Check that:',
                  '1. connectGridToBridge() is active in your app',
                  '2. The pollIntervalMs is not too large (default: 500ms)',
                  `3. The grid ID matches: "${gridId}"`,
                ].join('\n'),
              },
            ],
          };
        }
      },
    );
  }

  return server;
}
