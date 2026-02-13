# OGrid Release Skill

Automates the full release workflow for OGrid packages.

## Usage

```
/release [patch|minor|major]
```

If no version bump type is provided, prompts the user.

## What it does

1. **Pre-flight checks**
   - Verify git is clean (no uncommitted changes)
   - Check current branch (warn if not main)
   - Verify npm is logged in

2. **Version bump**
   - Ask user for version type (patch/minor/major) if not provided
   - Update version in all 6 package.json files (core, react, react-radix, react-fluent, react-material, js)
   - Show the new version numbers

3. **Quality checks**
   - Run `npm run lint`
   - Run `npm run test:all` (954 tests across 6 packages)
   - Run `npm run build`

4. **Git commit**
   - Create commit with message: "Release vX.Y.Z"
   - Tag with version number: `vX.Y.Z`
   - Push commit and tags to remote

5. **Publish**
   - Run `npm publish --workspace=packages/core --access=public`
   - Run `npm publish --workspace=packages/react --access=public`
   - Run `npm publish --workspace=packages/js --access=public`
   - Run `npm publish --workspace=packages/react-radix --access=public`
   - Run `npm publish --workspace=packages/react-fluent --access=public`
   - Run `npm publish --workspace=packages/react-material --access=public`

6. **Summary**
   - Report success
   - Show npm package URLs for verification

## Packages published

- `@alaarab/ogrid-core` - Pure TypeScript types, algorithms, utilities (zero deps)
- `@alaarab/ogrid-react` - React hooks, headless components, shared test factories
- `@alaarab/ogrid-js` - Vanilla JS data grid (no framework)
- `@alaarab/ogrid-react-radix` - Radix UI implementation (default)
- `@alaarab/ogrid-react-fluent` - Fluent UI implementation
- `@alaarab/ogrid-react-material` - Material UI implementation

## Error handling

- Stops at first error
- Does NOT auto-rollback version bumps or git commits
- User must manually revert if needed
