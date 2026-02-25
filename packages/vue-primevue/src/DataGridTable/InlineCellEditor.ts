import { h, type Component } from 'vue';
import Checkbox from 'primevue/checkbox';
import DatePicker from 'primevue/datepicker';
import { createInlineCellEditor } from '@alaarab/ogrid-vue';

const _Checkbox = Checkbox as Component;
const _DatePicker = DatePicker as Component;

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

  renderDatePicker: ({ value, onChange, onCancel }) => {
    let dateVal: Date | null = null;
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        dateVal = d;
      }
    }
    return h(_DatePicker, {
      modelValue: dateVal,
      dateFormat: 'yy-mm-dd',
      showIcon: false,
      style: { width: '100%' },
      onVnodeMounted: (vnode: unknown) => {
        try {
          const node = vnode as { component?: { proxy?: { show?: () => void } } };
          node.component?.proxy?.show?.();
        } catch { /* PrimeVue version may not support programmatic show */ }
      },
      'onUpdate:modelValue': (v: Date | null) => {
        if (v) {
          onChange(v.toISOString().slice(0, 10));
        }
      },
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      },
    });
  },
});
