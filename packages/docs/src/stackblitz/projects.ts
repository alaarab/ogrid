import { DEMO_DATA_TS } from './demoData';

const OGRID_VERSION = '2.0.2';

interface ProjectDef {
  title: string;
  description: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  /** Entry HTML (defaults to a div#root or div#app) */
  entryHtml?: string;
}

/** Shape returned by factory functions — matches @stackblitz/sdk Project */
export interface StackBlitzProject {
  title: string;
  description: string;
  template: 'node';
  files: Record<string, string>;
}

// ── Helpers ──

function viteConfig(framework: 'react' | 'vue' | 'vanilla') {
  if (framework === 'react') {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
  }
  if (framework === 'vue') {
    return `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
});
`;
  }
  return `import { defineConfig } from 'vite';

export default defineConfig({});
`;
}

function tsconfig(jsx?: boolean) {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        ...(jsx ? { jsx: 'react-jsx' } : {}),
      },
      include: ['src'],
    },
    null,
    2,
  );
}

function packageJson(def: ProjectDef) {
  return JSON.stringify(
    {
      name: 'ogrid-stackblitz-demo',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
      },
      dependencies: def.dependencies,
      devDependencies: def.devDependencies ?? {},
    },
    null,
    2,
  );
}

function indexHtml(title: string, entryScript: string, body = '<div id="app"></div>') {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    ${body}
    <script type="module" src="${entryScript}"></script>
  </body>
</html>
`;
}

// ── React ──

export function createReactProject(code: string, title = 'OGrid React Demo'): StackBlitzProject {
  const def: ProjectDef = {
    title,
    description: 'OGrid data grid with React (Radix UI)',
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      [`@alaarab/ogrid-react-radix`]: OGRID_VERSION,
    },
    devDependencies: {
      vite: '^6.0.0',
      '@vitejs/plugin-react': '^4.3.0',
      typescript: '^5.7.0',
    },
    files: {},
  };

  return {
    title: def.title,
    description: def.description,
    template: 'node',
    files: {
      'package.json': packageJson(def),
      'tsconfig.json': tsconfig(true),
      'vite.config.ts': viteConfig('react'),
      'index.html': indexHtml(title, '/src/main.tsx'),
      'src/data.ts': DEMO_DATA_TS,
      'src/App.tsx': code,
      'src/main.tsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    },
  };
}

// ── Angular ──

export function createAngularProject(code: string, title = 'OGrid Angular Demo'): StackBlitzProject {
  const def: ProjectDef = {
    title,
    description: 'OGrid data grid with Angular (Angular Material)',
    dependencies: {
      '@angular/core': '^21.0.0',
      '@angular/common': '^21.0.0',
      '@angular/compiler': '^21.0.0',
      '@angular/platform-browser': '^21.0.0',
      '@angular/platform-browser-dynamic': '^21.0.0',
      '@angular/material': '^21.0.0',
      '@angular/cdk': '^21.0.0',
      '@angular/forms': '^21.0.0',
      rxjs: '^7.8.0',
      'zone.js': '^0.15.0',
      [`@alaarab/ogrid-angular-material`]: OGRID_VERSION,
    },
    devDependencies: {
      typescript: '^5.7.0',
      '@angular/cli': '^21.0.0',
      '@angular/compiler-cli': '^21.0.0',
      '@angular-devkit/build-angular': '^21.0.0',
    },
    files: {},
  };

  return {
    title: def.title,
    description: def.description,
    template: 'node',
    files: {
      'package.json': packageJson(def),
      'tsconfig.json': JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ES2022',
            moduleResolution: 'bundler',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            experimentalDecorators: true,
            useDefineForClassFields: false,
          },
          include: ['src'],
        },
        null,
        2,
      ),
      'angular.json': JSON.stringify(
        {
          $schema: './node_modules/@angular/cli/lib/config/schema.json',
          version: 1,
          projects: {
            demo: {
              root: '',
              sourceRoot: 'src',
              architect: {
                build: {
                  builder: '@angular-devkit/build-angular:application',
                  options: {
                    outputPath: 'dist',
                    index: 'src/index.html',
                    browser: 'src/main.ts',
                    tsConfig: 'tsconfig.json',
                  },
                },
                serve: {
                  builder: '@angular-devkit/build-angular:dev-server',
                  configurations: {
                    development: { buildTarget: 'demo:build' },
                  },
                  defaultConfiguration: 'development',
                },
              },
            },
          },
        },
        null,
        2,
      ),
      'src/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`,
      'src/main.ts': `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent);
`,
      'src/app/data.ts': DEMO_DATA_TS,
      'src/app/app.component.ts': code,
    },
  };
}

// ── Vue ──

export function createVueProject(code: string, title = 'OGrid Vue Demo'): StackBlitzProject {
  const def: ProjectDef = {
    title,
    description: 'OGrid data grid with Vue (Vuetify)',
    dependencies: {
      vue: '^3.5.0',
      vuetify: '^3.7.0',
      '@mdi/font': '^7.4.0',
      [`@alaarab/ogrid-vue-vuetify`]: OGRID_VERSION,
    },
    devDependencies: {
      vite: '^6.0.0',
      '@vitejs/plugin-vue': '^5.2.0',
      typescript: '^5.7.0',
    },
    files: {},
  };

  return {
    title: def.title,
    description: def.description,
    template: 'node',
    files: {
      'package.json': packageJson(def),
      'tsconfig.json': tsconfig(),
      'vite.config.ts': viteConfig('vue'),
      'index.html': indexHtml(title, '/src/main.ts'),
      'src/data.ts': DEMO_DATA_TS,
      'src/App.vue': code,
      'src/main.ts': `import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import App from './App.vue';

const vuetify = createVuetify();

createApp(App).use(vuetify).mount('#app');
`,
    },
  };
}

// ── Vanilla JS ──

export function createJSProject(code: string, title = 'OGrid Vanilla JS Demo'): StackBlitzProject {
  const def: ProjectDef = {
    title,
    description: 'OGrid data grid with vanilla JavaScript',
    dependencies: {
      [`@alaarab/ogrid-js`]: OGRID_VERSION,
    },
    devDependencies: {
      vite: '^6.0.0',
      typescript: '^5.7.0',
    },
    files: {},
  };

  return {
    title: def.title,
    description: def.description,
    template: 'node',
    files: {
      'package.json': packageJson(def),
      'tsconfig.json': tsconfig(),
      'vite.config.ts': viteConfig('vanilla'),
      'index.html': indexHtml(title, '/src/main.ts', '<div id="grid" style="height:500px"></div>'),
      'src/data.ts': DEMO_DATA_TS,
      'src/main.ts': code,
    },
  };
}
