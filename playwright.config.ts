import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for OGrid.
 *
 * Tests run against 4 representative example apps (one per framework family):
 *   - React Radix    → port 3003
 *   - Angular Material → port 3011
 *   - Vue Vuetify     → port 3021
 *   - Vanilla JS      → port 3030
 *
 * Each project shares the same test suite in e2e/ — tests are parameterised
 * via baseURL so identical user-journeys are verified across every framework.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 1,
  workers: 1, // sequential to avoid port conflicts during server startup
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'react-radix',
      use: { baseURL: 'http://localhost:3003' },
    },
    {
      name: 'angular-material',
      use: { baseURL: 'http://localhost:3011' },
    },
    {
      name: 'vue-vuetify',
      use: { baseURL: 'http://localhost:3021' },
    },
    {
      name: 'js',
      use: { baseURL: 'http://localhost:3030' },
    },
  ],

  webServer: [
    {
      command: 'npm run dev:react-radix',
      port: 3003,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev:angular-material',
      port: 3011,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev:vue-vuetify',
      port: 3021,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev:js',
      port: 3030,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
