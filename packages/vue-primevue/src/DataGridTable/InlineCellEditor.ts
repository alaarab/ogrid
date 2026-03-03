import { h, type Component } from 'vue';
import Checkbox from 'primevue/checkbox';
import { createInlineCellEditor } from '@alaarab/ogrid-vue';

const _Checkbox = Checkbox as Component;

export type { CreateInlineCellEditorOptions } from '@alaarab/ogrid-vue';

export const InlineCellEditor = createInlineCellEditor({
  renderCheckbox: ({ checked, onChange, onCancel }) =>
    h(_Checkbox, {
      modelValue: checked,
      binary: true,
      'aria-label': 'Toggle value',
      'onUpdate:modelValue': (c: boolean) => onChange(c),
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      },
    }),
});
