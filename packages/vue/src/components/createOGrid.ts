/**
 * Shared OGrid factory for Vue UI packages.
 *
 * Both vue-vuetify and vue-primevue OGrid components are 100% identical —
 * they only differ in which DataGridTable, ColumnChooser, and PaginationControls
 * components they use. This factory extracts all shared logic into one place.
 */
import { defineComponent, h, ref, onMounted, onUnmounted, type PropType, type VNode, computed, type Component } from 'vue';
import {
  useOGrid,
} from '../composables';
import type {
  IOGridProps,
  IOGridDataGridProps,
  SideBarPanelId,
} from '../types';
import type { SideBarProps } from './SideBar';

/** Framework-specific component bindings passed by each UI package */
export interface IOGridUIBindings {
  /** Package-local DataGridTable component */
  DataGridTable: Component;
  /** Package-local ColumnChooser component */
  ColumnChooser: Component;
  /** Package-local PaginationControls component */
  PaginationControls: Component;
}

// --- SideBar constants and styles ---
const PANEL_WIDTH = 240;
const TAB_WIDTH = 36;

const PANEL_LABELS: Record<SideBarPanelId, string> = {
  columns: 'Columns',
  filters: 'Filters',
};

const PANEL_ICONS: Record<SideBarPanelId, string> = {
  columns: '\u2261',  // hamburger icon
  filters: '\u2A65',  // filter icon
};

