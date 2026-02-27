# /done — Definition of Done Checker

Run this before EVERY commit that contains a user-visible change. Go through each item below, run the necessary commands, and output a ✅ / ❌ / ⚠️ report for each item.

## Checklist

### 1. Code — All Frameworks Updated
Check `git diff --stat HEAD` to confirm changes span all relevant framework packages.
- If the feature is UI-only: React (Radix, Fluent, Material) + Angular (Material, PrimeNG, Radix) + Vue (Vuetify, PrimeVue, Radix) + JS
- If the feature is headless/core: core package + all framework base packages
- ✅ if all relevant packages were touched | ❌ if any are missing parity

### 2. Tests — All Passing
Run: `npm run test:all`
- ✅ if 0 failures, 0 errors | ❌ otherwise
- Note the final test count in the report

### 3. Build — All 15 Packages
Run: `npm run build`
- ✅ if 15/15 packages built with 0 errors | ❌ otherwise

### 4. Lint — 0 Errors, 0 Warnings
Run: `npm run lint`
- ✅ if clean | ❌ otherwise

### 5. Storybook — Stories Updated (if visual UI changed)
Check if new/changed components have stories in `packages/react-{radix,fluent,material}/src/stories/`.
- ✅ if no visual UI changes, OR if stories were added/updated
- ⚠️ if visual UI changed but no story update

### 6. Feature Docs — Updated (if new or changed feature)
Check `packages/docs/docs/features/` for the relevant `.mdx` page.
- ✅ if no new feature, OR if docs page has all 4 framework tabs (React, Angular, Vue, JS)
- ❌ if feature page is missing or lacks a framework tab

### 7. CHANGELOG — [Unreleased] Entry Added
Run: `git diff HEAD -- CHANGELOG.md`
- ✅ if CHANGELOG.md has new lines under `[Unreleased]` covering this change
- ❌ if CHANGELOG.md was not updated (every user-visible change needs an entry)
- Format: `### Added` / `### Changed` / `### Fixed` with framework scope

### 8. MEMORY.md — Updated
Check `~/.claude/projects/-home-alaarab-ogrid/memory/MEMORY.md`:
- ✅ if test count was updated and any new patterns/decisions were recorded
- ⚠️ if this was a minor fix (skip)

### 9. No Unnecessary Duplication
Review the diff: did state logic stay in core/base packages?
- ✅ if no logic was duplicated across UI packages
- ❌ if the same pattern was implemented separately in 2+ UI packages without a shared factory

## Output Format

```
## /done Report — [brief description of what was just implemented]

1. Code (all frameworks)   ✅ React×3, Angular×3, Vue×3, JS all updated
2. Tests                   ✅ 3,834 tests passing (0 failures)
3. Build                   ✅ 15/15 packages, 0 errors
4. Lint                    ✅ 0 errors, 0 warnings
5. Storybook               ✅ No visual UI changes
6. Feature docs            ✅ features/formulas.mdx updated with 4 tabs
7. Changelog               ✅ [Unreleased] Added entry for formula bar fix
8. Memory                  ✅ Test count updated in MEMORY.md
9. No duplication          ✅ Logic in core, UI packages are thin wrappers

RESULT: ✅ ALL CHECKS PASSED — ready to commit
```

Or if something is missing:
```
RESULT: ❌ 2 ITEMS NEED ATTENTION before committing
  - #6 Feature docs: missing Angular tab in features/formulas.mdx
  - #7 Changelog: no [Unreleased] entry for this change
```
