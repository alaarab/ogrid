# OGrid Design Specification - Sprint Tasks #7-10

**Project Lead**: Project Lead Alpha
**Date**: 2026-02-12
**Status**: Design Phase - Awaiting Approval

---

## Overview

This specification covers four tasks:
1. **Task #7**: Create `@alaarab/ogrid-angular-radix` package
2. **Task #8**: Create `@alaarab/ogrid-vue-radix` package
3. **Task #9**: Improve landing page comparison table visual design
4. **Task #10**: Add rotating framework install animation to CTA section

---

## Part 1: Angular Radix & Vue Radix Packages (Tasks #7, #8)

### Design Philosophy

Create lightweight, minimal-dependency UI packages that serve as the "default" option for Angular and Vue, matching react-radix's positioning. These will be the recommended starting point for new users who don't need Material/Vuetify/PrimeNG's full component libraries.

### Package Specifications

#### @alaarab/ogrid-angular-radix

**Dependencies:**
```json
{
  "dependencies": {
    "@alaarab/ogrid-angular": "2.0.3",
    "@angular/cdk": "^21.0.0"
  },
  "peerDependencies": {
    "@angular/core": "^21.0.0",
    "@angular/common": "^21.0.0"
  }
}
```

**Rationale**:
- Angular CDK provides overlay/portal primitives needed for popovers
- No Material UI dependency keeps bundle size minimal
- CDK is a regular dependency (not peer) to simplify installation

**Component Architecture:**
```
src/
├── ogrid/
│   └── ogrid.component.ts          # Top-level wrapper, re-exports OGridLayoutComponent
├── datagrid-table/
│   ├── datagrid-table.component.ts # Core table rendering (native <table>)
│   ├── datagrid-table.component.scss
│   ├── inline-cell-editor.component.ts
│   └── grid-context-menu.component.ts
├── column-header-filter/
│   ├── column-header-filter.component.ts  # Filter trigger button
│   ├── text-filter-popover.component.ts   # CDK overlay
│   ├── multiselect-filter-popover.component.ts
│   └── column-header-filter.component.scss
├── column-chooser/
│   ├── column-chooser.component.ts        # Dropdown with checkboxes
│   └── column-chooser.component.scss
├── pagination-controls/
│   ├── pagination-controls.component.ts   # Page navigation UI
│   └── pagination-controls.component.scss
├── __tests__/                             # Shared factory wrappers
└── index.ts                                # Public API
```

**Styling Approach:**
- Native HTML `<table>` element (not MatTable)
- SCSS modules with BEM naming
- CSS variables for theming:
  ```scss
  --ogrid-border: #e0e0e0;
  --ogrid-bg: #ffffff;
  --ogrid-fg: #242424;
  --ogrid-header-bg: #f5f5f5;
  --ogrid-hover-bg: #f0f0f0;
  --ogrid-active-border: #0078d4;
  ```
- Match react-radix visual style exactly

**Build Pipeline:**
```bash
npm run build
# 1. TypeScript compilation: tsc -p tsconfig.build.json
# 2. SCSS compilation: node scripts/compile-styles.js
# Output: dist/esm/ + dist/types/ + dist/styles/
```

---

#### @alaarab/ogrid-vue-radix

**Dependencies:**
```json
{
  "dependencies": {
    "@alaarab/ogrid-vue": "2.0.3",
    "@headlessui/vue": "^1.7.0"
  },
  "peerDependencies": {
    "vue": "^3.3.0"
  }
}
```

**Rationale**:
- Headless UI Vue provides unstyled primitives (Menu, Popover) matching Radix's philosophy
- No Vuetify/PrimeVue dependency keeps bundle minimal
- Headless UI bundled as regular dependency

