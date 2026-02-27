import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DocsIndex } from './docsLoader.js';

export function createOGridMcpServer(index: DocsIndex): McpServer {
  const server = new McpServer({
    name: 'ogrid-docs',
    version: '2.3.0',
    instructions: `OGrid documentation server. OGrid is a lightweight multi-framework data grid for React, Angular, Vue, and vanilla JS.
Use search_docs to find relevant docs, list_docs to browse by category, get_docs to read a full page, get_code_example for code samples.
Categories: features, getting-started, guides, api.`,
  });

  // --- Tool 1: search_docs ---
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
    },
    async ({ query, limit }) => {
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
            entry.content.length > 400
              ? entry.content.slice(0, 400) + '...'
              : entry.content;
          return [
            `## ${i + 1}. ${entry.title}`,
            `**Path:** ${entry.path}`,
            `**Category:** ${entry.category}`,
            `**Description:** ${entry.description}`,
            '',
            excerpt,
          ].join('\n');
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

  // --- Tool 2: list_docs ---
  server.tool(
    'list_docs',
    'List available OGrid documentation pages, optionally filtered by category (features, getting-started, guides, api).',
    {
      category: z
        .string()
        .optional()
        .describe(
          'Filter by category: features, getting-started, guides, api',
        ),
    },
    async ({ category }) => {
      const entries = category
        ? index.getByCategory(category)
        : index.entries;

      if (entries.length === 0) {
        const availableCategories = [
          ...new Set(index.entries.map((e) => e.category)),
        ];
        return {
          content: [
            {
              type: 'text' as const,
              text: category
                ? `No docs found in category "${category}". Available categories: ${availableCategories.join(', ')}`
                : 'No documentation entries found.',
            },
          ],
        };
      }

      const formatted = entries
        .map(
          (entry) =>
            `- **${entry.title}** — ${entry.description}\n  Path: \`${entry.path}\` | Category: ${entry.category}`,
        )
        .join('\n');

      const header = category
        ? `Documentation in "${category}" (${entries.length} pages):`
        : `All documentation (${entries.length} pages):`;

      return {
        content: [
          { type: 'text' as const, text: `${header}\n\n${formatted}` },
        ],
      };
    },
  );

  // --- Tool 3: get_docs ---
  server.tool(
    'get_docs',
    'Get the full content of an OGrid documentation page by its path.',
    {
      path: z
        .string()
        .describe('Document path (e.g. "features/sorting")'),
    },
    async ({ path }) => {
      const entry = index.getByPath(path);

      if (!entry) {
        const available = index.entries
          .map((e) => `  - ${e.path}`)
          .join('\n');
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
        content: [
          { type: 'text' as const, text: header + entry.content },
        ],
      };
    },
  );

  // --- Tool 4: get_code_example ---
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
        const hint = framework
          ? ` for framework "${framework}"`
          : '';
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
          const frameworkLabel = example.block.framework
            ? ` (${example.block.framework})`
            : '';
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

  return server;
}
