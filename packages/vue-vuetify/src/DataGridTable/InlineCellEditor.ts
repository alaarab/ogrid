import { h, type Component } from 'vue';
import { VCheckbox } from 'vuetify/components';
import { createInlineCellEditor } from '@alaarab/ogrid-vue';

export type { CreateInlineCellEditorOptions } from '@alaarab/ogrid-vue';

export const InlineCellEditor = createInlineCellEditor({
  renderCheckbox: ({ checked, onChange, onCancel }) =>
    h(VCheckbox as Component, {
      modelValue: checked,
      hideDetails: true,
      density: 'compact',
      'onUpdate:modelValue': (c: boolean) => onChange(c),
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      },
    }),
});
