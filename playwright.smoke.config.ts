import { defineConfig, devices } from '@playwright/test';
import { defaultBrowserUse, smokeBrowserProjects, smokeBrowserServers } from './playwright.shared';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['liveSmoke.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    ...defaultBrowserUse,
  },
  projects: smokeBrowserProjects,
  webServer: smokeBrowserServers,
});
