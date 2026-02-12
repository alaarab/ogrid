import { defineComponent, h, type PropType, computed } from 'vue';
import {
  useOGrid,
  type IOGridProps,
  type IOGridDataGridProps,
} from '@alaarab/ogrid-vue';
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';
import { PaginationControls } from '../PaginationControls/PaginationControls';

export const OGrid = defineComponent({
  name: 'OGrid',
  props: {
    gridProps: { type: Object as PropType<IOGridProps<unknown>>, required: true },
  },
  setup(props, { expose }) {
    const propsRef = computed(() => props.gridProps);
    const { dataGridProps, pagination, columnChooser, layout, api } = useOGrid(propsRef);

    // Expose the API for parent refs
    expose({ api: api.value });

    return () => {
      const sideBar = layout.value.sideBarProps;

      // Toolbar
      const toolbarChildren: any[] = [];
      if (layout.value.toolbar) {
        toolbarChildren.push(layout.value.toolbar);
      }

      // ColumnChooser in toolbar
      const toolbarEnd = columnChooser.value.placement === 'toolbar'
        ? h(ColumnChooser, {
            columns: columnChooser.value.columns,
            visibleColumns: columnChooser.value.visibleColumns,
            onVisibilityChange: columnChooser.value.onVisibilityChange,
          })
        : null;

      // Pagination
      const paginationNode = h(PaginationControls, {
        currentPage: pagination.value.page,
        pageSize: pagination.value.pageSize,
        totalCount: pagination.value.displayTotalCount,
        onPageChange: pagination.value.setPage,
        onPageSizeChange: (size: number) => {
          pagination.value.setPageSize(size);
          pagination.value.setPage(1);
        },
        pageSizeOptions: pagination.value.pageSizeOptions,
        entityLabelPlural: pagination.value.entityLabelPlural,
      });

      return h('div', {
        class: layout.value.className,
        style: {
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: '4px',
          overflow: 'hidden',
        },
      }, [
        // Toolbar strip
        ...(toolbarChildren.length || toolbarEnd ? [
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(0,0,0,0.12)',
              gap: '8px',
            },
          }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1' } }, toolbarChildren),
            ...(toolbarEnd ? [toolbarEnd] : []),
          ]),
        ] : []),

        // Below toolbar strip
        ...(layout.value.toolbarBelow ? [
          h('div', {
            style: { padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' },
          }, [layout.value.toolbarBelow as any]),
        ] : []),

        // Main content area (sidebar + grid)
        h('div', { style: { display: 'flex', flex: '1', minHeight: '0' } }, [
          // DataGridTable
          h(DataGridTable, {
            gridProps: dataGridProps.value as IOGridDataGridProps<unknown>,
          }),
        ]),

        // Footer strip (pagination)
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '8px 0',
            borderTop: '1px solid rgba(0,0,0,0.12)',
          },
        }, [paginationNode]),
      ]);
    };
  },
});
