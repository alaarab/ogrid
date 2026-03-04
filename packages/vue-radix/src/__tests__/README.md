# Vue Radix Tests

## Export Tests

`exports.test.ts` verifies the public API surface using Jest with the existing CommonJS transform.

Vue 3 SFC files (`.vue`) are mapped to `jest-mocks/vue-component.cjs.js`, which returns `{ default: {} }`.
This means SFC component exports like `ColumnChooser` show up as `{}` objects in the test rather than
full Vue component definitions — but `toBeDefined()` still passes, which is enough to confirm the export
exists and the name is correct.

Components defined in `.ts` files (`OGrid`, `DataGridTable`, `InlineCellEditor`) resolve normally.

## Factory Tests

`factories.test.ts` runs 127 tests covering composable behavior through Vue's reactivity system.
These import from `@alaarab/ogrid-vue/testing` and don't touch the local index, so SFCs are irrelevant.
