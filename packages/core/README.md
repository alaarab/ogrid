# @alaarab/ogrid-core

Pure TypeScript types, grid algorithms and utilities, with no runtime dependencies. Includes sort/filter, selection, clipboard/fill series, merges, structure edits, conditional formatting and data validation helpers.

```bash
npm install @alaarab/ogrid-core
```

The formula engine has 191 registered built-in functions plus evaluator-level `LET` bindings, dynamic arrays/spill references, dependency recalculation and custom functions. Import it without React:

```ts
import { FormulaEngine } from '@alaarab/ogrid-core/formula';

export const engine = new FormulaEngine();
```

Formula autocomplete metadata and helpers are also available at `@alaarab/ogrid-core/formula/assist`. The React kits re-export core's shared types and utilities; direct consumers can import `IColumnDef`, `IDataSource` and `IOGridApi` from the main entry.

See the [formula guide](https://alaarab.github.io/ogrid/docs/features/formulas) and [types reference](https://alaarab.github.io/ogrid/docs/api/types). MIT licensed; version 2.19.0.
