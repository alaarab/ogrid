# OGrid Architecture

High-level overview of the OGrid monorepo. **9 active packages** on `main`. Frozen variants (Material UI, vanilla JS, Angular, Vue) live on the `legacy/multiframework` branch and at the `v2.9.1-multiframework` tag.

- **Monorepo:** Bun workspaces + Turborepo
- **Build:** TypeScript 6 strict, ESM-only, tree-shakeable
- **Runtime:** Bun 1.3+ for dev/CI; published packages remain plain npm
- **License:** MIT

## Project Structure

```
packages/
  core/                     to  @alaarab/ogrid-core (zero deps)
  react/                    to  @alaarab/ogrid-react (hooks + shared logic)
  react-{radix,fluent}/     to  UI implementations
  inputs/                   to  @alaarab/ogrid-inputs (headless utils: calendar, rating, color, slider, tags)
  react-inputs/             to  Premium React cell editors
  mcp/                      to  @alaarab/ogrid-mcp (docs/runtime bridge)
  docs/                     to  Docusaurus site + demos
  examples/                 to  Vite example apps
```

To revive a frozen variant: `git checkout legacy/multiframework`, copy the package source over.

## Core Concepts

### Headless Architecture

**Core** (`@alaarab/ogrid-core`) is pure TypeScript with zero framework dependencies:
- Types (`IColumnDef<T>`, `IOGridProps`, `IFilters`, etc.)
- Utilities (sort, filter, pagination, cell references, formulas)
- Algorithms (virtual scroll ranges, responsive column hiding, worker sort/filter)

**React adapter** (`@alaarab/ogrid-react`): hooks (`useOGrid`, `useDataGridState`, etc.) + thin view layer.

**UI packages** are the thinnest layer  -  just visual mapping from React state to native components.

### Premium Inputs

5 optional cell editors (`cellEditorPopup: true`) available for React:

1. **DatePickerEditor**  -  Calendar popup with month nav, text input, Today/Clear buttons
2. **RatingEditor**  -  Star rating (1-5, configurable `maxStars`, `allowHalf` support)
3. **ColorPickerEditor**  -  5×4 swatch grid + hex input + contrast detection
4. **SliderEditor**  -  Custom drag slider with step snapping + number input sync
5. **TagsEditor**  -  Multi-chip tags with suggestions dropdown + search

All editors:
- Share headless utilities in `@alaarab/ogrid-inputs` (zero deps)
- Use **inline styles** with OGrid CSS variables (`--ogrid-bg`, `--ogrid-fg`, `--ogrid-border`, `--ogrid-accent`, `--ogrid-shadow`, `--ogrid-muted`, `--ogrid-bg-hover`)
- Are **fully tree-shakeable** with `sideEffects: false`
- Have **zero bundle impact** when not installed
- Support `cellEditorParams` for configuration
- Auto-commit on selection (except slider which has Apply button)
- Support Escape to cancel, Enter/custom key to commit
- Are showcased on docs front page (hero grid has rating/color/tags columns)

### Formula Engine

Custom headless engine in `packages/core/src/formula/` with 93 functions:

**Categories:**
- Math (30): `SUM`, `AVERAGE`, `MIN`, `MAX`, `ABS`, `ROUND`, `CEILING`, `FLOOR`, `POWER`, `SQRT`, etc.
- Text (22): `CONCATENATE`, `UPPER`, `LOWER`, `LEN`, `FIND`, `SUBSTITUTE`, `TRIM`, `MID`, `LEFT`, `RIGHT`, etc.
- Date (14): `TODAY`, `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DATE`, `DATEDIF`, `EDATE`, etc.
- Logical (10): `IF`, `AND`, `OR`, `NOT`, `IFS`, `SWITCH`, etc.
- Stats (6): `STDEV`, `VAR`, `MEDIAN`, `MODE`, `RANK`, `PERCENTILE`
- Info (6): `ISNUMBER`, `ISTEXT`, `ISBLANK`, `ISERROR`, `ISNA`, `TYPEOF`
- Lookup (5): `VLOOKUP`, `INDEX`, `MATCH`, `XLOOKUP`, `FILTER`

**Architecture:** Tokenizer  to  Parser  to  Evaluator with dependency graph (cycle detection). Tree-shakeable via `formulas` prop (only compile used functions).

**Features:** Named ranges, formula auditing (BFS precedents/dependents), cross-sheet references, cell reference formatting, clipboard/fill handle/CSV export awareness.

## Key Commands

```bash
bun install                     # Install deps
bun run build                   # Build all packages (Turborepo)
bun run test                    # Run all 2,768 tests
bun run test:{core,react,radix,fluent,inputs,react-inputs,mcp}  # Package-specific
bun run lint                    # Biome
bun run storybook:{react-fluent,react-radix}    # ports 6006, 6008
bun run docs:dev                # Docusaurus dev (http://localhost:3000)
bun run docs:build              # Build static docs site
```

## Conventions

### Types
- `I` prefix for interfaces: `IColumnDef`, `IDataSource`, `IOGridApi`
- No external state libraries (hooks/signals/composables only)
- TypeScript strict mode everywhere

### Naming
- Component names: PascalCase
- Editor names: `{Name}Editor`
- Hooks: `use*`

