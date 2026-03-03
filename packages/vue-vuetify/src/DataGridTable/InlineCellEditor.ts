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

  renderDatePicker: ({ value, onChange, onCancel }) =>
    h('input', {
      type: 'text',
      value,
      style: { width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 4px', fontSize: 'inherit' },
      onVnodeMounted: (vnode: { el: unknown }) => {
        const el = vnode.el as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
      },
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); onChange((e.target as HTMLInputElement).value); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        if (e.key === 'Tab') { e.preventDefault(); onChange((e.target as HTMLInputElement).value); }
      },
      onBlur: (e: FocusEvent) => onChange((e.target as HTMLInputElement).value),
    }),
});
