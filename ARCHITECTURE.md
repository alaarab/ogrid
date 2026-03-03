# OGrid Architecture

High-level overview of the OGrid monorepo — 21 packages, headless core, 4 frameworks.

- **Monorepo:** npm workspaces + Turborepo
- **Build:** TypeScript 5.7 strict, ESM-only, tree-shakeable
- **Node:** 22 via nvm
- **License:** MIT

## Project Structure

```
packages/
  core/                    → @alaarab/ogrid-core (zero deps)
  react/                   → @alaarab/ogrid-react (hooks + shared logic)
  react-{radix,fluent,material}/  → UI implementations (3 packages)
  angular/                 → @alaarab/ogrid-angular (services + signals)
  angular-{material,primeng,radix}/  → UI implementations (3 packages)
  vue/                     → @alaarab/ogrid-vue (composables)
  vue-{vuetify,primevue,radix}/  → UI implementations (3 packages)
  js/                      → @alaarab/ogrid-js (vanilla JS, class-based)
  inputs/                  → @alaarab/ogrid-inputs (headless utils: calendar, rating, color, slider, tags)
  {react,angular,vue,js}-inputs/  → Premium editors (5 total per framework)
  docs/                    → Docusaurus site + demos
  examples/                → Vite example apps
```

## Core Concepts

### Headless Architecture

**Core** (`@alaarab/ogrid-core`) is pure TypeScript with zero framework dependencies:
- Types (`IColumnDef<T>`, `IOGridProps`, `IFilters`, etc.)
- Utilities (sort, filter, pagination, cell references, formulas)
- Algorithms (virtual scroll ranges, responsive column hiding, worker sort/filter)

**Framework packages** implement the same interfaces:
- React: hooks (`useOGrid`, `useDataGridState`, etc.) + thin view layer
- Angular: services + signals + standalone components
- Vue: composables + render functions (NO SFCs)
- JS: class-based state + DOM manipulation

**UI packages** are the thinnest layer — just visual mapping from framework state to framework components.

### Premium Inputs (v2.5.5+)

5 optional cell editors (`cellEditorPopup: true`) available across all 4 frameworks:

1. **DatePickerEditor** — Calendar popup with month nav, text input, Today/Clear buttons
2. **RatingEditor** — Star rating (1-5, configurable `maxStars`, `allowHalf` support)
3. **ColorPickerEditor** — 5×4 swatch grid + hex input + contrast detection
4. **SliderEditor** — Custom drag slider with step snapping + number input sync
5. **TagsEditor** — Multi-chip tags with suggestions dropdown + search

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

**Architecture:** Tokenizer → Parser → Evaluator with dependency graph (cycle detection). Tree-shakeable via `formulas` prop (only compile used functions).

**Features:** Named ranges, formula auditing (BFS precedents/dependents), cross-sheet references, cell reference formatting, clipboard/fill handle/CSV export awareness.

## Key Commands

```bash
npm ci                          # Install deps
npm run build                   # Build all packages (Turborepo)
npm run test:all                # Run all 4,728 tests
npm run test:{core,js,react,radix,fluent,material}  # Package-specific
npm run lint                    # ESLint
npm run storybook:{react-fluent,react-material,react-radix,:6006,6007,6008}
npm run docs:dev                # Docusaurus dev (http://localhost:3000)
npm run docs:build              # Build static docs site
```

## Conventions

### Types
- `I` prefix for interfaces: `IColumnDef`, `IDataSource`, `IOGridApi`
- No external state libraries (hooks/signals/composables only)
- TypeScript strict mode everywhere

### Naming
- Component names: PascalCase
- Editor names: `{Name}Editor` (React/Vue), `{Name}EditorComponent` (Angular), `create{Name}Editor` (JS)
- Hooks: `use*` (React), `use*` (Vue), services in Angular, factories in JS

### Styles
- Inline (`React.CSSProperties`, `Record<string, string>` in Angular)
- CSS variables for theming (no dark mode hacks)
- No CSS files in input packages (`sideEffects: false`)

### Testing
- **Core:** Jest, pure TS utilities
- **React:** React Testing Library + RTL queries
- **Angular:** Angular Testing utilities + TestBed
- **Vue:** Vue Test Utils + `mount()`
- **JS:** jsdom + native DOM APIs

### File Structure per Package
```
src/
  components/        → Reusable headless components
  hooks/             → React hooks (React package only)
  services/          → Angular services (Angular package only)
  composables/       → Vue composables (Vue package only)
  types/             → TypeScript interfaces
  utils/             → Utility functions
  workers/           → Web workers (core only)
  __tests__/         → Tests co-located with code
tsconfig.json        → Dev config (includes tests)
tsconfig.build.json  → Build config (excludes tests)
tsup.config.ts       → ESM + types bundling
jest.config.js       → Jest setup with moduleNameMapper for deps
package.json         → ESM, no CJS, tree-shakeable, peer deps
```

## Architecture Decisions

### Why Headless Core + Framework Wrappers?
- Reuse algorithm logic across all frameworks without reimplementing
- Type safety via TypeScript interfaces across language boundaries
- Easy to test algorithms in isolation
- Frameworks can evolve independently without touching core

### Why Three UI Kits per Framework?
- Users pick their design system (Radix, Material, Fluent, Vuetify, PrimeNG, etc.)
- Same API, different look → easy migration
- Proves the headless architecture works
- Encourages community contributions for more UI kits

### Why Optional Premium Inputs?
- Keeps base packages lightweight
- Users only pay for what they use (tree-shakeable)
- Allows future input types without bloating everyone's bundle
- Inline styles + CSS variables = consistent theming without CSS files

### Why Inline Styles in Input Packages?
- `sideEffects: false` — no CSS files to import
- Smaller footprint for optional packages
- CSS variables for theming (light/dark mode aware)
- Matches DatePicker pattern (battle-tested)

### Why No SFCs in Vue?
- CommonJS `require()` can't import ES modules
- Jest needs CommonJS for `jest.requireActual()` in test setup
- Using `defineComponent()` + `h()` keeps everything ESM

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
