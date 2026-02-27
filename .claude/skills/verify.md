# /verify — Pre-Commit Verification Gate

Run this before ANY `git commit`. Checks version sync, builds all packages, runs all tests, runs lint. Report ✅ ALL CHECKS PASSED or ❌ ISSUES FOUND.

## Steps (run in order, stop and report failures)

### 1. Version Synchronization
```bash
grep '"version"' package.json
grep -r '"version"' packages/*/package.json | grep -v node_modules
```
All 14 packages + root must have identical version numbers.

### 2. Full Build
```bash
npm run build
```
Must complete with zero errors across all 15 packages.

### 3. Full Test Suite
```bash
npm run test:all
```
All tests must pass, zero errors, zero warnings. Note the final count.

### 4. Lint
```bash
npm run lint
```
Must show zero errors, zero warnings.

### 5. Git Status Review
```bash
git status
```
No untracked `.env`, credentials, or temp files.

## Output Format

```
## /verify Report

1. Version sync   ✅ All 14 packages at 2.3.0
2. Build          ✅ 15/15 packages, 0 errors
3. Tests          ✅ 3,834 tests passing
4. Lint           ✅ 0 errors, 0 warnings
5. Git status     ✅ No sensitive files

RESULT: ✅ ALL CHECKS PASSED — safe to commit
```
