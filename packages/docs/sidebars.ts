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
        'features/formulas',
        'features/spreadsheet-selection',
        'features/row-selection',
        'features/column-groups',
        'features/column-pinning',
        'features/column-reordering',
        'features/column-chooser',
        'features/column-types',
        'features/cell-references',
        'features/toolbar',
        'features/sidebar',
        'features/context-menu',
        'features/status-bar',
        'features/csv-export',
        'features/server-side-data',
        'features/keyboard-navigation',
        'features/mobile-touch',
        'features/virtual-scrolling',
        'features/responsive-columns',
        'features/performance',
        'features/grid-api',
        'features/premium-inputs',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/controlled-vs-uncontrolled',
        'guides/custom-cell-editors',
        'guides/theming',
        'guides/accessibility',
        'guides/migration-from-ag-grid',
        'guides/mcp',
        'guides/mcp-live-testing',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/ogrid-props',
        'api/column-def',
        'api/grid-api',
        'api/types',
        {
          type: 'category',
          label: 'Components',
          items: [
            'api/components-datagrid-table',
            'api/components-column-header-filter',
            'api/components-column-chooser',
            'api/components-pagination-controls',
            'api/components-sidebar',
            'api/components-status-bar',
          ],
        },
      ],
    },
  ],
};

export default sidebars;
