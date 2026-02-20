import { defineComponent, h, type PropType, type Component } from 'vue';
import { VBtn, VTextField } from 'vuetify/components';
const _VBtn = VBtn as Component;
const _VTextField = VTextField as Component;

export const TextFilterPopover = defineComponent({
  name: 'TextFilterPopover',
  props: {
    value: { type: String, required: true },
    onValueChange: { type: Function as PropType<(value: string) => void>, required: true },
    onApply: { type: Function as PropType<() => void>, required: true },
    onClear: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    return () =>
      h('div', { style: { width: '260px' } }, [
        h('div', { style: { padding: '12px' } },
          h(_VTextField, {
            modelValue: props.value,
            'onUpdate:modelValue': (v: string) => props.onValueChange(v),
            placeholder: 'Enter search term...',
            density: 'compact',
            variant: 'outlined',
            hideDetails: true,
            autocomplete: 'off',
            prependInnerIcon: 'mdi-magnify',
            onKeydown: (e: KeyboardEvent) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                props.onApply();
              }
            },
          })
        ),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '0 12px 12px' } }, [
          h(_VBtn, { size: 'small', variant: 'text', disabled: !props.value, onClick: props.onClear }, () => 'Clear'),
          h(_VBtn, { size: 'small', variant: 'flat', color: 'primary', onClick: props.onApply }, () => 'Apply'),
        ]),
      ]);
  },
});
