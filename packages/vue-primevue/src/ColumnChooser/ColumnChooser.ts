import { defineComponent, ref, computed, h, type PropType } from 'vue';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Checkbox from 'primevue/checkbox';
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
    const popoverRef = ref<InstanceType<typeof Popover> | null>(null);
    const isOpen = ref(false);
    const columnsRef = computed(() => props.columns);
    const visibleColumnsRef = computed(() => props.visibleColumns);

    const state = useColumnChooserState({
      columns: columnsRef,
      visibleColumns: visibleColumnsRef,
      onVisibilityChange: props.onVisibilityChange,
    });

    const toggle = (event: Event) => {
      popoverRef.value?.toggle(event);
      isOpen.value = !isOpen.value;
    };

    return () => {
      return h('div', { style: { position: 'relative', display: 'inline-block' } }, [
        // Trigger button
        h(Button, {
          size: 'small',
          outlined: true,
          icon: 'pi pi-th-large',
          label: `Column Visibility (${state.visibleCount.value} of ${state.totalCount.value})`,
          onClick: toggle,
        }),

        // Popover
        h(Popover, {
          ref: (el: unknown) => { popoverRef.value = el as InstanceType<typeof Popover>; },
        }, {
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
            }, `Select Columns (${state.visibleCount} of ${state.totalCount})`),

            // Column list
            h('div', { style: { maxHeight: '320px', overflowY: 'auto', padding: '4px 0' } },
              props.columns.map((column) =>
                h('div', {
                  key: column.columnId,
                  style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', minHeight: '32px' },
                }, [
                  h(Checkbox, {
                    modelValue: props.visibleColumns.has(column.columnId),
                    binary: true,
                    inputId: `col-${column.columnId}`,
                    'onUpdate:modelValue': (checked: boolean) =>
                      state.handleCheckboxChange(column.columnId)(checked),
                  }),
                  h('label', {
                    for: `col-${column.columnId}`,
                    style: { cursor: 'pointer', fontSize: '0.875rem' },
                  }, column.name),
                ])
              )
            ),

            // Footer with actions
            h('div', { style: { height: '1px', backgroundColor: 'rgba(0,0,0,0.12)' } }),
            h('div', {
              style: {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: 'rgba(0,0,0,0.04)',
              },
            }, [
              h(Button, { size: 'small', text: true, onClick: state.handleClearAll }, () => 'Clear All'),
              h(Button, { size: 'small', onClick: state.handleSelectAll }, () => 'Select All'),
            ]),
          ]),
        }),
      ]);
    };
  },
});
