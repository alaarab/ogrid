# /testing — Testing How-To

Reference for writing and running tests in OGrid.

## Where Tests Live

- Core: `packages/core/src/*/__tests__/**/*.test.ts`
- React: `packages/react/src/__tests__/**/*.test.ts(x)`
- UI packages: `packages/react-{radix,fluent,material}/src/__tests__/**/*.test.ts(x)`
- Angular: `packages/angular*/src/__tests__/**/*.test.ts`
- Vue: `packages/vue*/src/__tests__/**/*.test.ts`
- JS: `packages/js/src/__tests__/**/*.test.ts`

## Test Factories (shared across UI packages)

Each framework has 8 factories for feature parity:
1. `createOGridTests` — top-level OGrid
2. `createDataGridTableTests` — DataGridTable
3. `createSpreadsheetTests` — cell selection (drag, shift-click, bounds)
4. `createColumnHeaderFilterTests` — filtering UI
5. `createColumnChooserTests` — column visibility
6. `createPaginationControlsTests` — pagination
7. `createColumnGroupTests` — grouped headers
8. `createSideBarTests` — sidebar panels

When adding features: add to the relevant factory first, then UI package tests are thin wrappers.

## Running Tests

```bash
npm run test:all        # All 14 packages
npm run test:core       # Core only
npm run test:react      # React hooks + all 3 React UI packages
npm run test:radix      # React Radix only
npm run test:fluent     # React Fluent only
npm run test:material   # React Material only
```

## Edge-Case Priorities

When improving coverage, prioritize:
- **Cell selection**: constrain to grid bounds, pinned columns, select-all
- **Keyboard navigation**: arrows/Tab/Home/End at edges, Ctrl+Arrow, PageDown/PageUp
- **Clipboard**: null/undefined/mixed types, date formatting, formula strings
- **Undo/redo**: stack limits (maxUndoDepth=100), batch operations, formula cells

## Known Pitfalls

- **Fake timers + async**: `jest.useFakeTimers()` deadlocks `waitFor`/`findByText`. Use real timers:
  ```ts
  await act(async () => { await new Promise(r => setTimeout(r, 350)); });
  ```
- **Destructuring defaults in hooks**: `const { values = [] } = params` creates new array ref each render → infinite loop. Use `const safe = values ?? STABLE_EMPTY`.
- **Material popover gating**: don't gate `open` on `!!popoverPosition` — position set via `setTimeout(0)` blocks sync tests.
- **Vue lifecycle warnings**: `onUnmounted` warns outside `setup()` in tests — harmless, tests still pass.
- **Angular factory helpers**: use `getService()` helper that handles both `ogridService` (Material/Radix) and `service` (PrimeNG) prop names.
