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

## Publish whenever you want

1. Go to the repo on GitHub → **Actions** tab.
2. Select the **“Publish Packages”** workflow on the left.
3. Click **Run workflow**.
4. Enter the new **version** (e.g. `2.16.0`). Leave **Dry run** unchecked.
5. Click **Run workflow**.

That's it. The workflow will:

1. **verify** — confirm all package versions are in sync, then build, test, and lint.
2. **publish** — bump every package to the version you entered (via
   `scripts/version-bump.mjs`), publish all 9 packages with provenance, then
   commit the bump, tag `vX.Y.Z`, and push to `main`.

### Tips

- **Test first without publishing:** run it once with **Dry run** checked. It
  builds and validates but skips the actual `npm publish` and the version bump.
- **Versioning:** follow semver — patch (`2.15.1`) for fixes, minor (`2.16.0`)
  for new features, major (`3.0.0`) for breaking changes.
- **Don't bump versions by hand** — the workflow does it for you and keeps all
  packages + their cross-dependencies in sync.
- **If a publish fails partway through:** npm versions are immutable, so just
  re-run with the *same* version — already-published packages will be skipped
  with an "cannot publish over existing version" error, and the rest go through.
  (Or bump to the next patch and re-run cleanly.)

## Verify it worked

```bash
npm view @alaarab/ogrid-core version   # should show the version you published
```

Published packages: `@alaarab/ogrid-core`, `-inputs`, `-react`, `-react-radix`,
`-react-fluent`, `-react-inputs`, `-react-xlsx`, `-react-xlsx-browser`, `-mcp`.