/** Render the SideBar inline (tab strip + panel content). */
function renderSideBar(sb: SideBarProps): VNode {
  const isOpen = sb.activePanel !== null;
  const position = sb.position ?? 'right';

  const tabStripStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    width: `${TAB_WIDTH}px`,
    background: 'var(--ogrid-header-bg, #f5f5f5)',
    ...(position === 'right'
      ? { borderLeft: '1px solid var(--ogrid-border, #e0e0e0)' }
      : { borderRight: '1px solid var(--ogrid-border, #e0e0e0)' }),
  };

  const tabStrip = h('div', { style: tabStripStyle, role: 'tablist', 'aria-label': 'Side bar tabs' },
    sb.panels.map((panel) =>
      h('button', {
        key: panel,
        role: 'tab',
        'aria-selected': sb.activePanel === panel,
        'aria-label': PANEL_LABELS[panel],
        title: PANEL_LABELS[panel],
        onClick: () => sb.onPanelChange(sb.activePanel === panel ? null : panel),
        style: {
          width: `${TAB_WIDTH}px`,
          height: `${TAB_WIDTH}px`,
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ogrid-fg, #242424)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: sb.activePanel === panel ? 'var(--ogrid-bg, #fff)' : 'transparent',
          fontWeight: sb.activePanel === panel ? 'bold' : 'normal',
        },
      }, PANEL_ICONS[panel])
    )
  );

  let panelContent: VNode | null = null;
  if (isOpen && sb.activePanel) {
    const panelContainerStyle = {
      width: `${PANEL_WIDTH}px`,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      background: 'var(--ogrid-bg, #fff)',
      color: 'var(--ogrid-fg, #242424)',
      ...(position === 'right'
        ? { borderLeft: '1px solid var(--ogrid-border, #e0e0e0)' }
        : { borderRight: '1px solid var(--ogrid-border, #e0e0e0)' }),
    };

    const panelBodyChildren: VNode[] = [];

    if (sb.activePanel === 'columns') {
      const allVisible = sb.columns.every((c) => sb.visibleColumns.has(c.columnId));
      // Select All / Clear All buttons
      panelBodyChildren.push(
        h('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } }, [
          h('button', {
            disabled: allVisible,
            onClick: () => {
              const next = new Set(sb.visibleColumns);
              sb.columns.forEach((c) => next.add(c.columnId));
              sb.onSetVisibleColumns(next);
            },
            style: { flex: '1', cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px', padding: '4px 8px' },
          }, 'Select All'),
          h('button', {
            onClick: () => {
              const next = new Set<string>();
              sb.columns.forEach((c) => {
                if (c.required && sb.visibleColumns.has(c.columnId)) next.add(c.columnId);
              });
              sb.onSetVisibleColumns(next);
            },
            style: { flex: '1', cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px', padding: '4px 8px' },
          }, 'Clear All'),
        ])
      );
      // Column checkboxes
      sb.columns.forEach((col) => {
        panelBodyChildren.push(
          h('label', { key: col.columnId, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', cursor: 'pointer' } }, [
            h('input', {
              type: 'checkbox',
              checked: sb.visibleColumns.has(col.columnId),
              disabled: col.required,
              onChange: (e: Event) => sb.onVisibilityChange(col.columnId, (e.target as HTMLInputElement).checked),
            }),
            h('span', null, col.name),
          ])
        );
      });
    }

    if (sb.activePanel === 'filters') {
      if (sb.filterableColumns.length === 0) {
        panelBodyChildren.push(
          h('div', { style: { color: 'var(--ogrid-muted, #999)', fontStyle: 'italic' } }, 'No filterable columns')
        );
      } else {
        sb.filterableColumns.forEach((col) => {
          const filterKey = col.filterField;
          const groupChildren: VNode[] = [
            h('div', { style: { fontWeight: '500', marginBottom: '4px', fontSize: '13px' } }, col.name),
          ];
          if (col.filterType === 'text') {
            const filterEntry = sb.filters[filterKey];
            const currentVal = filterEntry?.type === 'text' ? filterEntry.value : '';
            groupChildren.push(
              h('input', {
                type: 'text',
                value: currentVal,
                onInput: (e: Event) => {
                  const val = (e.target as HTMLInputElement).value;
                  sb.onFilterChange(filterKey, val ? { type: 'text', value: val } : undefined);
                },
                placeholder: `Filter ${col.name}...`,
                'aria-label': `Filter ${col.name}`,
                style: { width: '100%', boxSizing: 'border-box', padding: '4px 6px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' },
              })
            );
          }
          if (col.filterType === 'multiSelect') {
            const options = sb.filterOptions[filterKey] ?? [];
            const msChildren = options.map((opt) => {
              const msFilter = sb.filters[filterKey];
              const selected = msFilter?.type === 'multiSelect' ? msFilter.value.includes(opt) : false;
              return h('label', { key: opt, style: { display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 0', cursor: 'pointer', fontSize: '13px' } }, [
                h('input', {
                  type: 'checkbox',
                  checked: selected,
                  onChange: (e: Event) => {
                    const curFilter = sb.filters[filterKey];
                    const current = curFilter?.type === 'multiSelect' ? curFilter.value : [];
                    const next = (e.target as HTMLInputElement).checked
                      ? [...current, opt]
                      : current.filter((v: string) => v !== opt);
                    sb.onFilterChange(filterKey, next.length > 0 ? { type: 'multiSelect', value: next } : undefined);
                  },
                }),
                h('span', null, opt),
              ]);
            });
            groupChildren.push(
              h('div', { style: { maxHeight: '120px', overflowY: 'auto' }, role: 'group', 'aria-label': `${col.name} options` }, msChildren)
            );
          }
          if (col.filterType === 'date') {
            const dateFilter = sb.filters[filterKey];
            const existingValue = dateFilter?.type === 'date' ? dateFilter.value : { from: undefined, to: undefined };
            groupChildren.push(
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
                h('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' } }, [
                  'From:',
                  h('input', {
                    type: 'date',
                    value: existingValue.from ?? '',
                    onInput: (e: Event) => {
                      const from = (e.target as HTMLInputElement).value || undefined;
                      const to = existingValue.to;
                      sb.onFilterChange(filterKey, from || to ? { type: 'date', value: { from, to } } : undefined);
                    },
                    'aria-label': `${col.name} from date`,
                    style: { flex: '1', padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' },
                  }),
                ]),
                h('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' } }, [
                  'To:',
                  h('input', {
                    type: 'date',
                    value: existingValue.to ?? '',
                    onInput: (e: Event) => {
                      const to = (e.target as HTMLInputElement).value || undefined;
                      const from = existingValue.from;
                      sb.onFilterChange(filterKey, from || to ? { type: 'date', value: { from, to } } : undefined);
                    },
                    'aria-label': `${col.name} to date`,
                    style: { flex: '1', padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' },
                  }),
                ]),
              ])
            );
          }
          panelBodyChildren.push(
            h('div', { key: col.columnId, style: { marginBottom: '12px' } }, groupChildren)
          );
        });
      }
    }

    panelContent = h('div', { role: 'tabpanel', 'aria-label': PANEL_LABELS[sb.activePanel], style: panelContainerStyle }, [
      // Panel header
      h('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
          fontWeight: '600',
        },
      }, [
        h('span', null, PANEL_LABELS[sb.activePanel]),
        h('button', {
          onClick: () => sb.onPanelChange(null),
          style: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: 'var(--ogrid-fg, #242424)' },
          'aria-label': 'Close panel',
        }, '\u00D7'),
      ]),
      // Panel body
      h('div', { style: { flex: '1', overflowY: 'auto', padding: '8px 12px' } }, panelBodyChildren),
    ]);
  }

  const children: VNode[] = [];
  if (position === 'left') {
    children.push(tabStrip);
    if (panelContent) children.push(panelContent);
  } else {
    if (panelContent) children.push(panelContent);
    children.push(tabStrip);
  }

  return h('div', {
    style: { display: 'flex', flexDirection: 'row', flexShrink: '0' },
    role: 'complementary',
    'aria-label': 'Side bar',
  }, children);
}

