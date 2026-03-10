import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for OGrid.
 *
 * Tests run against representative example apps:
 *   - React Fluent    to  port 3001
 *   - React Material  to  port 3002
 *   - React Radix     to  port 3003
 *   - Angular Material  to  port 3011
 *   - Vue Radix         to  port 3020
 *   - Vue Vuetify       to  port 3021
 *   - Vanilla JS       to  port 3030
 *
 * Each project shares the same test suite in e2e/  -  tests are parameterised
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
      name: 'react-fluent',
      use: { baseURL: 'http://localhost:3001' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
    {
      name: 'react-material',
      use: { baseURL: 'http://localhost:3002' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
    {
      name: 'react-radix',
      use: { baseURL: 'http://localhost:3003' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
    {
      name: 'angular-material',
      use: { baseURL: 'http://localhost:3011' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
    {
      name: 'vue-vuetify',
      use: { baseURL: 'http://localhost:3021' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
    {
      name: 'vue-radix',
      use: { baseURL: 'http://localhost:3020' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
    {
      name: 'js',
      use: { baseURL: 'http://localhost:3030' },
      testIgnore: ['e2e/docsHomepage.spec.ts'],
    },
  ],

  webServer: [
    {
      command: 'npm run dev:react-fluent',
      port: 3001,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev:react-material',
      port: 3002,
      reuseExistingServer: true,
      timeout: 30_000,
    },
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
      command: 'npm run dev:vue-radix',
      port: 3020,
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
