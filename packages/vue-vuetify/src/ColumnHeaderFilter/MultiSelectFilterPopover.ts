import { defineComponent, h, type PropType } from 'vue';
import { VBtn, VTextField, VCheckbox, VProgressCircular, VDivider } from 'vuetify/components';
const _VBtn = VBtn as any;
const _VTextField = VTextField as any;
const _VCheckbox = VCheckbox as any;
const _VProgressCircular = VProgressCircular as any;
const _VDivider = VDivider as any;

export const MultiSelectFilterPopover = defineComponent({
  name: 'MultiSelectFilterPopover',
  props: {
    searchText: { type: String, required: true },
    onSearchChange: { type: Function as PropType<(value: string) => void>, required: true },
    options: { type: Array as PropType<string[]>, required: true },
    filteredOptions: { type: Array as PropType<string[]>, required: true },
    selected: { type: Object as PropType<Set<string>>, required: true },
    onOptionToggle: { type: Function as PropType<(option: string, checked: boolean) => void>, required: true },
    onSelectAll: { type: Function as PropType<() => void>, required: true },
    onClearSelection: { type: Function as PropType<() => void>, required: true },
    onApply: { type: Function as PropType<() => void>, required: true },
    isLoading: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h('div', { style: { width: '280px' } }, [
        // Search
        h('div', { style: { padding: '12px 12px 4px' } }, [
          h(_VTextField, {
            modelValue: props.searchText,
            'onUpdate:modelValue': (v: string) => props.onSearchChange(v),
            placeholder: 'Search...',
            density: 'compact',
            variant: 'outlined',
            hideDetails: true,
            autocomplete: 'off',
            prependInnerIcon: 'mdi-magnify',
            onKeydown: (e: KeyboardEvent) => e.stopPropagation(),
          }),
          h('span', {
            style: { display: 'block', marginTop: '4px', fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)' },
          }, `${props.filteredOptions.length} of ${props.options.length} options`),
        ]),

        // Select all / clear
        h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 12px' } }, [
          h(_VBtn, { size: 'small', variant: 'text', onClick: props.onSelectAll },
            () => `Select All (${props.filteredOptions.length})`),
          h(_VBtn, { size: 'small', variant: 'text', onClick: props.onClearSelection }, () => 'Clear'),
        ]),

        // Options list
        h('div', { style: { maxHeight: '240px', overflowY: 'auto', padding: '0 4px' } },
          props.isLoading
            ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: '16px 0' } },
                h(_VProgressCircular, { size: 24, indeterminate: true }))
            : props.filteredOptions.length === 0
              ? h('div', { style: { padding: '16px 0', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' } }, 'No options found')
              : props.filteredOptions.map((option) =>
                  h('div', { key: option, style: { display: 'flex', alignItems: 'center', minHeight: '32px' } },
                    h(_VCheckbox, {
                      modelValue: props.selected.has(option),
                      label: option,
                      density: 'compact',
                      hideDetails: true,
                      'onUpdate:modelValue': (checked: boolean) => props.onOptionToggle(option, checked),
                    })
                  )
                )
        ),

        // Footer
        h(_VDivider),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '8px 12px' } }, [
          h(_VBtn, { size: 'small', variant: 'text', onClick: props.onClearSelection }, () => 'Clear'),
          h(_VBtn, { size: 'small', variant: 'flat', color: 'primary', onClick: props.onApply }, () => 'Apply'),
        ]),
      ]);
  },
});