/**
 * Creates an OGrid component with framework-specific UI bindings.
 * All orchestration logic, sidebar, toolbar, and layout are shared.
 */
export function createOGrid(ui: IOGridUIBindings) {
  return defineComponent({
    name: 'OGrid',
    props: {
      gridProps: { type: Object as PropType<IOGridProps<unknown>>, required: true },
    },
    setup(props, { expose }) {
      const propsRef = computed(() => props.gridProps);
      const { dataGridProps, pagination, columnChooser, layout, api } = useOGrid(propsRef);

      // Expose the ref container so parent always gets the latest API value
      expose({ api });

      // Fullscreen state
      const isFullScreen = ref(false);
      const toggleFullScreen = () => { isFullScreen.value = !isFullScreen.value; };

      // ESC key to exit fullscreen
      const handleEscKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isFullScreen.value) isFullScreen.value = false;
      };
      onMounted(() => { document.addEventListener('keydown', handleEscKey); });
      onUnmounted(() => { document.removeEventListener('keydown', handleEscKey); });

      return () => {
        const sideBar = layout.value.sideBarProps;
        const hasSideBar = sideBar != null;
        const sideBarPosition = sideBar?.position ?? 'right';

        // Toolbar
        const toolbarChildren: VNode[] = [];
        if (layout.value.toolbar) {
          toolbarChildren.push(layout.value.toolbar as VNode);
        }

        // Fullscreen toggle button
        const showFullScreen = layout.value.fullScreen === true;
        const fullscreenButton = showFullScreen
          ? h('button', {
              type: 'button',
              title: isFullScreen.value ? 'Exit fullscreen' : 'Fullscreen',
              'aria-label': isFullScreen.value ? 'Exit fullscreen' : 'Fullscreen',
              onClick: toggleFullScreen,
              style: {
                background: 'none',
                border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
                borderRadius: '4px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ogrid-fg, rgba(0,0,0,0.87))',
              },
            }, [
              isFullScreen.value
                ? h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', innerHTML: '<polyline points="4 10 0 10 0 14"/><polyline points="12 6 16 6 16 2"/><line x1="0" y1="10" x2="4" y2="6"/><line x1="16" y1="6" x2="12" y2="10"/>' })
                : h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', innerHTML: '<polyline points="10 2 14 2 14 6"/><polyline points="6 14 2 14 2 10"/><line x1="14" y1="2" x2="10" y2="6"/><line x1="2" y1="14" x2="6" y2="10"/>' }),
            ])
          : null;

        // ColumnChooser in toolbar
        const toolbarEnd = columnChooser.value.placement === 'toolbar'
          ? h(ui.ColumnChooser, {
              columns: columnChooser.value.columns,
              visibleColumns: columnChooser.value.visibleColumns,
              onVisibilityChange: columnChooser.value.onVisibilityChange,
            })
          : null;

        // Pagination
        const paginationNode = h(ui.PaginationControls, {
          currentPage: pagination.value.page,
          pageSize: pagination.value.pageSize,
          totalCount: pagination.value.displayTotalCount,
          onPageChange: pagination.value.setPage,
          onPageSizeChange: (size: number) => {
            pagination.value.setPageSize(size);
          },
          pageSizeOptions: pagination.value.pageSizeOptions,
          entityLabelPlural: pagination.value.entityLabelPlural,
        });

        // Grid content area
        const gridChild = h('div', {
          style: { flex: '1', minWidth: '0', minHeight: '0', display: 'flex', flexDirection: 'column' },
        }, [
          h(ui.DataGridTable, {
            gridProps: dataGridProps.value as IOGridDataGridProps<unknown>,
          }),
        ]);

        // Main content area (sidebar + grid)
        const mainAreaChildren: VNode[] = [];
        if (hasSideBar && sideBarPosition === 'left') {
          mainAreaChildren.push(renderSideBar(sideBar));
        }
        mainAreaChildren.push(gridChild);
        if (hasSideBar && sideBarPosition !== 'left') {
          mainAreaChildren.push(renderSideBar(sideBar));
        }

        const hasToolbar = toolbarChildren.length > 0 || toolbarEnd != null || fullscreenButton != null;

        const rootStyle = isFullScreen.value
          ? { position: 'fixed' as const, inset: '0', zIndex: 9999, display: 'flex', flexDirection: 'column' as const, background: 'var(--ogrid-bg, #fff)' }
          : { display: 'flex', flexDirection: 'column' as const, border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))', borderRadius: '4px', overflow: 'hidden' as const };

        const containerStyle = isFullScreen.value
          ? { display: 'flex', flexDirection: 'column' as const, flex: '1', minHeight: '0', overflow: 'hidden' as const, background: 'var(--ogrid-bg, #fff)' }
          : undefined;

        return h('div', {
          class: layout.value.className,
          style: rootStyle,
        }, [
          // Inner container (for fullscreen: no border/radius)
          h('div', { style: containerStyle ?? {} }, [
          // Toolbar strip
          ...(hasToolbar ? [
            h('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
                gap: '8px',
              },
            }, [
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1' } }, toolbarChildren),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                ...(toolbarEnd ? [toolbarEnd] : []),
                ...(fullscreenButton ? [fullscreenButton] : []),
              ]),
            ]),
          ] : []),

          // Below toolbar strip
          ...(layout.value.toolbarBelow ? [
            h('div', {
              style: { padding: '8px 12px', borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))' },
            }, [layout.value.toolbarBelow as VNode]),
          ] : []),

          // Formula bar (between toolbar and grid)
          ...(layout.value.formulaBar ? [layout.value.formulaBar as VNode] : []),

          // Main content area (sidebar + grid)
          h('div', { style: { display: 'flex', flex: '1', minHeight: '0' } }, mainAreaChildren),

          // Footer strip (pagination)
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
            },
          }, [paginationNode]),
          ]),
        ]);
      };
    },
  });
}
