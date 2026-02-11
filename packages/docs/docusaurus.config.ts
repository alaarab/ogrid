import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';
import path from 'path';

const config: Config = {
  title: 'OGrid',
  tagline: 'The lightweight, framework-agnostic React data grid.',
  favicon: 'img/favicon.svg',
  url: 'https://alaarab.github.io',
  baseUrl: '/ogrid/',
  organizationName: 'alaarab',
  projectName: 'ogrid',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],
  i18n: { defaultLocale: 'en', locales: ['en'] },

  plugins: [
    'docusaurus-plugin-sass',
    function resolveMonorepoPackages() {
      return {
        name: 'resolve-monorepo-packages',
        configureWebpack() {
          return {
            resolve: {
              alias: {
                '@alaarab/ogrid-core': path.resolve(__dirname, '../core/dist/esm'),
                '@alaarab/ogrid-react': path.resolve(__dirname, '../react/dist/esm'),
                '@alaarab/ogrid-react-radix': path.resolve(__dirname, '../react-radix/dist/esm'),
              },
            },
          };
        },
      };
    },
  ],

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/alaarab/ogrid/tree/main/packages/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.scss',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'OGrid',
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        { to: '/docs/api/ogrid-props', label: 'API', position: 'left' },
        {
          href: 'https://github.com/alaarab/ogrid',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@alaarab/ogrid-react-radix',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started/overview' },
            { label: 'Features', to: '/docs/features/sorting' },
            { label: 'API Reference', to: '/docs/api/ogrid-props' },
          ],
        },
        {
          title: 'Packages',
          items: [
            { label: '@alaarab/ogrid-core', href: 'https://npmjs.com/package/@alaarab/ogrid-core' },
            { label: '@alaarab/ogrid-react', href: 'https://npmjs.com/package/@alaarab/ogrid-react' },
            { label: '@alaarab/ogrid-react-radix', href: 'https://npmjs.com/package/@alaarab/ogrid-react-radix' },
            { label: '@alaarab/ogrid-react-fluent', href: 'https://npmjs.com/package/@alaarab/ogrid-react-fluent' },
            { label: '@alaarab/ogrid-react-material', href: 'https://npmjs.com/package/@alaarab/ogrid-react-material' },
            { label: '@alaarab/ogrid-js', href: 'https://npmjs.com/package/@alaarab/ogrid-js' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub', href: 'https://github.com/alaarab/ogrid' },
            { label: 'Changelog', href: 'https://github.com/alaarab/ogrid/blob/main/CHANGELOG.md' },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Ala Arab. MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
