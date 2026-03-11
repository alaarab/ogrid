import { spawnSync } from 'node:child_process';

const projects = [
  'react-fluent',
  'react-material',
  'react-radix',
  'angular-radix',
  'angular-material',
  'angular-primeng',
  'vue-radix',
  'vue-vuetify',
  'vue-primevue',
  'js',
];
const passthroughArgs = process.argv.slice(2);

for (const project of projects) {
  const result = spawnSync(
    'npx',
    ['playwright', 'test', `--project=${project}`, ...passthroughArgs],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        OGRID_PLAYWRIGHT_PROJECTS: project,
      },
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
