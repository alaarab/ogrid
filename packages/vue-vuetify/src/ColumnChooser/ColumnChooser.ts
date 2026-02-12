import { defineComponent, ref, computed, h, type PropType } from 'vue';
import { VBtn, VMenu, VList, VListItem, VDivider } from 'vuetify/components';
import { useColumnChooserState, type IColumnDefinition } from '@alaarab/ogrid-vue';

export interface IColumnChooserProps {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
}

export const ColumnChooser = defineComponent({
  name: 'ColumnChooser',
  props: {
    columns: { type: Array as PropType<IColumnDefinition[]>, required: true },
    visibleColumns: { type: Object as PropType<Set<string>>, required: true },
    onVisibilityChange: { type: Function as PropType<(columnKey: string, visible: boolean) => void>, required: true },
  },
  setup(props) {
    const menuOpen = ref(false);
    const columnsRef = computed(() => props.columns);
    const visibleColumnsRef = computed(() => props.visibleColumns);

    const state = useColumnChooserState({
      columns: columnsRef,
      visibleColumns: visibleColumnsRef,
      onVisibilityChange: props.onVisibilityChange,
    });

    return () => {
      return h(VMenu as any, {
        modelValue: menuOpen.value,
        'onUpdate:modelValue': (v: boolean) => { menuOpen.value = v; },
        closeOnContentClick: false,
        location: 'bottom end',
      }, {
        activator: ({ props: activatorProps }: { props: Record<string, unknown> }) =>
          h(VBtn as any, {
            ...activatorProps,
            variant: 'outlined',
            size: 'small',
            prependIcon: 'mdi-view-column',
            appendIcon: menuOpen.value ? 'mdi-chevron-up' : 'mdi-chevron-down',
          }, () => `Column Visibility (${state.visibleCount.value} of ${state.totalCount.value})`),
        default: () => h('div', { style: { minWidth: '220px' } }, [
          // Header
          h('div', {
            style: {
              padding: '8px 12px',
              borderBottom: '1px solid rgba(0,0,0,0.12)',
              backgroundColor: 'rgba(0,0,0,0.04)',
              fontWeight: '600',
              fontSize: '0.875rem',
            },
          }, `Select Columns (${state.visibleCount.value} of ${state.totalCount.value})`),

          // Column list
          h(VList as any, { density: 'compact', style: { maxHeight: '320px', overflowY: 'auto' } },
            () => props.columns.map((column) =>
              h(VListItem as any, { key: column.columnId, style: { minHeight: '32px' } }, () =>
                h('label', {
                  style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: '100%' },
                }, [
                  h('input', {
                    type: 'checkbox',
                    checked: props.visibleColumns.has(column.columnId),
                    onChange: (e: Event) =>
                      state.handleCheckboxChange(column.columnId)((e.target as HTMLInputElement).checked),
                  }),
                  h('span', { style: { fontSize: '0.875rem' } }, column.name),
                ])
              )
            )
          ),

          // Footer with actions
          h(VDivider as any),
          h('div', {
            style: {
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'rgba(0,0,0,0.04)',
            },
          }, [
            h(VBtn as any, { size: 'small', variant: 'text', onClick: state.handleClearAll }, () => 'Clear All'),
            h(VBtn as any, { size: 'small', variant: 'flat', color: 'primary', onClick: state.handleSelectAll }, () => 'Select All'),
          ]),
        ]),
      });
    };
  },
});
