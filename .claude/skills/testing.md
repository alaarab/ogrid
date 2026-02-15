# OGrid Testing Skill

Quick reference for how we test and what edge cases to cover when adding or changing tests.

## Usage

```
/testing
```

Use when adding tests, improving coverage, or debugging test failures.

## Test Factories (Parity)

Each framework uses 8 shared factories so all UI packages get the same scenarios:

| Factory | Covers |
|---------|--------|
| `createOGridTests` | Top-level OGrid |
| `createDataGridTableTests` | DataGridTable |
| `createSpreadsheetTests` | Cell selection (drag, shift-click, bounds) |
| `createColumnHeaderFilterTests` | Filtering UI |
| `createColumnChooserTests` | Column visibility |
| `createPaginationControlsTests` | Pagination |
| `createColumnGroupTests` | Grouped headers |
| `createSideBarTests` | Sidebar panels |

When adding a new scenario, add it to the right factory so React, Angular, Vue, and JS all get the test.

## Edge-Case Priorities

When improving coverage, add tests for:

1. **Cell selection**
   - Constrain to grid bounds (drag beyond last row/col, above row 0, left of col 0)
   - Selection spanning pinned + scrollable columns
   - Select-all (Ctrl+A) with column offset, single row/col, zero columns
   - Drag state: isDragging false initially, not set on click-without-move

2. **Keyboard navigation**
   - Arrows at top/bottom/left/right boundaries (constrain to row 0, last row, col 0, last col)
   - Tab wrap at end of row
   - Home / End to first/last column
   - Ctrl+Home / Ctrl+End to (0,0) and last cell

3. **Clipboard**
   - Copy null → empty string (not "null")
   - Copy undefined/missing values
   - Dates: preserve formatting when copying
   - Booleans, mixed null/non-null in range
   - Paste into cells with null values

4. **Undo/redo**
   - Default stack limit (e.g. 100)
   - Redo cleared after new edit
   - Undo paste as one action; undo range delete as one batch

## Where Tests Live

- **Core:** `packages/core/src/*/__tests__/**/*.test.ts`
- **UI / framework:** `packages/*/src/__tests__/**/*.test.ts(x)`
- **React hooks (e.g. useCellSelection):** `packages/react/src/hooks/__tests__/*.test.ts`
- **JS interaction edge cases:** `packages/js/src/__tests__/InteractionEdgeCases.test.ts`

## Pitfalls (see CLAUDE.md for full list)

- Don’t use `jest.useFakeTimers()` with `waitFor`/`findByText` — use real timers for async.
- Don’t use destructuring defaults in hook params that feed `useEffect` deps (e.g. `selectedValues = []`) — use `?? STABLE_EMPTY`.
- MUI Popover: use `open={isFilterOpen && filterType !== 'none'}` not `!!popoverPosition`.
