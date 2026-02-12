import { defineComponent, ref, h, onMounted, nextTick, watch, type PropType } from 'vue';
import Checkbox from 'primevue/checkbox';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import type { IColumnDef } from '@alaarab/ogrid-vue';

const _Checkbox = Checkbox as any;
const _Select = Select as any;
const _DatePicker = DatePicker as any;

export interface InlineCellEditorProps<T = unknown> {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

const editorWrapperStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '0 2px',
  boxSizing: 'border-box',
} as const;

export const InlineCellEditor = defineComponent({
  name: 'InlineCellEditor',
  props: {
    value: { default: undefined },
    item: { type: Object, required: true },
    column: { type: Object as PropType<IColumnDef>, required: true },
    rowIndex: { type: Number, required: true },
    editorType: { type: String as PropType<'text' | 'select' | 'checkbox' | 'richSelect' | 'date'>, required: true },
    onCommit: { type: Function as PropType<(value: unknown) => void>, required: true },
    onCancel: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const inputRef = ref<HTMLInputElement | null>(null);
    const localValue = ref<unknown>(props.value);

    // Auto-focus on mount
    onMounted(() => {
      nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    });

    // Sync local value when prop changes
    watch(() => props.value, (v) => { localValue.value = v; });

    return () => {
      if (props.editorType === 'checkbox') {
        const checked = !!props.value;
        return h('div', { style: { ...editorWrapperStyle, justifyContent: 'center' } },
          h(_Checkbox, {
            modelValue: checked,
            binary: true,
            'aria-label': 'Toggle value',
            'onUpdate:modelValue': (c: boolean) => props.onCommit(c),
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Escape') { e.preventDefault(); props.onCancel(); }
            },
          })
        );
      }

      if (props.editorType === 'select') {
        const values = (props.column.cellEditorParams?.values as unknown[]) ?? [];
        const options = values.map((v: unknown) => ({ label: String(v), value: String(v) }));
        return h('div', { style: editorWrapperStyle },
          h(_Select, {
            modelValue: localValue.value != null ? String(localValue.value) : '',
            options,
            optionLabel: 'label',
            optionValue: 'value',
            style: { minWidth: '0', flex: '1' },
            'onUpdate:modelValue': (v: string) => props.onCommit(v),
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Escape') { e.preventDefault(); props.onCancel(); }
            },
          })
        );
      }

      if (props.editorType === 'date') {
        let dateVal: Date | null = null;
        if (localValue.value) {
          const d = new Date(String(localValue.value));
          if (!Number.isNaN(d.getTime())) {
            dateVal = d;
          }
        }
        return h('div', { style: editorWrapperStyle },
          h(_DatePicker, {
            modelValue: dateVal,
            dateFormat: 'yy-mm-dd',
            showIcon: false,
            style: { width: '100%' },
            'onUpdate:modelValue': (v: Date | null) => {
              if (v) {
                props.onCommit(v.toISOString().slice(0, 10));
              }
            },
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Escape') { e.preventDefault(); props.onCancel(); }
            },
          })
        );
      }

      // Default: text editor
      return h('div', { style: editorWrapperStyle },
        h('input', {
          ref: (el: unknown) => { inputRef.value = el as HTMLInputElement; },
          type: 'text',
          value: localValue.value != null ? String(localValue.value) : '',
          style: { width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 4px', fontSize: 'inherit', boxSizing: 'border-box' },
          onInput: (e: Event) => { localValue.value = (e.target as HTMLInputElement).value; },
          onKeydown: (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); props.onCommit(localValue.value); }
            if (e.key === 'Escape') { e.preventDefault(); props.onCancel(); }
            if (e.key === 'Tab') { e.preventDefault(); props.onCommit(localValue.value); }
          },
          onBlur: () => props.onCommit(localValue.value),
        })
      );
    };
  },
});
