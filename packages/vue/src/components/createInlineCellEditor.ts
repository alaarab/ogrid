import { defineComponent, ref, h, onMounted, nextTick, watch, type PropType, type VNode } from 'vue';
import type { IColumnDef } from '../types';

export interface CreateInlineCellEditorOptions {
  renderCheckbox: (hFn: typeof h, props: { checked: boolean; onChange: (val: boolean) => void; onCancel: () => void }) => VNode;
  renderDatePicker: (hFn: typeof h, props: { value: string; onChange: (val: string) => void; onCancel: () => void }) => VNode;
}

const editorWrapperStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '0 2px',
  boxSizing: 'border-box',
} as const;

export function createInlineCellEditor(options: CreateInlineCellEditorOptions) {
  const { renderCheckbox, renderDatePicker } = options;

  return defineComponent({
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
      const selectWrapperRef = ref<HTMLDivElement | null>(null);
      const selectDropdownRef = ref<HTMLDivElement | null>(null);
      const localValue = ref<unknown>(props.value);
      const highlightedIndex = ref(0);

      const positionDropdown = () => {
        const wrapper = selectWrapperRef.value;
        const dropdown = selectDropdownRef.value;
        if (!wrapper || !dropdown) return;
        const rect = wrapper.getBoundingClientRect();
        const maxH = 200;
        const spaceBelow = window.innerHeight - rect.bottom;
        const flipUp = spaceBelow < maxH && rect.top > spaceBelow;
        dropdown.style.position = 'fixed';
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${rect.width}px`;
        dropdown.style.maxHeight = `${maxH}px`;
        dropdown.style.zIndex = '9999';
        dropdown.style.right = 'auto';
        if (flipUp) {
          dropdown.style.top = 'auto';
          dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
        } else {
          dropdown.style.top = `${rect.bottom}px`;
        }
      };

      onMounted(() => {
        nextTick(() => {
          if (selectWrapperRef.value) {
            selectWrapperRef.value.focus();
            positionDropdown();
            return;
          }
          inputRef.value?.focus();
          inputRef.value?.select();
        });
      });

      // Sync local value when prop changes
      watch(() => props.value, (v) => { localValue.value = v; });

      // Initialize highlighted index to current value
      const initHighlightedIndex = () => {
        const values = (props.column.cellEditorParams?.values as unknown[]) ?? [];
        const idx = values.findIndex((v) => String(v) === String(props.value));
        highlightedIndex.value = Math.max(idx, 0);
      };
      initHighlightedIndex();

      const scrollHighlightedIntoView = () => {
        nextTick(() => {
          const dropdown = selectDropdownRef.value;
          if (!dropdown) return;
          const highlighted = dropdown.children[highlightedIndex.value] as HTMLElement | undefined;
          highlighted?.scrollIntoView({ block: 'nearest' });
        });
      };

      const getDisplayText = (value: unknown): string => {
        const formatValue = props.column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined;
        if (formatValue) return formatValue(value);
        return value != null ? String(value) : '';
      };

      const handleSelectKeyDown = (e: KeyboardEvent) => {
        const values = (props.column.cellEditorParams?.values as unknown[]) ?? [];
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            highlightedIndex.value = Math.min(highlightedIndex.value + 1, values.length - 1);
            scrollHighlightedIntoView();
            break;
          case 'ArrowUp':
            e.preventDefault();
            highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
            scrollHighlightedIntoView();
            break;
          case 'Enter':
            e.preventDefault();
            e.stopPropagation();
            if (values.length > 0 && highlightedIndex.value < values.length) {
              props.onCommit(values[highlightedIndex.value]);
            }
            break;
          case 'Tab':
            e.preventDefault();
            if (values.length > 0 && highlightedIndex.value < values.length) {
              props.onCommit(values[highlightedIndex.value]);
            }
            break;
          case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            props.onCancel();
            break;
        }
      };

      return () => {
        if (props.editorType === 'checkbox') {
          const checked = !!props.value;
          return h('div', { style: { ...editorWrapperStyle, justifyContent: 'center' } },
            renderCheckbox(h, {
              checked,
              onChange: (c: boolean) => props.onCommit(c),
              onCancel: props.onCancel,
            })
          );
        }

        if (props.editorType === 'select') {
          const values = (props.column.cellEditorParams?.values as unknown[]) ?? [];
          return h('div', {
            ref: (el: unknown) => { selectWrapperRef.value = el as HTMLDivElement; },
            tabindex: 0,
            style: { ...editorWrapperStyle, position: 'relative' },
            onKeydown: handleSelectKeyDown,
          }, [
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', fontSize: '13px', color: 'inherit' } }, [
              h('span', getDisplayText(props.value)),
              h('span', { style: { marginLeft: '4px', fontSize: '10px', opacity: '0.5' } }, '\u25BE'),
            ]),
            h('div', {
              ref: (el: unknown) => { selectDropdownRef.value = el as HTMLDivElement; },
              role: 'listbox',
              style: { position: 'absolute', top: '100%', left: '0', right: '0', maxHeight: '200px', overflowY: 'auto', background: 'var(--ogrid-bg, #fff)', border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))', zIndex: '10', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' },
            }, values.map((v, i) =>
              h('div', {
                key: String(v),
                role: 'option',
                'aria-selected': i === highlightedIndex.value,
                onClick: () => props.onCommit(v),
                style: { padding: '6px 8px', cursor: 'pointer', color: 'var(--ogrid-fg, #242424)', ...(i === highlightedIndex.value ? { background: 'var(--ogrid-bg-hover, #e8f0fe)' } : {}) },
              }, getDisplayText(v))
            )),
          ]);
        }

        if (props.editorType === 'date') {
          let dateStr = '';
          if (localValue.value) {
            const d = new Date(String(localValue.value));
            if (!Number.isNaN(d.getTime())) {
              dateStr = d.toISOString().slice(0, 10);
            }
          }
          return h('div', { style: editorWrapperStyle },
            renderDatePicker(h, {
              value: dateStr,
              onChange: (val: string) => props.onCommit(val),
              onCancel: props.onCancel,
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
}
