import { defineComponent, h, type PropType, type Component } from 'vue';
import InputText from 'primevue/inputtext';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';

const _InputText = InputText as Component;
const _Checkbox = Checkbox as Component;
const _Button = Button as Component;
const _ProgressSpinner = ProgressSpinner as Component;

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
          h(_InputText, {
            modelValue: props.searchText,
            'onUpdate:modelValue': (v: string) => props.onSearchChange(v),
            placeholder: 'Search...',
            style: { width: '100%' },
            onKeydown: (e: KeyboardEvent) => e.stopPropagation(),
          }),
          h('span', {
            style: { display: 'block', marginTop: '4px', fontSize: '0.75rem', color: 'rgba(0,0,0,0.6)' },
          }, `${props.filteredOptions.length} of ${props.options.length} options`),
        ]),

        // Select all / clear
        h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 12px' } }, [
          h(_Button, { size: 'small', severity: 'secondary', text: true, label: `Select All (${props.filteredOptions.length})`, onClick: props.onSelectAll }),
          h(_Button, { size: 'small', severity: 'secondary', text: true, label: 'Clear', onClick: props.onClearSelection }),
        ]),

        // Options list
        h('div', { style: { maxHeight: '240px', overflowY: 'auto', padding: '0 4px' } },
          props.isLoading
            ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: '16px 0' } },
                h(_ProgressSpinner, { style: { width: '24px', height: '24px' } }))
            : props.filteredOptions.length === 0
              ? h('div', { style: { padding: '16px 0', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' } }, 'No options found')
              : props.filteredOptions.map((option) =>
                  h('div', { key: option, style: { display: 'flex', alignItems: 'center', minHeight: '32px', gap: '8px', padding: '2px 8px' } }, [
                    h(_Checkbox, {
                      modelValue: props.selected.has(option),
                      binary: true,
                      inputId: `filter-opt-${option}`,
                      'onUpdate:modelValue': (checked: boolean) => props.onOptionToggle(option, checked),
                    }),
                    h('label', {
                      for: `filter-opt-${option}`,
                      style: { cursor: 'pointer', fontSize: '0.875rem' },
                    }, option),
                  ])
                )
        ),

        // Footer
        h('div', { style: { borderTop: '1px solid rgba(0,0,0,0.12)' } }),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '8px 12px' } }, [
          h(_Button, { size: 'small', severity: 'secondary', text: true, label: 'Clear', onClick: props.onClearSelection }),
          h(_Button, { size: 'small', label: 'Apply', onClick: props.onApply }),
        ]),
      ]);
  },
});
