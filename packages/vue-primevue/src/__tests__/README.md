# Vue PrimeVue Tests

## Why No Export Tests?

Vue UI packages (vue-vuetify, vue-primevue, vue-radix) intentionally **do not** have `exports.test.ts` files.

**Reason**: Vue 3 Single File Components (`.vue`) are ESM-only and cannot be loaded via CommonJS `require()`, which Jest uses for export tests. The tests would fail with silent import errors.

**Why it's okay**: The factory tests (`factories.test.ts` - 100+ tests) already verify all exports work correctly by actually importing and using them. Export tests would be redundant sanity checks.

**Don't add them back!** If you think export tests are missing, they're intentionally skipped. Use factory tests instead.
