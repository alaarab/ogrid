# StackBlitz UI Library Selector — Implementation Summary

## Overview

Added a UI library selector to the LiveDemo component, allowing users to choose which UI library variant (Radix, Fluent, Material, PrimeNG, Vuetify, PrimeVue) they want to try in StackBlitz demos.

## Problem Solved

Previously, each feature page's StackBlitz demo only showed ONE UI library per framework:
- React → Radix only
- Angular → Material only
- Vue → Vuetify only

But OGrid actually has 3 UI library variants per framework:
- **React**: Radix (default), Fluent UI, Material UI
- **Angular**: Radix/CDK (default), Angular Material, PrimeNG
- **Vue**: Radix/Headless (default), Vuetify, PrimeVue

Users now see a dropdown to pick which variant they want to open in StackBlitz.

## Changes Made

### 1. Updated Project Factory Functions (`packages/docs/src/stackblitz/projects.ts`)

Extended `createReactProject`, `createAngularProject`, and `createVueProject` to accept a `uiLibrary` parameter:

```typescript
export type ReactUILibrary = 'radix' | 'fluent' | 'material';
export type AngularUILibrary = 'radix' | 'material' | 'primeng';
export type VueUILibrary = 'radix' | 'vuetify' | 'primevue';

createReactProject(code, title, uiLibrary: ReactUILibrary = 'radix')
createAngularProject(code, title, uiLibrary: AngularUILibrary = 'radix')
createVueProject(code, title, uiLibrary: VueUILibrary = 'radix')
```

Each factory now:
- Dynamically maps `uiLibrary` to the correct package name (`@alaarab/ogrid-react-radix`, `@alaarab/ogrid-react-fluent`, etc.)
- Sets appropriate dependencies (e.g., PrimeNG requires `primeng` + `primeicons`)
- For Vue, generates the correct `main.ts` setup code per UI library

### 2. Updated FeatureDemoSet Type (`packages/docs/src/stackblitz/featureDemos.ts`)

Changed from a flat structure to a nested structure with UI library variants:

**Before:**
```typescript
export interface FeatureDemoSet {
  React: StackBlitzProject;
  Angular: StackBlitzProject;
  Vue: StackBlitzProject;
  JS: StackBlitzProject;
}
```

**After:**
```typescript
export interface FeatureDemoSet {
  React: Record<ReactUILibrary, StackBlitzProject>;
  Angular: Record<AngularUILibrary, StackBlitzProject>;
  Vue: Record<VueUILibrary, StackBlitzProject>;
  JS: StackBlitzProject;  // JS has no variants
}
```

### 3. Updated LiveDemo Component (`packages/docs/src/components/LiveDemo.tsx`)

Added:
- **Framework detection**: Reads the active Docusaurus tab (React/Angular/Vue/JS) from URL hash and DOM
- **UI library selector**: A compact dropdown that shows available UI libraries for the current framework
- **localStorage persistence**: Remembers the user's choice across page visits
- **Backward compatibility**: Still supports the old `Record<string, StackBlitzProject>` format for legacy demos

UI:
```
[Demo Title]                    UI Library: [Radix ▾]  [⚡ StackBlitz]  [Live]
```

The selector only appears when:
- Multiple UI libraries are available for the current framework
- The framework is not JS (JS has no variants)

### 4. Updated 3 Feature Demos with All UI Libraries

Updated the following demos to provide all 3 UI library variants per framework:

1. **Sorting** (`sorting`)
2. **Filtering** (`filtering`)
3. **Editing** (`editing`)

For each demo, created helper functions that generate code with the correct import path:

```typescript
const sortingReactCode = (pkg: string) => `import { OGrid } from '${pkg}'; ...`;
const sortingAngularCode = (pkg: string) => `import { OGridComponent } from '${pkg}'; ...`;
const sortingVueCode = (pkg: string, wrapper?: string) => `...`;  // wrapper = 'v-app' for Vuetify

export const sorting: FeatureDemoSet = {
  React: {
    radix: createReactProject(sortingReactCode('@alaarab/ogrid-react-radix'), '...', 'radix'),
    fluent: createReactProject(sortingReactCode('@alaarab/ogrid-react-fluent'), '...', 'fluent'),
    material: createReactProject(sortingReactCode('@alaarab/ogrid-react-material'), '...', 'material'),
  },
  Angular: {
    radix: createAngularProject(sortingAngularCode('@alaarab/ogrid-angular-radix'), '...', 'radix'),
    material: createAngularProject(sortingAngularCode('@alaarab/ogrid-angular-material'), '...', 'material'),
    primeng: createAngularProject(sortingAngularCode('@alaarab/ogrid-angular-primeng'), '...', 'primeng'),
  },
  Vue: {
    radix: createVueProject(sortingVueCode('@alaarab/ogrid-vue-radix'), '...', 'radix'),
    vuetify: createVueProject(sortingVueCode('@alaarab/ogrid-vue-vuetify', 'v-app'), '...', 'vuetify'),
    primevue: createVueProject(sortingVueCode('@alaarab/ogrid-vue-primevue'), '...', 'primevue'),
  },
  JS: createJSProject(...),
};
```

## Guidelines Added

Added a comment block at the top of `featureDemos.ts` with best practices for creating effective demos:

1. **Showcase unique aspects** of each feature (don't just render a basic grid)
2. **Use appropriate data** (e.g., large datasets for virtual scrolling)
3. **Provide context** (titles, descriptions, edge cases)
4. **Keep code clean and focused** (minimal boilerplate)
5. **Ensure UI library variants are functionally identical** (only import paths differ)

## Files Changed

1. `/home/alaarab/ogrid/packages/docs/src/stackblitz/projects.ts` — Added `uiLibrary` parameters
2. `/home/alaarab/ogrid/packages/docs/src/stackblitz/featureDemos.ts` — Updated type + 3 demos
3. `/home/alaarab/ogrid/packages/docs/src/components/LiveDemo.tsx` — Added selector logic

## Remaining Work

The following 18 feature demos still use the old single-project structure and need to be updated:

- pagination
- spreadsheetSelection
- rowSelection
- columnPinning
- columnReordering
- columnGroups
- contextMenu
- statusBar
- gridApi
- columnChooser
- toolbar
- sidebar
- csvExport
- serverSideData
- keyboardNavigation
- columnTypes
- showcase
- virtualScrolling

Each should be updated using the same pattern as sorting/filtering/editing.

## Testing

Build successful:
```bash
cd packages/docs
npx docusaurus clear
npx docusaurus build
# ✓ Generated static files in "build".
```

## User Experience

1. User visits a feature page (e.g., `/docs/features/sorting`)
2. Clicks the React tab
3. Sees a dropdown: **UI Library: [Radix ▾]**
4. Can select Fluent or Material
5. Clicks **⚡ StackBlitz** → Opens the selected variant in StackBlitz
6. Choice is remembered in localStorage for future visits

The default is always Radix (the lightweight default), but users can easily try Fluent or Material variants.
