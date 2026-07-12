# Contributing to OGrid

Thanks for your interest in contributing! This guide covers everything you need to get a change from idea to merged PR.

## Getting set up

OGrid uses **Bun** as the package manager, script runner, and test runner, with **Turborepo** for the monorepo pipeline.

```bash
# Prerequisites: Bun >= 1.3 (https://bun.com/docs/installation), Node >= 18
git clone https://github.com/alaarab/ogrid.git
cd ogrid
bun install
bun run build          # build all packages once (required before docs/dev work)
```

Useful commands:

```bash
bun run test                  # all unit tests (bun:test)
bun run lint                  # Biome
bun run typecheck             # tsc across all packages
bun run test:e2e:smoke        # browser merge gate (React Radix)
bun run docs:dev:full         # build workspace packages + start the docs site
bun run storybook:react-radix # component workbench (also :react-fluent)
```

> The docs site and example apps resolve `@alaarab/ogrid-*` imports to each package's `dist/esm` build — if you see "Module not found", run `bun run build` first.

## Project conventions

- **TypeScript strict, ESM-first, headless architecture.** Framework-agnostic logic lives in `packages/core` (zero dependencies); React hooks and headless components in `packages/react`; the UI kits (`react-radix`, `react-fluent`) are thin visual layers.
- **UI parity rule:** if your change affects UI, update **both** `packages/react-radix` and `packages/react-fluent`. The export-parity test enforces identical public APIs.
- **Tests are behavioral**, written with `bun:test` (Jest-compatible globals are preloaded via `bun-test.setup.ts`). Use the shared test factories in `packages/react/src/testing` so both UI packages get coverage from one suite.
- **No `any`, no `@ts-ignore`.** The codebase currently has zero of both — please keep it that way.
- Match the style of surrounding code; Biome runs on staged files via the pre-commit hook.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture documentation.

## Submitting a change

1. Fork the repository and create a feature branch.
2. Make your changes following the conventions above.
3. Add or extend tests for anything with runtime behavior.
4. Update `CHANGELOG.md` under `## [Unreleased]` if the change is user-visible.
5. Run the full verification suite:

   ```bash
   bun run build && bun run test && bun run lint && bun run test:e2e:smoke
   ```

6. Open a pull request with a clear description of what changed and why.

CI runs lint, typecheck, unit tests, a full build with bundle-size budgets, and a browser smoke suite on every PR — all of these must be green to merge.

## Reporting bugs and requesting features

Use the issue templates — they ask for the details (versions, reproduction, expected vs actual) that make issues actionable. For security vulnerabilities, see [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## Releasing (maintainers)

See [RELEASING.md](./RELEASING.md). All 9 published packages version in lockstep via the Publish Packages workflow.
