import { defineConfig, devices } from '@playwright/test';
import { allBrowserProjects, allBrowserServers, defaultBrowserUse } from './playwright.shared';

/**
 * Playwright E2E configuration for OGrid.
 *
 * Tests run against all example apps:
 *   - React Fluent      on port 3001
 *   - React Material    on port 3002
 *   - React Radix       on port 3003
 *   - Angular Radix     on port 3010
 *   - Angular Material  on port 3011
 *   - Angular PrimeNG   on port 3012
 *   - Vue Radix         on port 3020
 *   - Vue Vuetify       on port 3021
 *   - Vue PrimeVue      on port 3022
 *   - Vanilla JS        on port 3030
 *
 * Each project shares the same test suite in e2e/  -  tests are parameterised
 * via baseURL so identical user-journeys are verified across every framework.
 */
const filteredProjectNames = process.env.OGRID_PLAYWRIGHT_PROJECTS
  ?.split(',')
  .map((project) => project.trim())
  .filter(Boolean);

const selectedProjects = filteredProjectNames?.length
  ? allBrowserProjects.filter((project) => filteredProjectNames.includes(project.name))
  : allBrowserProjects;

const selectedPorts = new Set(
  selectedProjects
    .map((project) => project.use?.baseURL)
    .filter((value): value is string => typeof value === 'string')
    .map((baseURL) => Number(new URL(baseURL).port)),
);

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
    ...defaultBrowserUse,
  },
  projects: selectedProjects,
  webServer: allBrowserServers.filter((server) => selectedPorts.has(server.port)),
});
