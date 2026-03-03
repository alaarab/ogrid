import { h } from 'vue';
import { createInlineCellEditor } from '@alaarab/ogrid-vue';

export type { CreateInlineCellEditorOptions } from '@alaarab/ogrid-vue';

export const InlineCellEditor = createInlineCellEditor({
  renderCheckbox: ({ checked, onChange, onCancel }) =>
    h('input', {
      type: 'checkbox',
      checked,
      class: 'ogrid-checkbox',
      style: { width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--ogrid-accent, #0078d4)' },
      onChange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      },
    }),
});

export default InlineCellEditor;
