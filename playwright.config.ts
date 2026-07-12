import { defineConfig, devices } from '@playwright/test';
import { allBrowserProjects, allBrowserServers, defaultBrowserUse } from './playwright.shared';

/**
 * Playwright E2E configuration for OGrid.
 *
 * Tests run against the example apps defined in playwright.shared.ts:
 *   - React Fluent  on port 3001
 *   - React Radix   on port 3003
 *
 * Both projects share the same test suite in e2e/  -  tests are parameterised
 * via baseURL so identical user-journeys are verified across both UI kits.
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
