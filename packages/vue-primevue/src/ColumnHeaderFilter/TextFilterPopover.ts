import { defineComponent, h, type PropType } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const _InputText = InputText as any;
const _Button = Button as any;

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
          h(_InputText, {
            modelValue: props.value,
            'onUpdate:modelValue': (v: string) => props.onValueChange(v),
            placeholder: 'Enter search term...',
            style: { width: '100%' },
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
          h(_Button, { size: 'small', severity: 'secondary', text: true, disabled: !props.value, label: 'Clear', onClick: props.onClear }),
          h(_Button, { size: 'small', label: 'Apply', onClick: props.onApply }),
        ]),
      ]);
  },
});