### Styles
- Inline (`React.CSSProperties`)
- CSS variables for theming (no dark mode hacks)
- No CSS files in input packages (`sideEffects: false`)

### Testing
- **Runner:** `bun:test` natively across all packages (2,768 tests total)
- **DOM:** happy-dom via `@happy-dom/global-registrator`, bootstrapped in `bun-test.setup.ts` at the repo root
- **React:** `@testing-library/react` + `@testing-library/jest-dom` matchers
- **Source aliasing:** tsconfig `paths` redirect `@alaarab/ogrid-*` to sibling source TS so tests run against source, not compiled `dist/`
- **Jest compat:** the global setup exposes `jest`, `mock`, `spyOn` from `bun:test` so existing test syntax works with no per-file imports

### File Structure per Package
```
src/
  components/         to  Reusable headless components
  hooks/              to  React hooks
  types/              to  TypeScript interfaces
  utils/              to  Utility functions
  workers/            to  Web workers (core only)
  __tests__/          to  Tests co-located with code
tsconfig.json         to  Dev config (includes tests; declares paths for workspace aliasing)
tsconfig.build.json   to  Build config (excludes tests; overrides paths:{} so dist resolves through node_modules)
tsup.config.ts        to  ESM + types bundling
package.json          to  ESM, no CJS, tree-shakeable, peer deps
```

## Architecture Decisions

### Why Headless Core + React Adapter?
- Core algorithm logic stays UI-agnostic and testable in isolation
- React adapter is a thin wrapper that translates core state into hooks
- UI packages are visual mapping only (~1,500 lines each)

### Why Two UI Kits (Radix + Fluent)?
- Users pick their design system
- Same API, different chrome  to  easy migration
- Radix is the lightweight default; Fluent is for Microsoft 365 / SPFx apps

### Why Optional Premium Inputs?
- Keeps base packages lightweight
- Users only pay for what they use (tree-shakeable)
- Inline styles + CSS variables = consistent theming without CSS files

## Performance Features

### CSS Containment
- `contain: content` on body cells (reduces browser repaints)
- `contain: none` on pinned columns (preserve `position: sticky`)
- `content-visibility: auto` on off-screen rows

### Column Virtualization
- Opt-in via `virtualScroll: { columns: true, columnOverscan: 2 }`
- Off-screen columns replaced by spacers
- Works alongside row virtualization

### Web Worker Sort/Filter
- Opt-in via `workerSort: true | 'auto'`
- Offloads expensive operations to thread
- Falls back to sync when: custom compare functions, people filters, Worker API unavailable

## Theming

All components use CSS variables for light/dark mode support:

| Variable | Purpose | Default |
|----------|---------|---------|
| `--ogrid-bg` | Background | `#fff` / `#1e1e1e` |
| `--ogrid-fg` | Text | `#242424` / `#e0e0e0` |
| `--ogrid-border` | Borders | `rgba(0,0,0,0.12)` |
| `--ogrid-accent` | Selected/active | `#0078d4` |
| `--ogrid-shadow` | Shadows | `0 4px 16px rgba(0,0,0,0.15)` |
| `--ogrid-muted` | Disabled/secondary | `#888` |
| `--ogrid-bg-hover` | Hover backgrounds | `#f0f0f0` / `#2a2a2a` |
| `--ogrid-selection` | Cell selection color | `#217346` |
| `--ogrid-formula-error-color` | Formula errors | `#dc3545` |

## Known Patterns

### Cell Editor Patterns (All Frameworks)
```typescript
// React
function MyEditor<T>(props: ICellEditorProps<T>): ReactElement {
  const { value, onValueChange, onCommit, onCancel } = props;
  return <div onMouseDown={(e) => e.stopPropagation()}>...</div>;
}

// Angular
@Component({
  standalone: true,
  template: `<div (mousedown)="$event.stopPropagation()">...</div>`,
})
export class MyEditorComponent {
  @Input() value: unknown;
  @Input() onValueChange!: (v: unknown) => void;
  @Input() onCommit!: () => void;
  @Input() onCancel!: () => void;
}

// Vue
export const MyEditor = defineComponent({
  props: { value, onValueChange, onCommit, onCancel, ... },
  setup(props) {
    return () => h('div', { onMousedown: (e) => e.stopPropagation() }, ...);
  },
});

// JS
export function createMyEditor(context: MyEditorContext): HTMLElement {
  const root = document.createElement('div');
  root.addEventListener('mousedown', (e) => e.stopPropagation());
  return root;
}
```

All editors support: Escape = cancel, Enter = commit (usually), focus on mount, popover root style.

### State Orchestration Pattern
- React: `useOGrid` + `useDataGridState` (composed from 6 sub-hooks)
- Angular: `OGridService` + `DataGridStateService` (signals-based)
- Vue: `useOGrid` + `useDataGridState` (composables)
- JS: `GridState` + `SelectionState` (class-based + EventEmitter)

All expose: columns, sorting, filtering, pagination, selection, editing, sidebar, undo/redo, etc.

## Community & Resources

- **GitHub:** https://github.com/alaarab/ogrid
- **Discord:** https://discord.gg/KMajyx9j4m
- **Docs:** https://ogrid.dev
- **License:** MIT
- **Author:** Ala Arab
