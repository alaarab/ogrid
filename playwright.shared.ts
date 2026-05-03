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

function createServer(command: string, port: number): BrowserServer {
  return {
    command,
    port,
    reuseExistingServer: true,
    timeout: 30_000,
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
  createServer('npm run dev:react-fluent', 3001),
  createServer('npm run dev:react-radix', 3003),
];

export const smokeBrowserProjects: BrowserProject[] = [
  createProject('react-radix', 'http://localhost:3003'),
];

export const smokeBrowserServers: BrowserServer[] = [
  createServer('npm run dev:react-radix', 3003),
];
