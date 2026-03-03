// This file has been automatically migrated to valid ESM format by Storybook.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      optimizeDeps: {
        // Don't prebundle workspace packages so source changes take effect immediately
        exclude: ['@alaarab/ogrid-core', '@alaarab/ogrid-react'],
      },
      resolve: {
        alias: {
          // Force single React instance to avoid "Cannot read properties of null" errors
          react: dirname(require.resolve('react')),
          'react-dom': dirname(require.resolve('react-dom')),
        },
      },
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
  return dirname(require.resolve(join(value, "package.json")));
}
