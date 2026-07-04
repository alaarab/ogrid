# OGrid — Improvement Plan

Audit date: 2026-07-04. Scope: full-repo review of code health, CI, tests, docs, and security.

## Where the repo stands

The most mature repo in the portfolio: headless-core architecture across 11 packages, 124 unit test files + Storybook + 7 Playwright e2e suites, size-limit bundle gates, SHA-pinned deps via `overrides`, zero `any` in source, zero TODOs, and best-in-class docs (Docusaurus site, 92 KB maintained CHANGELOG). Improvements here are about locking in the quality bar and closing CI blind spots, not fixing debt.

## P0 — CI reproducibility & coverage gaps

1. **Pin the Bun version in CI.** `ci.yml` uses `bun-version: latest` while `package.json` declares `packageManager: bun@1.3.13`. A Bun release can break CI (or worse, pass CI with behavior users on older Bun don't get). Pin CI to the `packageManager` version (AlphaLens already pins `1.3.14` — same pattern).
2. **Run the cross-browser Playwright matrix automatically.** `playwright-matrix.yml` is `workflow_dispatch`-only, so Firefox/WebKit regressions can land on `main` between manual runs. Add a weekly `schedule:` cron and trigger it on release branches/tags at minimum.

## P1 — Lock in the quality bar

3. **Promote Biome warns to errors.** The codebase is already clean, so this is nearly free: `noExplicitAny`, `noNonNullAssertion`, `noUnusedVariables`, `noUnusedImports`, `noUnusedPrivateClassMembers`, `useExhaustiveDependencies` are all `warn`. Flip to `error` so regressions fail CI instead of scrolling by.
4. **Re-enable a11y linting.** `a11y.recommended: false` in `biome.json` while the README markets accessibility and jest-axe runs in tests. Turn the rule group back on (start with `warn`, triage, then `error`); static lint catches what axe-in-tests misses in untested branches.
5. **Enable the Biome formatter** (`formatter.enabled: false` today) and land a one-time format commit.

## P2 — Decomposition targets (opportunistic)

Refactor when next touched, with tests already in place:

- `packages/react/src/components/BaseDataGridTable.tsx` (883 lines) — split header/body/selection concerns.
- `packages/mcp/src/server.ts` (847) — extract tool registrations into per-domain modules (the phren repo's `tools/` layout is a good model).
- `packages/react/src/hooks/useOGrid.ts` (636) and `useDataGridTableOrchestration.ts` (585) — extract feature-specific sub-hooks.
- `packages/core/src/formula/functions/reference.ts` (594) — group by function family.

## Quick wins (one sitting)

- Pin `bun-version` in `ci.yml`.
- Add `schedule:` to `playwright-matrix.yml`.
- Flip the six warn-level Biome rules to `error` (expect near-zero fixes needed).

## Verification

- CI green after the Bun pin and Biome promotion.
- Scheduled matrix run completes across all browsers; check the first cron run's artifacts.
- `bun run build && bun run size` — size-limit gates still pass after any refactors.
