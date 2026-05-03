import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';
import path from 'path';

const config: Config = {
  title: 'OGrid',
  tagline: 'The open-source data grid for React and vanilla JS.',
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
                '@alaarab/ogrid-react-fluent': path.resolve(__dirname, '../react-fluent/dist/esm'),
                '@alaarab/ogrid-react-material': path.resolve(__dirname, '../react-material/dist/esm'),
                '@alaarab/ogrid-js/styles': path.resolve(__dirname, '../js/styles/ogrid.css'),
                '@alaarab/ogrid-js': path.resolve(__dirname, '../js/dist/esm'),
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
    // OpenGraph
    {
      tagName: 'meta',
      attributes: { property: 'og:type', content: 'website' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:site_name', content: 'OGrid' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image', content: 'https://alaarab.github.io/ogrid/img/og-image.png' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:width', content: '1200' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:height', content: '630' },
    },
    // Twitter Card
    {
      tagName: 'meta',
      attributes: { name: 'twitter:card', content: 'summary_large_image' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:image', content: 'https://alaarab.github.io/ogrid/img/og-image.png' },
    },
    // Structured data
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: 'OGrid',
        description: 'Free open-source data grid for React and vanilla JS. Sorting, filtering, editing, spreadsheet selection, clipboard, fill handle, formulas, and more.',
        url: 'https://alaarab.github.io/ogrid/',
        codeRepository: 'https://github.com/alaarab/ogrid',
        programmingLanguage: ['TypeScript', 'JavaScript'],
        runtimePlatform: ['React', 'Vanilla JS'],
        license: 'https://opensource.org/licenses/MIT',
        author: {
          '@type': 'Person',
          name: 'Ala Arab',
          url: 'https://github.com/alaarab',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      }),
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/alaarab/ogrid/tree/main/packages/docs/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.scss',
        },
        sitemap: {
          priority: 0.5,
          changefreq: 'weekly',
          filename: 'sitemap.xml',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    metadata: [
      { name: 'keywords', content: 'data grid, react data grid, javascript table, spreadsheet, MIT license, open source, AG Grid alternative' },
      { name: 'author', content: 'Ala Arab' },
    ],
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
          title: 'React',
          items: [
            { label: 'Radix UI (default)', href: 'https://npmjs.com/package/@alaarab/ogrid-react-radix' },
            { label: 'Fluent UI', href: 'https://npmjs.com/package/@alaarab/ogrid-react-fluent' },
            { label: 'Material UI', href: 'https://npmjs.com/package/@alaarab/ogrid-react-material' },
          ],
        },
        {
          title: 'JS',
          items: [
            { label: 'Vanilla JS', href: 'https://npmjs.com/package/@alaarab/ogrid-js' },
            { label: 'All packages', href: 'https://www.npmjs.com/search?q=%40alaarab%2Fogrid' },
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