**Component Architecture:**
```
src/
├── OGrid/
│   └── OGrid.vue                   # Top-level wrapper, uses OGridLayout
├── DataGridTable/
│   ├── DataGridTable.vue           # Core table rendering (native <table>)
│   ├── DataGridTable.module.scss
│   ├── InlineCellEditor.vue
│   ├── StatusBar.vue
│   └── GridContextMenu.vue
├── ColumnHeaderFilter/
│   ├── ColumnHeaderFilter.vue      # Filter trigger button
│   ├── TextFilterPopover.vue       # Headless UI Popover
│   ├── MultiSelectFilterPopover.vue
│   ├── PeopleFilterPopover.vue
│   └── ColumnHeaderFilter.module.scss
├── ColumnChooser/
│   ├── ColumnChooser.vue           # Headless UI Menu dropdown
│   └── ColumnChooser.module.scss
├── PaginationControls/
│   ├── PaginationControls.vue      # Page navigation UI
│   └── PaginationControls.module.scss
├── __tests__/                      # Shared factory wrappers
└── index.ts                        # Public API
```

**Styling Approach:**
- Same as angular-radix (native table, SCSS modules, CSS variables)
- Match react-radix visual style pixel-perfect
- Vue Scoped CSS (`<style scoped>`) for component isolation

**Build Pipeline:**
```bash
npm run build
# 1. Vite build with vite-plugin-dts for types
# 2. SCSS compilation: node scripts/compile-styles.js
# Output: dist/esm/ + dist/types/ + dist/styles/
```

---

### Testing Strategy

Both packages will use shared test factories:

```typescript
// packages/angular-radix/src/__tests__/datagrid-table.component.spec.ts
import { DataGridTableComponent } from '../datagrid-table/datagrid-table.component';
import { createDataGridTableTests } from '@alaarab/ogrid-core/testing';

describe('DataGridTableComponent', () => {
  createDataGridTableTests(DataGridTableComponent);
});
```

**Target**: 92 tests per package (matching other UI packages)

**Test Coverage**:
- OGrid component: createOGridTests (20 tests)
- DataGridTable: createDataGridTableTests (35 tests)
- ColumnChooser: createColumnChooserTests (12 tests)
- PaginationControls: createPaginationControlsTests (15 tests)
- ColumnHeaderFilter: createColumnHeaderFilterTests (10 tests)

---

### Monorepo Integration

**Turborepo Pipeline:**
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

Build order:
1. `core` builds first
2. `angular` and `vue` build in parallel
3. `angular-radix` and `vue-radix` build after their base packages

