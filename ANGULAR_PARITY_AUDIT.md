# Angular Parity Audit

**Date:** 2026-02-12
**Auditor:** Claude (Opus 4.6)
**Scope:** Angular packages vs React reference implementations
**Method:** Read-only source analysis, no code changes

---

## Summary Table

| Package | React Reference | Completeness | P0 | P1 | P2 | Tests |
|---------|----------------|:---:|:---:|:---:|:---:|:---:|
| `@alaarab/ogrid-angular` | `@alaarab/ogrid-react` | ~90% | 1 | 3 | 2 | 4 files |
| `@alaarab/ogrid-angular-material` | `@alaarab/ogrid-react-material` | ~85% | 1 | 3 | 2 | 1 file (exports only) |
| `@alaarab/ogrid-angular-primeng` | `@alaarab/ogrid-react-fluent` | ~80% | 2 | 2 | 3 | 1 file (exports only) |
| `@alaarab/ogrid-angular-radix` | `@alaarab/ogrid-react-radix` | ~75% | 3 | 2 | 2 | 1 file (exports only) |

**React Radix test count for comparison: 8 test files, 92 tests.**

---

## Findings by Severity

### P0 -- Critical (Functional Gaps)

#### P0-1: DataGridStateService missing `pinning` sub-object

**Angular:** `packages/angular/src/services/datagrid-state.service.ts:135-142`
- `DataGridStateResult<T>` has 6 sub-objects: `layout`, `rowSelection`, `editing`, `interaction`, `contextMenu`, `viewModels`.

**React:** `packages/react/src/hooks/useDataGridState.ts:183-191`
- `UseDataGridStateResult<T>` has 7 sub-objects: the same 6, plus `pinning: DataGridPinningState`.

The React `DataGridPinningState` (lines 150-180 in `useDataGridState.ts`) includes:
- `pinnedColumns`, `pinColumn`, `unpinColumn`, `isPinned`
- `computeLeftOffsets`, `computeRightOffsets`
- `headerMenu` sub-object with: `isOpen`, `openForColumn`, `anchorElement`, `open`, `close`, `handlePinLeft`, `handlePinRight`, `handleUnpin`, `canPinLeft`, `canPinRight`, `canUnpin`

