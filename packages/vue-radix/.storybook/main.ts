import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/vue3-vite';
import { mergeConfig } from 'vite';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  framework: {
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      css: {
        modules: {
          localsConvention: 'camelCase',
        },
        preprocessorOptions: {
          scss: {
            api: 'modern-compiler',
          },
        },
      },
    });
  },
};

export default config;

function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}
