import { h } from 'vue';
import Checkbox from 'primevue/checkbox';
import DatePicker from 'primevue/datepicker';
import { createInlineCellEditor } from '@alaarab/ogrid-vue';

const _Checkbox = Checkbox as any;
const _DatePicker = DatePicker as any;

export type { CreateInlineCellEditorOptions } from '@alaarab/ogrid-vue';

export const InlineCellEditor = createInlineCellEditor({
  renderCheckbox: (_h, { checked, onChange, onCancel }) =>
    h(_Checkbox, {
      modelValue: checked,
      binary: true,
      'aria-label': 'Toggle value',
      'onUpdate:modelValue': (c: boolean) => onChange(c),
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      },
    }),

  renderDatePicker: (_h, { value, onChange, onCancel }) => {
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
