import type { PlaywrightTestConfig } from '@playwright/test';

type BrowserProject = NonNullable<PlaywrightTestConfig['projects']>[number];
type BrowserServer = NonNullable<PlaywrightTestConfig['webServer']>[number];

function createProject(name: string, baseURL: string): BrowserProject {
  return {
    name,
    use: { baseURL },
    testIgnore: ['e2e/docsHomepage.spec.ts'],
  };
}

// The examples are served as production builds (vite build + vite preview).
// In dev, Vite pre-bundles every @fluentui/react-icons icon into one ~17 MB
// module that each test's fresh browser context re-downloads and parses, so a
// Fluent page took ~2.5 s to load (Radix ~0.5 s) and timed out under load. The
// built Fluent page is ~1.9 MB. The timeout covers the build before preview
// starts listening. A dev server already running on the port is reused.
function createServer(command: string, port: number): BrowserServer {
  return {
    command,
    port,
    reuseExistingServer: true,
    timeout: 180_000,
  };
}

export const defaultBrowserUse = {
  headless: true,
  screenshot: 'only-on-failure' as const,
  trace: 'retain-on-failure' as const,
  viewport: { width: 1280, height: 800 },
};

export const allBrowserProjects: BrowserProject[] = [
  createProject('react-fluent', 'http://localhost:3001'),
  createProject('react-radix', 'http://localhost:3003'),
];

export const allBrowserServers: BrowserServer[] = [
  createServer('npm run serve:e2e:react-fluent', 3001),
  createServer('npm run serve:e2e:react-radix', 3003),
];

// Both kits run the smoke suite on every PR so Fluent regressions surface
// before merge, not only in the manual full matrix.
export const smokeBrowserProjects: BrowserProject[] = allBrowserProjects;

export const smokeBrowserServers: BrowserServer[] = allBrowserServers;
