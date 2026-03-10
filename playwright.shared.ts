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
  createProject('react-material', 'http://localhost:3002'),
  createProject('react-radix', 'http://localhost:3003'),
  createProject('angular-radix', 'http://localhost:3010'),
  createProject('angular-material', 'http://localhost:3011'),
  createProject('angular-primeng', 'http://localhost:3012'),
  createProject('vue-radix', 'http://localhost:3020'),
  createProject('vue-vuetify', 'http://localhost:3021'),
  createProject('vue-primevue', 'http://localhost:3022'),
  createProject('js', 'http://localhost:3030'),
];

export const allBrowserServers: BrowserServer[] = [
  createServer('npm run dev:react-fluent', 3001),
  createServer('npm run dev:react-material', 3002),
  createServer('npm run dev:react-radix', 3003),
  createServer('npm run dev:angular-radix', 3010),
  createServer('npm run dev:angular-material', 3011),
  createServer('npm run dev:angular-primeng', 3012),
  createServer('npm run dev:vue-radix', 3020),
  createServer('npm run dev:vue-vuetify', 3021),
  createServer('npm run dev:vue-primevue', 3022),
  createServer('npm run dev:js', 3030),
];

export const smokeBrowserProjects: BrowserProject[] = [
  createProject('react-radix', 'http://localhost:3003'),
  createProject('angular-material', 'http://localhost:3011'),
  createProject('vue-vuetify', 'http://localhost:3021'),
  createProject('js', 'http://localhost:3030'),
];

export const smokeBrowserServers: BrowserServer[] = [
  createServer('npm run dev:react-radix', 3003),
  createServer('npm run dev:angular-material', 3011),
  createServer('npm run dev:vue-vuetify', 3021),
  createServer('npm run dev:js', 3030),
];
