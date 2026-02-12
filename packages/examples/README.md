# OGrid Examples

This package contains example applications for all OGrid UI packages across multiple frameworks.

## Available Examples

### React Examples (3)
- **React Radix** - `npm run dev:react-radix` (port 3003)
  - Package: `@alaarab/ogrid-react-radix`
  - Lightweight Radix UI implementation

- **React Fluent** - `npm run dev:react-fluent` (port 3001)
  - Package: `@alaarab/ogrid-react-fluent`
  - Microsoft Fluent UI implementation

- **React Material** - `npm run dev:react-material` (port 3002)
  - Package: `@alaarab/ogrid-react-material`
  - Google Material UI implementation

### Angular Examples (3)
- **Angular Radix** - `npm run dev:angular-radix` (port 3010)
  - Package: `@alaarab/ogrid-angular-radix`
  - Angular CDK-based implementation

- **Angular Material** - `npm run dev:angular-material` (port 3011)
  - Package: `@alaarab/ogrid-angular-material`
  - Angular Material implementation

- **Angular PrimeNG** - `npm run dev:angular-primeng` (port 3012)
  - Package: `@alaarab/ogrid-angular-primeng`
  - PrimeNG implementation

### Vue Examples (3)
- **Vue Radix** - `npm run dev:vue-radix` (port 3020)
  - Package: `@alaarab/ogrid-vue-radix`
  - Headless UI-based implementation

- **Vue Vuetify** - `npm run dev:vue-vuetify` (port 3021)
  - Package: `@alaarab/ogrid-vue-vuetify`
  - Vuetify 3 implementation

- **Vue PrimeVue** - `npm run dev:vue-primevue` (port 3022)
  - Package: `@alaarab/ogrid-vue-primevue`
  - PrimeVue 4 implementation

### Vanilla JS Example (1)
- **Vanilla JS** - `npm run dev:js` (port 3030)
  - Package: `@alaarab/ogrid-js`
  - Framework-free implementation

## Running Examples

From the monorepo root:

```bash
# Install dependencies
npm ci

# Build all packages first
npm run build

# Run any example (from this directory)
cd packages/examples
npm run dev:react-radix
npm run dev:angular-material
npm run dev:vue-vuetify
npm run dev:js
# etc.
```

## Building Examples

```bash
npm run build:react-radix
npm run build:angular-material
npm run build:vue-vuetify
npm run build:js
# etc.
```

Built examples are output to `dist/{framework-package}/`.

## Example Structure

Each example demonstrates:
- Basic OGrid setup with sample data (75 projects)
- Column definitions with sorting and filtering
- Multi-select and text filters
- Column chooser
- Pagination (25 items per page)
- Framework-specific theme setup

All examples use the same shared demo data from `src/shared/demoData.ts`.
