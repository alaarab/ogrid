import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/overview',
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/vanilla-js',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        'features/sorting',
        'features/filtering',
        'features/pagination',
        'features/editing',
        'features/spreadsheet-selection',
        'features/row-selection',
        'features/column-groups',
        'features/column-pinning',
        'features/column-chooser',
        'features/toolbar',
        'features/sidebar',
        'features/context-menu',
        'features/status-bar',
        'features/csv-export',
        'features/server-side-data',
        'features/keyboard-navigation',
        'features/grid-api',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/controlled-vs-uncontrolled',
        'guides/custom-cell-editors',
        'guides/theming',
        'guides/framework-showcase',
        'guides/migration-from-ag-grid',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/ogrid-props',
        'api/column-def',
        'api/grid-api',
        'api/js-api',
        'api/types',
      ],
    },
  ],
};

export default sidebars;
