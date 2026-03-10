# Release Process

This is the release path for OGrid. Use it as the pre-publish checklist and rehearsal sequence.

## 1. Confirm the repo is ready

Run the full verification set from the repository root:

```bash
npm run build
npm run test:all
npm run lint
npm run test:e2e:smoke
npm run test:e2e:docs
```

If you need the broader browser pass before a publish, run:

```bash
npm run test:e2e:matrix
```

## 2. Confirm versions are in sync

All 22 packages must share one version:

```bash
grep '"version"' package.json packages/*/package.json | cut -d'"' -f4 | sort -u
```

If the version needs to change, use the workspace-safe bump command instead of manual edits:

```bash
npm run version:bump -- 2.6.2
```

## 3. Update release notes

Before publishing:

- Add the new version entry to `CHANGELOG.md`
- Update `README.md` or docs pages if public behavior, coverage, or package support changed
- Make sure docs changes are built before publishing so the MCP bundled docs stay current

## 4. Rehearse the publish path

Dry-run the GitHub publish workflow before the real publish:

1. Open the `Publish Packages` GitHub Actions workflow.
2. Enter the target version.
3. Set `dry-run` to `true`.
4. Confirm the verify job passes and the workflow reaches the dry-run publish step.

This checks the release pipeline without touching npm or tagging the repo.

## 5. Publish

When the dry run is clean:

1. Re-run the `Publish Packages` workflow.
2. Enter the same target version.
3. Set `dry-run` to `false`.
4. Confirm the workflow publishes packages, commits the version bump, creates the git tag, and pushes `main`.

## 6. Post-publish checks

After the workflow completes:

- Verify the tag exists on GitHub
- Verify the expected packages are visible on npm
- Confirm the docs site still deploys cleanly
- Check `git status` locally before starting the next round of work
