import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['docsHomepage.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000/ogrid/',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'docs-homepage',
    },
  ],
  webServer: {
    command: 'npm run serve -w @alaarab/ogrid-docs -- --host 127.0.0.1 --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
