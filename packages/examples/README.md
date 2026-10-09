# OGrid examples

Private Vite workspace with Radix and Fluent example apps. Uses the shared grid APIs, optional editors, XLSX package and development MCP bridge.

From the repository root (Bun >= 1.4.2, Node >= 22.19.0):

```bash
bun install --frozen-lockfile
npm run build
bun run dev:react-radix
# Or:
bun run dev:react-fluent
```

```bash
bun run build:examples
bun run test:examples:types
bun run test:e2e:smoke
bun run test:e2e:matrix
```

Build workspace dependencies before starting Vite: imports resolve to package `dist/` entries. Browser tests launch the app servers using the repository's Playwright configurations.

See [quick start](https://alaarab.github.io/ogrid/docs/getting-started/quick-start), [XLSX](https://alaarab.github.io/ogrid/docs/features/xlsx-import) and the [root development commands](../../README.md#development-and-testing). Not published to npm.