In Angular, pinning methods exist on `OGridService` (lines 600-671) and `BaseDataGridTableComponent` (lines 358-382), but they are NOT grouped into the `DataGridStateService.getState()` result. This means:
- UI packages must implement pinning state management themselves (and they do, inconsistently).
- The `headerMenu` state (which column's menu is open, anchor element) has no centralized service, so each UI package implements its own version.

**Impact:** Column pinning works partially because each UI package duplicates the logic, but the architecture diverges from React's centralized approach. Angular Material and PrimeNG each have a `ColumnHeaderMenuComponent`, while Radix has none at all.

---

#### P0-2: Angular PrimeNG DataGridTable does NOT extend BaseDataGridTableComponent

**File:** `packages/angular-primeng/src/datagrid-table/datagrid-table.component.ts` (769 lines)

The PrimeNG DataGridTableComponent is a completely standalone implementation that does not extend `BaseDataGridTableComponent`. It:
- Creates its own `DataGridStateService`, `ColumnReorderService`, `VirtualScrollService` (lines 1-50)
- Duplicates all helper methods from BaseDataGridTableComponent:
  - `getColumnWidth()` (line 538) -- differs in signature and behavior (returns `number | undefined` vs `number`)
  - `getFilterConfig()` (line 544)
  - `resolveCellDisplay()` (line 553)
  - `getCellStyleObj()` (line 558)
  - `canEditCell()` (line 562)
  - `isEditingCell()` (line 567)
  - `getEditorType()` (line 573)
  - `isActiveCell()` (line 582)
  - `isInSelectionRange()` (line 588)
  - `isSelectionEndCell()` (line 598)
  - `getCellBackground()` (line 605)
  - `onResizeStart()` (line 667) -- uses different column sizing format (`number` vs `{ widthPx: number }`)
  - `isPinned()` (line 709)
  - `getPinState()` (line 713)
- Has a `buildProps()` method (line 722) to construct `IOGridDataGridProps<T>` from individual inputs, rather than accepting a single `props` input like the base class expects.
- Has ~50+ inline style attributes throughout the template.

**Impact:** Any fix or feature added to `BaseDataGridTableComponent` will NOT be reflected in PrimeNG. The two implementations will drift further apart. Column sizing formats already differ: PrimeNG uses `Record<string, number>` internally (line 677) while the base class uses `Record<string, { widthPx: number }>`.

---

#### P0-3: Angular Radix missing `people` filter type in ColumnHeaderFilter

**File:** `packages/angular-radix/src/column-header-filter/column-header-filter.component.ts`

The template (lines 90-184) has `@switch (filterType())` with three cases:
- `@case ('text')` -- line 91
- `@case ('multiSelect')` -- line 110
- `@case ('date')` -- line 156

There is NO `@case ('people')` block. The component accepts `peopleSearch`, `selectedUser`, and `onUserChange` as inputs (lines 374-376) but never renders a people filter UI.

**Angular Material** has `@case ('people')` -- line 156 of `column-header-filter.component.ts`.
**Angular PrimeNG** has `@if (filterType() === 'people')` -- line 124 of `column-header-filter.component.ts`.

**Impact:** Columns with `filterType: 'people'` will show no filter UI in Angular Radix. The filter button renders, but clicking it shows an empty popover.

---

#### P0-4: Angular Radix missing ColumnHeaderMenu (no pin/unpin via UI)

**File:** `packages/angular-radix/src/datagrid-table/datagrid-table.component.ts`

The Radix DataGridTable template has no `<column-header-menu>` component and no import for one. There is no component at `packages/angular-radix/src/column-header-menu/`.

Both Angular Material (line 96 in `column-header-menu.component.ts`) and Angular PrimeNG (line 115 in `column-header-menu.component.ts`) have `ColumnHeaderMenuComponent` with pin/unpin actions.

The `BaseDataGridTableComponent` has `onPinColumn`, `onUnpinColumn`, `isPinned`, `getPinState` methods (lines 358-382), but Angular Radix never calls them from the template because there is no header menu trigger.

**Impact:** Users cannot pin or unpin columns through the UI in Angular Radix. Programmatic pinning via `col.pinned` still works, but interactive pinning is broken.

---

#### P0-5: Angular Radix missing row numbers column in template

**File:** `packages/angular-radix/src/datagrid-table/datagrid-table.component.ts`

The template (lines 52-119 for thead, lines 121-237 for tbody) has no rendering for row numbers. Specifically:
- No `@if (hasRowNumbersCol())` block in `<thead>` (contrast with PrimeNG lines 103-114)
- No row number `<td>` in `<tbody>` rows (contrast with PrimeNG which renders `{{ rowNumberOffset() + rowIndex + 1 }}`)

The `BaseDataGridTableComponent` exposes `hasRowNumbersCol()` (line 73) and `rowNumberOffset()` (line 68), but Radix never uses them.

**Impact:** Setting `showRowNumbers: true` has no visible effect in Angular Radix. The `hasRowNumbersCol` state is correctly computed but never rendered.

---

#### P0-6: Angular Radix and PrimeNG have effectively 0 functional tests

**Angular Radix:** 1 test file at `packages/angular-radix/src/__tests__/exports.test.ts` -- verifies exports only.
**Angular PrimeNG:** 1 test file at `packages/angular-primeng/src/__tests__/exports.test.ts` -- verifies exports only.
**Angular Material:** 1 test file at `packages/angular-material/src/__tests__/exports.test.ts` -- verifies exports only.

**React Radix for comparison:** 8 test files covering ColumnChooser, ColumnHeaderFilter, DataGridTable (base + column groups + spreadsheet), OGrid (base + sidebar), PaginationControls. Total: 92 tests.

**Impact:** No regression protection for any Angular UI package rendering, interaction, or integration.

---

### P1 -- Important (Architecture/Quality Issues)

#### P1-1: Angular Material and PrimeNG ColumnHeaderMenu use legacy decorators

**Files:**
- `packages/angular-material/src/column-header-menu/column-header-menu.component.ts:1,65-75`
- `packages/angular-primeng/src/column-header-menu/column-header-menu.component.ts:1,47-66`

Both use:
```typescript
@Input() columnId!: string;
@Output() pinLeft = new EventEmitter<void>();
@ViewChild(MatMenuTrigger) menuTrigger?: MatMenuTrigger;
```

All other Angular components in the codebase use the modern signals API:
```typescript
readonly columnId = input.required<string>();
```

Additionally, PrimeNG ColumnHeaderMenu (line 49-60) uses setter-based `@Input()` with private backing fields for `canPinLeft`, `canPinRight`, `canUnpin` -- this pattern is replaced by `input()` + `computed()` in Angular 21.

**Impact:** Code inconsistency. Legacy decorators still work but will be deprecated. Any automated migration or linting for signals will miss these components.

---

#### P1-2: PrimeNG ColumnHeaderMenu uses function-type @Input instead of @Output

**File:** `packages/angular-primeng/src/datagrid-table/datagrid-table.component.ts:160-168`

The PrimeNG DataGridTable passes pin handlers as function inputs:
```html
<column-header-menu
  [onPinLeft]="() => onPinColumn(cell.columnDef!.columnId, 'left')"
  [onPinRight]="() => onPinColumn(cell.columnDef!.columnId, 'right')"
  [onUnpin]="() => onUnpinColumn(cell.columnDef!.columnId)"
```

But the PrimeNG ColumnHeaderMenuComponent defines `@Output() pinLeft = new EventEmitter<void>()` (line 62-64). The `onPinLeft`/`onPinRight`/`onUnpin` are not declared as inputs. This means the template bindings `[onPinLeft]` are setting undeclared properties -- they will silently do nothing in strict mode.

**Angular Material** correctly uses output event bindings:
```html
(pinLeft)="onPinColumn(col.columnId, 'left')"
```

**Impact:** Column pinning via the header menu may be silently broken in PrimeNG. The `@Output` events are defined but never triggered because the parent binds to undeclared `@Input` properties instead.

---

#### P1-3: `density` prop missing from entire Angular stack

**React:** `useOGrid.ts` line 141 -- `density = 'normal'` with options `'compact' | 'normal' | 'comfortable'`.
**React:** `useDataGridState.ts` -- `density` does not appear in DataGridState (it's passed through to the UI layer).

**Angular:** No mention of `density` anywhere in:
- `packages/angular/src/services/ogrid.service.ts`
- `packages/angular/src/types/dataGridTypes.ts`
- Any UI package

**Impact:** Angular packages have no density support. Users cannot control row height/padding via a `density` prop. This is a feature gap versus React.

---

#### P1-4: Angular Material DataGridTable not passing `getUserByEmail` to ColumnHeaderFilter

**File:** `packages/angular-material/src/datagrid-table/datagrid-table.component.ts`

The `IOGridDataGridProps` type includes `getUserByEmail` (line 159 of `dataGridTypes.ts`), and `OGridService` populates it (line 332 of `ogrid.service.ts`). However, Angular Material's DataGridTable template does not pass `getUserByEmail` to the ColumnHeaderFilter component.

PrimeNG passes it at line 762 in its DataGridTable.

**Impact:** People filters that need to resolve users by email (for pre-populating filter values) will not work in Angular Material.

---

#### P1-5: Angular Radix DataGridTable template does not use `columnLayouts()` for header columns

**File:** `packages/angular-radix/src/datagrid-table/datagrid-table.component.ts:71-116`

The header section iterates over `headerRows()` and manually computes pinning classes:
```html
[class.ogrid-datagrid-th--pinned-left]="col.pinned === 'left' || (isFreezeCol && colIdx === 0)"
```

This only checks `col.pinned` (the static column definition), NOT runtime pinning via `props.pinnedColumns`. The body section correctly uses `columnLayouts()` (line 148) which incorporates runtime pinning. This means:
- Programmatic `onColumnPinned` calls update body cells but NOT headers.
- Headers show pinning only from initial `col.pinned` definitions.

**Impact:** Runtime column pinning shows inconsistent styling between headers and body cells.

---

### P2 -- Nice to Have (Minor Issues)

#### P2-1: PrimeNG massive inline styles

**File:** `packages/angular-primeng/src/datagrid-table/datagrid-table.component.ts`

The template contains 50+ inline `style="..."` attributes, e.g.:
- Line 71: `style="flex:1;min-height:0;overflow:auto;outline:none;position:relative;font-size:13px;color:var(--ogrid-fg, #242424)"`
- Line 80: `style="width:var(--data-table-width, 100%);min-width:var(--data-table-min-width, 100%);border-collapse:collapse;table-layout:fixed"`
- Line 82: `style="position:sticky;top:0;z-index:3;background:var(--ogrid-header-bg, #f5f5f5)"`

Angular Radix moved all styles to an external SCSS file (`datagrid-table.component.scss`, 301 lines). Angular Material uses a mix of inline styles and a `styles` block. PrimeNG uses almost exclusively inline styles.

**Impact:** Styles cannot be overridden by consumers via CSS specificity. Makes maintenance and theming harder.

---

#### P2-2: Angular core missing headless state composables

React exports standalone headless state hooks that UI packages can use:
- `useColumnHeaderFilterState` (filter popover state management)
- `useColumnChooserState` (column visibility dropdown state)
- `useInlineCellEditorState` (inline editor lifecycle)
- `useRichSelectState` (searchable dropdown state)
- `useSideBarState` (sidebar panel management)

Angular has no equivalent standalone services for these. Each UI package implements this state inline in its component class:
- ColumnHeaderFilter: filter open/close state, temp values, apply/clear logic duplicated across all 3 UI packages.
- ColumnChooser: search state, visibility toggling duplicated across all 3 UI packages.

**Impact:** Logic duplication across Angular UI packages. Adding a new Angular UI package requires re-implementing all this state logic.

---

#### P2-3: PrimeNG column sizing format inconsistency

**File:** `packages/angular-primeng/src/datagrid-table/datagrid-table.component.ts`

PrimeNG uses `Record<string, number>` for column sizing overrides (signal at line 478-ish, accessed at line 677):
```typescript
this.columnSizingOverrides.update((prev) => ({ ...prev, [this.resizeColumnId]: newWidth }));
```

BaseDataGridTableComponent and DataGridStateService use `Record<string, { widthPx: number }>`:
```typescript
this.state().layout.setColumnSizingOverrides(overrides);
```

PrimeNG converts between formats only in `onUp` (lines 687-691), but during resize dragging the two systems are out of sync.

**Impact:** Minor visual glitch possible during column resize dragging in PrimeNG.

---

#### P2-4: ColumnHeaderFilter popover positioning approach inconsistency

Each Angular UI package positions filter popovers differently:
- **Angular Material:** Uses Angular Material's `MatMenu`/`cdkOverlay` for positioning (framework-managed).
- **Angular PrimeNG:** Uses `position:absolute;top:100%;left:0` (static CSS positioning).
- **Angular Radix:** Uses manual `getBoundingClientRect()` + `position:fixed` (lines 436-441 in `column-header-filter.component.ts`).

React packages all delegate to their respective framework popover APIs (Radix Popover, Fluent Popover, MUI Popover).

**Impact:** Angular Radix's manual positioning may break with scroll containers or viewport edge cases. PrimeNG's absolute positioning depends on the header cell having `position:relative`.

---

#### P2-5: Angular Radix ColumnHeaderFilter click-outside uses host listener with selector matching

**File:** `packages/angular-radix/src/column-header-filter/column-header-filter.component.ts:358,446-451`

```typescript
host: { '(document:click)': 'onDocumentClick($event)' },
// ...
onDocumentClick(event: MouseEvent): void {
  const el = event.target as HTMLElement;
  if (!el.closest('column-header-filter')) {
    this.isFilterOpen.set(false);
  }
}
```

This uses `el.closest('column-header-filter')` which matches the custom element tag name. This is brittle -- it will break if the selector is renamed, and it closes ALL open filters on any outside click (not just the one that was open).

**Impact:** Minor robustness concern. Could cause issues with multiple filter popovers.

---

#### P2-6: Angular Material DataGridTable has ~480 lines of inline styles

**File:** `packages/angular-material/src/datagrid-table/datagrid-table.component.ts`

The `styles` block in the `@Component` decorator contains ~480 lines of CSS. While this is better than PrimeNG's 50+ scattered inline style attributes (it's in one place), it makes the component file very large (509 lines total).

Angular Radix properly extracts styles to `datagrid-table.component.scss`.

**Impact:** Large component files are harder to maintain. Extracting to a separate file would improve readability.

---

## Component Parity Matrix

| Component | React Radix | Angular Material | Angular PrimeNG | Angular Radix |
|-----------|:-----------:|:----------------:|:---------------:|:-------------:|
| OGrid (top-level) | Yes | Yes | Yes | Yes |
| DataGridTable | Yes | Yes (extends Base) | Yes (standalone) | Yes (extends Base) |
| ColumnHeaderFilter | Yes (4 types) | Yes (4 types) | Yes (4 types) | **Missing people** |
| ColumnChooser | Yes | Yes | Yes | Yes |
| PaginationControls | Yes | Yes | Yes | Yes |
| ColumnHeaderMenu | Yes | Yes | Yes (binding bug) | **Missing** |
| InlineCellEditor | Yes (in template) | Yes (in template) | Yes (separate component) | Yes (in template) |
| StatusBar | Yes | Yes | Yes | Yes |
| GridContextMenu | Yes | Yes | Yes | Yes |
| MarchingAntsOverlay | Yes | Yes | Yes | Yes |
| EmptyState | Yes | Yes | Yes | Yes |
| SideBar | Yes | Yes | Yes | Yes |
| Row Numbers | Yes | Yes | Yes | **Missing** |

## Service/Hook Parity

| Service/Hook | React | Angular | Notes |
|-------------|:-----:|:-------:|-------|
| useOGrid / OGridService | Yes | Yes | Angular missing `density` prop |
| useDataGridState / DataGridStateService | Yes (7 groups) | Yes (6 groups) | Angular missing `pinning` sub-object |
| useColumnPinning | Yes (standalone) | Inlined in OGridService | Functional but not standalone |
| useColumnHeaderMenuState | Yes (standalone) | **Missing** | Each UI package rolls its own |
| useColumnReorder / ColumnReorderService | Yes | Yes | Parity |
| useVirtualScroll / VirtualScrollService | Yes | Yes | Parity |
| useColumnHeaderFilterState | Yes (standalone) | **Missing** | Logic duplicated in each UI package |
| useColumnChooserState | Yes (standalone) | **Missing** | Logic duplicated in each UI package |
| useInlineCellEditorState | Yes (standalone) | **Missing** | Logic inlined in templates |
| useRichSelectState | Yes (standalone) | **Missing** | Not implemented |
| useSideBarState | Yes (standalone) | **Missing** | Logic inlined in SideBarComponent |

## Recommendations (Priority Order)

1. **P0-2:** Refactor PrimeNG DataGridTable to extend `BaseDataGridTableComponent`. This is the single highest-impact change -- it eliminates ~400 lines of duplicated logic and ensures future features propagate automatically.

2. **P0-1:** Add `pinning` sub-object to `DataGridStateService.getState()`. Create a centralized `useColumnHeaderMenuState` equivalent service. Wire it into `BaseDataGridTableComponent`.

3. **P0-3/4/5:** Angular Radix is missing 3 features vs React Radix: people filter, column header menu, row numbers. Each is a self-contained template addition.

4. **P0-6:** Add functional tests for all 3 Angular UI packages. Target: 90 tests each, mirroring React Radix's test structure.

5. **P1-1/2:** Migrate ColumnHeaderMenu components to signals API. Fix PrimeNG's broken `@Input` bindings for pin functions.

6. **P1-3:** Add `density` prop support across the Angular stack.

7. **P2-1/6:** Extract PrimeNG inline styles to external SCSS. Consider extracting Angular Material styles similarly.

8. **P2-2:** Create shared Angular headless state services for filter popover, column chooser, and inline editor state to reduce duplication across UI packages.
