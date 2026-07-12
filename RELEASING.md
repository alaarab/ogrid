# Releasing ogrid to npm

All 9 `@alaarab/ogrid-*` packages are published together, in lockstep, at a
single shared version. Publishing runs entirely in GitHub Actions — you never
need an npm token on your own machine.

## One-time setup (already done)

- A repo secret named **`NPM_TOKEN`** holds an npm **Automation** token
  (Settings → Secrets and variables → Actions).
- The publish workflow has `id-token: write` and `provenance=true`, so every
  package is published with a signed [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
  attestation linking it back to this repo + commit.

## Pre-publish checklist

Run the full verification set from the repository root:

```bash
bun run build
bun run test
bun run lint
bun run test:e2e:smoke
bun run test:e2e:docs
```

For the broader browser pass before a publish: `bun run test:e2e:matrix`.
For GitHub-side confirmation, manually run the `Full Verification` and
`Playwright Matrix` workflows against `main`.

Confirm all 11 workspace packages share one version:

```bash
grep '"version"' package.json packages/*/package.json | cut -d'"' -f4 | sort -u
```

Before publishing, make sure the `## [Unreleased]` section of `CHANGELOG.md`
describes the release (the publish workflow cuts it into a version heading
automatically), and update `README.md`/docs pages if public behavior changed.
Docs changes should be built before publishing so the MCP bundled docs stay
current.

## Publish whenever you want

1. Go to the repo on GitHub → **Actions** tab.
2. Select the **“Publish Packages”** workflow on the left.
3. Click **Run workflow**.
4. Enter the new **version** (e.g. `2.16.0`). Leave **Dry run** unchecked.
5. Click **Run workflow**.

That's it. The workflow will:

1. **verify** — confirm all package versions are in sync, then build, test, and lint.
2. **publish** — bump every package to the version you entered and cut the
   CHANGELOG `[Unreleased]` section (via `scripts/version-bump.mjs`), publish
   all 9 packages with provenance (via `scripts/publish-all.mjs`), then commit
   the bump, tag `vX.Y.Z`, and push to `main`.

### Tips

- **Test first without publishing:** run it once with **Dry run** checked. It
  builds and validates but skips the actual `npm publish` and the version bump.
- **Versioning:** follow semver — patch (`2.15.1`) for fixes, minor (`2.16.0`)
  for new features, major (`3.0.0`) for breaking changes.
- **Don't bump versions by hand** — the workflow does it for you and keeps all
  packages + their cross-dependencies in sync.
- **If a publish fails partway through:** re-run with the *same* version. The
  publisher checks the registry first and skips packages already published at
  that version, so only the remainder is published.

## Verify it worked

```bash
npm view @alaarab/ogrid-core version   # should show the version you published
```

Also confirm the `vX.Y.Z` tag exists on GitHub and the docs site still deploys.

Published packages: `@alaarab/ogrid-core`, `-inputs`, `-react`, `-react-radix`,
`-react-fluent`, `-react-inputs`, `-react-xlsx`, `-react-xlsx-browser`, `-mcp`.
