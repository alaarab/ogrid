import { defineConfig, devices } from '@playwright/test';

/**
 * Large-grid benchmark (e2e/perf). Serves a production build of
 * packages/examples/src/radix/perf-large-grid.html on port 3009 unless
 * OGRID_PERF_URL points at another build.
 */
export default defineConfig({
  testDir: './e2e/perf',
  testMatch: '*.bench.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.OGRID_PERF_URL
    ? undefined
    : {
        command: 'bun --filter @alaarab/ogrid-examples serve:perf',
        port: 3009,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
