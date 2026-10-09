# OGrid documentation

Private Docusaurus workspace for OGrid. Pages live in `docs/`, interactive examples in `src/components/demos/`, and site assets in `static/`. The MCP build copies these pages into its bundled documentation.

From the repository root (Bun >= 1.4.2, Node >= 22.19.0):

```bash
bun install --frozen-lockfile
bun run docs:dev:full              # Build grid dependencies, then start the site
# If packages are already built:
bun run docs:dev

npm run build                     # All workspaces, including docs and MCP
bun run docs:build
bun run docs:serve
bun run test:e2e:docs              # Browser checks against the built site
```

The site resolves OGrid imports to each package's `dist/esm` output. Build packages before running the dev server. Keep documented props and examples aligned with the exported API; `bun run check:exports` checks documented imports, and the site build rejects broken page links.

[Live documentation](https://alaarab.github.io/ogrid/) · [Quick start](https://alaarab.github.io/ogrid/docs/getting-started/quick-start) · [API](https://alaarab.github.io/ogrid/docs/api/ogrid-props)

The [Deploy Docs workflow](../../.github/workflows/deploy-docs.yml) builds and publishes the site. This workspace is not published to npm.