**Workspace Configuration (root package.json):**
```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

**NPM Scripts (root):**
```json
{
  "scripts": {
    "test:angular-radix": "npm run test --workspace=@alaarab/ogrid-angular-radix",
    "test:vue-radix": "npm run test --workspace=@alaarab/ogrid-vue-radix"
  }
}
```

---

### Documentation Requirements (Definition of Done)

Per CLAUDE.md, both packages require:

1. **Feature Documentation**:
   - Update all feature pages in `packages/docs/docs/features/` to add new Radix options:
     - React tab: Add "@alaarab/ogrid-react-radix" (already default)
     - Angular tab: Update tip admonition to list 3 options (Material, PrimeNG, **Radix**)
     - Vue tab: Update tip admonition to list 3 options (Vuetify, PrimeVue, **Radix**)

2. **Framework Showcase**:
   - Add 2 new sections to `packages/docs/docs/guides/framework-showcase.mdx`:
     ```markdown
     ### Angular (Radix UI - Lightweight)
     ```sh
     npm install @alaarab/ogrid-angular-radix
     ```
     [StackBlitz demo]

     ### Vue (Headless UI - Lightweight)
     ```sh
     npm install @alaarab/ogrid-vue-radix
     ```
     [StackBlitz demo]
     ```

3. **StackBlitz Demos**:
   - Update `packages/docs/src/stackblitz/featureDemos.ts`:
     - Add angular-radix and vue-radix projects to every FeatureDemoSet
     - Reference version 2.0.4 (next version after implementation)

4. **README Updates**:
   - Update root README.md to list 14 packages (was 12)
   - Update monorepo structure diagram

---

## Part 2: Landing Page UX Improvements (Tasks #9, #10)

### Task #9: Comparison Table Redesign

#### Current Problems
1. Plain HTML table doesn't showcase the 12-package ecosystem
2. No visual hierarchy between feature categories
3. Missing framework categorization
4. Doesn't emphasize OGrid's multi-framework advantage

#### Proposed Solution: Two-Section Layout

**Section 1: Framework Ecosystem Showcase**

Visual design: 4-column grid layout

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   React     │   Angular   │     Vue     │ Vanilla JS  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ 🔷 Radix    │ 🔷 Radix    │ 🔷 Radix    │ 🔷 JS       │
│ Lightweight │ Lightweight │ Lightweight │ Zero deps   │
│ $ npm i...  │ $ npm i...  │ $ npm i...  │ $ npm i...  │
│ [Copy btn]  │ [Copy btn]  │ [Copy btn]  │ [Copy btn]  │
├─────────────┼─────────────┼─────────────┤             │
│ 🟦 Fluent   │ 🟦 Material │ 🟦 Vuetify  │             │
│ Microsoft   │ Google      │ Material    │             │
│ $ npm i...  │ $ npm i...  │ $ npm i...  │             │
│ [Copy btn]  │ [Copy btn]  │ [Copy btn]  │             │
├─────────────┼─────────────┼─────────────┤             │
│ 🟦 Material │ 🟦 PrimeNG  │ 🟦 PrimeVue │             │
│ Google      │ PrimeTek    │ PrimeTek    │             │
│ $ npm i...  │ $ npm i...  │ $ npm i...  │             │
│ [Copy btn]  │ [Copy btn]  │ [Copy btn]  │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Component Structure:**
```tsx
function FrameworkEcosystemSection() {
  const packages = [
    { framework: 'React', name: 'Radix', npm: '@alaarab/ogrid-react-radix', tag: 'Lightweight', primary: true },
    { framework: 'React', name: 'Fluent UI', npm: '@alaarab/ogrid-react-fluent', tag: 'Microsoft' },
    { framework: 'React', name: 'Material UI', npm: '@alaarab/ogrid-react-material', tag: 'Google' },
    { framework: 'Angular', name: 'Radix', npm: '@alaarab/ogrid-angular-radix', tag: 'Lightweight', primary: true },
    { framework: 'Angular', name: 'Material', npm: '@alaarab/ogrid-angular-material', tag: 'Google' },
    { framework: 'Angular', name: 'PrimeNG', npm: '@alaarab/ogrid-angular-primeng', tag: 'PrimeTek' },
    { framework: 'Vue', name: 'Radix', npm: '@alaarab/ogrid-vue-radix', tag: 'Lightweight', primary: true },
    { framework: 'Vue', name: 'Vuetify', npm: '@alaarab/ogrid-vue-vuetify', tag: 'Material' },
    { framework: 'Vue', name: 'PrimeVue', npm: '@alaarab/ogrid-vue-primevue', tag: 'PrimeTek' },
    { framework: 'JS', name: 'Vanilla JS', npm: '@alaarab/ogrid-js', tag: 'Zero deps', primary: true },
  ];

  return (
    <div className={styles.frameworkGrid}>
      {['React', 'Angular', 'Vue', 'JS'].map(fw => (
        <div key={fw} className={styles.frameworkColumn}>
          <h3>{fw}</h3>
          {packages.filter(p => p.framework === fw).map(pkg => (
            <PackageCard key={pkg.npm} {...pkg} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Styling:**
```scss
.frameworkGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
  margin: 3rem 0;

  @media (max-width: 968px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.frameworkColumn {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.packageCard {
  border: 1px solid var(--ogrid-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--ogrid-bg);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  &.primary {
    border-color: var(--ogrid-active-border);
    border-width: 2px;
    background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
  }
}

.packageName {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.packageTag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  background: var(--ogrid-hover-bg);
  margin-bottom: 0.75rem;
}

.installCommand {
  font-family: monospace;
  font-size: 0.85rem;
  background: var(--ifm-code-background);
  padding: 8px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copyBtn {
  cursor: pointer;
  padding: 4px 8px;
  font-size: 0.75rem;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}
```

---

**Section 2: Enhanced Feature Comparison**

Improvements to existing comparison table:

1. **Categorized rows with expand/collapse**:
```tsx
const categories = [
  {
    name: 'Core Features',
    features: ['Sorting & Filtering', 'Pagination', 'Cell Editing', 'Row Selection', 'Column Groups']
  },
  {
    name: 'Spreadsheet Features',
    features: ['Spreadsheet Selection', 'Clipboard', 'Fill Handle', 'Undo / Redo']
  },
  {
    name: 'Advanced Features',
    features: ['Context Menu', 'Status Bar', 'Side Bar', 'Server-Side Data', 'Headless Core']
  }
];
```

2. **Visual enhancements**:
- Color-coded rows (green highlight for OGrid's free enterprise features)
- Feature icons from existing `features` array
- Sticky header on scroll
- Hover effects

3. **Styling**:
```scss
.comparisonTable {
  tr.enterprise-free {
    background: linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%);
    border-left: 3px solid #22c55e;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--ogrid-header-bg);
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .checkGreen {
    color: #22c55e;
    font-weight: 600;

    &::before {
      content: '✓ ';
      font-size: 1.2em;
    }
  }

  .enterprise {
    color: #f59e0b;
    font-weight: 600;

    &::before {
      content: '💎 ';
    }
  }
}
```

---

### Task #10: Rotating Install Animation

#### Design Specification

**Animation Behavior:**
- Cycles through all 12 package install commands
- 3-second interval per package
- Smooth fade transition (300ms opacity + slight translate)
- Pauses on hover
- Click to copy command

**Component Architecture:**

```tsx
interface Package {
  framework: 'React' | 'Angular' | 'Vue' | 'JS';
  name: string;
  npm: string;
  color: string;
}

const PACKAGES: Package[] = [
  { framework: 'React', name: 'Radix', npm: '@alaarab/ogrid-react-radix', color: '#61dafb' },
  { framework: 'React', name: 'Fluent', npm: '@alaarab/ogrid-react-fluent', color: '#61dafb' },
  { framework: 'React', name: 'Material', npm: '@alaarab/ogrid-react-material', color: '#61dafb' },
  { framework: 'Angular', name: 'Radix', npm: '@alaarab/ogrid-angular-radix', color: '#dd0031' },
  { framework: 'Angular', name: 'Material', npm: '@alaarab/ogrid-angular-material', color: '#dd0031' },
  { framework: 'Angular', name: 'PrimeNG', npm: '@alaarab/ogrid-angular-primeng', color: '#dd0031' },
  { framework: 'Vue', name: 'Radix', npm: '@alaarab/ogrid-vue-radix', color: '#42b883' },
  { framework: 'Vue', name: 'Vuetify', npm: '@alaarab/ogrid-vue-vuetify', color: '#42b883' },
  { framework: 'Vue', name: 'PrimeVue', npm: '@alaarab/ogrid-vue-primevue', color: '#42b883' },
  { framework: 'JS', name: 'Vanilla', npm: '@alaarab/ogrid-js', color: '#f7df1e' },
];

function RotatingInstallCommand() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % PACKAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`npm install ${PACKAGES[index].npm}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pkg = PACKAGES[index];

  return (
    <div
      className={styles.rotatingInstall}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleCopy}
    >
      <div className={styles.frameworkBadge} style={{ '--fw-color': pkg.color }}>
        {pkg.framework} • {pkg.name}
      </div>
      <div className={styles.installCommandAnimated} key={index}>
        <span className={styles.prompt}>$</span>
        <span className={styles.command}>npm install</span>
        <span className={styles.package}>{pkg.npm}</span>
      </div>
      <div className={styles.copyIndicator}>
        {copied ? '✓ Copied' : 'Click to copy'}
      </div>
    </div>
  );
}
```

**Styling:**

```scss
.rotatingInstall {
  position: relative;
  background: var(--ifm-code-background);
  border-radius: 8px;
  padding: 1.5rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.02);
  }
}

.frameworkBadge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: color-mix(in srgb, var(--fw-color) 15%, transparent);
  color: var(--fw-color);
  margin-bottom: 0.75rem;
}

.installCommandAnimated {
  font-size: 1rem;
  color: var(--ifm-color-content);
  animation: fadeInUp 0.3s ease-out;

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

.prompt {
  color: #888;
  margin-right: 0.5rem;
}

.command {
  color: #c792ea;
  margin-right: 0.5rem;
}

.package {
  color: #82aaff;
  font-weight: 600;
}

.copyIndicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.6;
  transition: opacity 0.2s;

  .rotatingInstall:hover & {
    opacity: 1;
  }
}
```

**Placement:**
1. Replace static install command in Hero section (line 169-171 of index.tsx)
2. Replace static install command in CTA section (line 449-451 of index.tsx)
3. Optional: Add to Quick Start page header

---

## Implementation Plan

### Phase 1: Angular Radix (Task #7)
**Estimated**: 3-4 days

1. **Day 1**: Package setup
   - Create package structure
   - Configure TypeScript, Jest, build scripts
   - Set up SCSS compilation pipeline
   - Add to Turborepo

2. **Day 2-3**: Component implementation
   - OGridComponent (wrapper)
   - DataGridTableComponent (core table)
   - ColumnHeaderFilterComponent + filter popovers
   - ColumnChooserComponent
   - PaginationControlsComponent

3. **Day 4**: Testing & docs
   - Wire up shared test factories
   - Run full test suite
   - Update feature docs with new package
   - Update framework showcase
   - Create StackBlitz demos

### Phase 2: Vue Radix (Task #8)
**Estimated**: 3-4 days

Same as Phase 1, but with Vue components.

### Phase 3: Landing Page UX (Tasks #9, #10)
**Estimated**: 2 days

1. **Day 1**: Framework Ecosystem Section (Task #9)
   - Build PackageCard component
   - Implement 4-column grid layout
   - Add copy-to-clipboard functionality
   - Enhance comparison table with categories
   - Test responsive design

2. **Day 2**: Rotating Install Animation (Task #10)
   - Build RotatingInstallCommand component
   - Implement fade transition animation
   - Add hover pause and click-to-copy
   - Replace static commands in Hero and CTA sections
   - Test cross-browser compatibility

---

## Success Criteria

### Angular Radix & Vue Radix
- [ ] Packages build without errors
- [ ] All 92 tests pass per package
- [ ] Visual parity with react-radix (pixel-perfect match)
- [ ] Bundle size < 100KB gzipped (excluding peer deps)
- [ ] Feature docs updated with new packages in all 4 framework tabs
- [ ] Framework showcase page updated with 2 new sections
- [ ] StackBlitz demos working for all features
- [ ] Published to npm as v2.0.4

### Landing Page UX
- [ ] Framework ecosystem section renders correctly on mobile/tablet/desktop
- [ ] Copy-to-clipboard works in all browsers
- [ ] Rotating animation runs smoothly (no jank)
- [ ] Comparison table categories expand/collapse correctly
- [ ] Sticky header works on scroll
- [ ] Lighthouse performance score > 90
- [ ] No layout shift (CLS < 0.1)

---

## Open Questions

1. **Angular CDK Overlays**: Should we use CDK Overlay or build a simpler popover with `position: absolute`? CDK adds ~30KB but provides better positioning logic.
   - **Recommendation**: Use CDK Overlay - the 30KB is acceptable for robust positioning.

2. **Headless UI Vue**: Version 1.7.0 is stable, but v2.0.0 is in beta. Should we wait?
   - **Recommendation**: Ship with v1.7.0, upgrade to v2.0 when stable.

3. **Rotating Animation**: Should it cycle through all 12 packages or just the 4 "default" ones (Radix + JS)?
   - **Recommendation**: Show all 12 to emphasize ecosystem depth, but group by framework.

4. **Version Bump**: New packages will be v2.0.4. Should we also bump existing packages?
   - **Recommendation**: No - only bump core, angular, vue, angular-radix, vue-radix. Other packages stay at 2.0.3.

---

## Next Steps

1. **Team Lead**: Review and approve design decisions
2. **Engineers**: Begin implementation after approval
3. **QA**: Test packages on Windows/Mac/Linux
4. **Docs**: Update all documentation per Definition of Done checklist

---

**End of Design Specification**
