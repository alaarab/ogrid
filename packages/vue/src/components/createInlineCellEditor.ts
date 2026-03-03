import { defineComponent, ref, computed, h, onMounted, onUnmounted, nextTick, watch, type PropType, type VNode } from 'vue';
import type { IColumnDef } from '../types';
import { formatDateForDisplay, parseUserInputDate, getDateInputPlaceholder, DEFAULT_DATE_FORMAT } from '@alaarab/ogrid-core';
import type { DateFormat } from '@alaarab/ogrid-core';

export interface CreateInlineCellEditorOptions {
  renderCheckbox: (props: { checked: boolean; onChange: (val: boolean) => void; onCancel: () => void }) => VNode;
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
  const { renderCheckbox } = options;

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
        dropdown.style.textAlign = 'left';
        if (flipUp) {
          dropdown.style.top = 'auto';
          dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
        } else {
          dropdown.style.top = `${rect.bottom}px`;
        }
      };

      // Close select/richSelect on scroll so the fixed dropdown doesn't drift
      let scrollCleanup: (() => void) | null = null;

      onMounted(() => {
        nextTick(() => {
          if (selectWrapperRef.value) {
            // For richSelect, focus the search input inside the dropdown
            if (props.editorType === 'richSelect' && richSelectInputRef.value) {
              richSelectInputRef.value.focus({ preventScroll: true });
            } else {
              selectWrapperRef.value.focus({ preventScroll: true });
            }
            positionDropdown();
            // Listen for scroll to close the editor.
            // Delay attachment via RAF to skip spurious scroll events fired during mount
            // (e.g. focus-triggered scroll, layout-shift scroll from DOM changes).
            const wrapper = selectWrapperRef.value;
            const scrollParent = wrapper.closest('[data-ogrid-scroll-container]') ?? wrapper.closest('[style*="overflow"]');
            const handleScroll = () => { if (props.onCancel) props.onCancel(); };
            const raf = requestAnimationFrame(() => {
              if (scrollParent) scrollParent.addEventListener('scroll', handleScroll, { passive: true });
              window.addEventListener('scroll', handleScroll, { passive: true });
            });
            scrollCleanup = () => {
              cancelAnimationFrame(raf);
              if (scrollParent) scrollParent.removeEventListener('scroll', handleScroll);
              window.removeEventListener('scroll', handleScroll);
            };
            return;
          }
          inputRef.value?.focus({ preventScroll: true });
          inputRef.value?.select();
        });
      });

      onUnmounted(() => { scrollCleanup?.(); });

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

      // Rich select state
      const richSelectSearchText = ref('');
      const richSelectInputRef = ref<HTMLInputElement | null>(null);
      const richSelectOptionsRef = ref<HTMLDivElement | null>(null);

      const richSelectFilteredValues = computed(() => {
        const values = (props.column.cellEditorParams?.values as unknown[]) ?? [];
        const search = richSelectSearchText.value.trim().toLowerCase();
        if (!search) return values;
        return values.filter((v) => getDisplayText(v).toLowerCase().includes(search));
      });

      const scrollRichSelectHighlightedIntoView = () => {
        nextTick(() => {
          const container = richSelectOptionsRef.value;
          if (!container) return;
          const highlighted = container.children[highlightedIndex.value] as HTMLElement | undefined;
          highlighted?.scrollIntoView({ block: 'nearest' });
        });
      };

      const handleRichSelectKeyDown = (e: KeyboardEvent) => {
        const filtered = richSelectFilteredValues.value;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            highlightedIndex.value = Math.min(highlightedIndex.value + 1, filtered.length - 1);
            scrollRichSelectHighlightedIntoView();
            break;
          case 'ArrowUp':
            e.preventDefault();
            highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
            scrollRichSelectHighlightedIntoView();
            break;
          case 'Enter':
            e.preventDefault();
            e.stopPropagation();
            if (filtered.length > 0 && highlightedIndex.value < filtered.length) {
              props.onCommit(filtered[highlightedIndex.value]);
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
            renderCheckbox({
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
              style: { position: 'absolute', top: '100%', left: '0', right: '0', maxHeight: '200px', overflowY: 'auto', background: 'var(--ogrid-bg, #fff)', border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))', zIndex: '10', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textAlign: 'left', fontSize: '13px', fontFamily: 'inherit' },
            }, [
              ...values.map((v, i) =>
                h('div', {
                  key: String(v),
                  role: 'option',
                  'aria-selected': i === highlightedIndex.value,
                  onClick: () => props.onCommit(v),
                  style: { padding: '6px 8px', cursor: 'pointer', color: 'var(--ogrid-fg, #242424)', fontSize: '13px', ...(i === highlightedIndex.value ? { background: 'var(--ogrid-bg-hover, #e8f0fe)' } : {}) },
                }, getDisplayText(v))
              ),
            ]),
          ]);
        }

        if (props.editorType === 'richSelect') {
          const filtered = richSelectFilteredValues.value;
          return h('div', {
            ref: (el: unknown) => { selectWrapperRef.value = el as HTMLDivElement; },
            style: { ...editorWrapperStyle, position: 'relative' },
          }, [
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', fontSize: '13px', color: 'inherit' } }, [
              h('span', getDisplayText(props.value)),
              h('span', { style: { marginLeft: '4px', fontSize: '10px', opacity: '0.5' } }, '\u25BE'),
            ]),
            h('div', {
              ref: (el: unknown) => { selectDropdownRef.value = el as HTMLDivElement; },
              role: 'listbox',
              style: { position: 'absolute', top: '100%', left: '0', right: '0', maxHeight: '200px', overflowY: 'auto', background: 'var(--ogrid-bg, #fff)', border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))', zIndex: '10', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textAlign: 'left', fontSize: '13px', fontFamily: 'inherit' },
            }, [
              h('input', {
                ref: (el: unknown) => { richSelectInputRef.value = el as HTMLInputElement; },
                type: 'text',
                value: richSelectSearchText.value,
                placeholder: 'Search...',
                onInput: (e: Event) => {
                  richSelectSearchText.value = (e.target as HTMLInputElement).value;
                  highlightedIndex.value = 0;
                },
                onKeydown: handleRichSelectKeyDown,
                style: { width: '100%', padding: '6px 8px', border: 'none', borderBottom: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))', background: 'var(--ogrid-bg, #fff)', color: 'inherit', font: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box', position: 'sticky', top: '0', zIndex: '1' },
              }),
              h('div', {
                ref: (el: unknown) => { richSelectOptionsRef.value = el as HTMLDivElement; },
              }, filtered.map((v, i) =>
                h('div', {
                  key: String(v),
                  role: 'option',
                  'aria-selected': i === highlightedIndex.value,
                  onClick: () => props.onCommit(v),
                  style: { padding: '6px 8px', cursor: 'pointer', color: 'var(--ogrid-fg, #242424)', fontSize: '13px', ...(i === highlightedIndex.value ? { background: 'var(--ogrid-bg-hover, #e8f0fe)' } : {}) },
                }, getDisplayText(v))
              )),
              ...(filtered.length === 0 ? [h('div', { style: { padding: '6px 8px', color: 'var(--ogrid-muted, #999)', fontSize: '13px' } }, 'No matches')] : []),
            ]),
          ]);
        }

        if (props.editorType === 'date') {
          const dateFormat = (props.column.cellEditorParams?.['dateFormat'] as DateFormat | undefined) ?? (props.column.dateFormat as DateFormat | undefined) ?? DEFAULT_DATE_FORMAT;
          const dateEditorType = (props.column.cellEditorParams?.['editorType'] as string | undefined) ?? 'text';

          const commitDate = (raw: string) => {
            if (dateEditorType !== 'native') {
              const parsed = parseUserInputDate(raw, dateFormat);
              if (parsed !== null) {
                const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
                const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
                const dd = parsed.getUTCDate().toString().padStart(2, '0');
                props.onCommit(`${yyyy}-${mm}-${dd}`);
              } else {
                props.onCommit(raw || null);
              }
            } else {
              props.onCommit(raw);
            }
          };

          const handleDateKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); commitDate(String(localValue.value ?? '')); }
            if (e.key === 'Escape') { e.preventDefault(); props.onCancel(); }
            if (e.key === 'Tab') { e.preventDefault(); commitDate(String(localValue.value ?? '')); }
          };

          if (dateEditorType === 'native') {
            // Native browser date picker: always uses YYYY-MM-DD
            const isoStr = (() => {
              if (localValue.value == null) return '';
              const s = String(localValue.value);
              return s.match(/^\d{4}-\d{2}-\d{2}/) ? s.substring(0, 10) : s;
            })();
            return h('div', { style: editorWrapperStyle },
              h('input', {
                ref: (el: unknown) => { inputRef.value = el as HTMLInputElement; },
                type: 'date',
                value: isoStr,
                style: { width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 4px', fontSize: 'inherit', boxSizing: 'border-box' },
                onInput: (e: Event) => { localValue.value = (e.target as HTMLInputElement).value; },
                onKeydown: handleDateKeyDown,
                onBlur: () => commitDate(String(localValue.value ?? '')),
              })
            );
          }

          // Default: text input with configurable date format
          const displayValue = formatDateForDisplay(props.value, dateFormat) ?? '';
          if (localValue.value == null || localValue.value === '') {
            localValue.value = displayValue;
          }
          const placeholder = getDateInputPlaceholder(dateFormat);
          return h('div', { style: editorWrapperStyle },
            h('input', {
              ref: (el: unknown) => { inputRef.value = el as HTMLInputElement; },
              type: 'text',
              value: localValue.value,
              placeholder,
              style: { width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 4px', fontSize: 'inherit', boxSizing: 'border-box' },
              onInput: (e: Event) => { localValue.value = (e.target as HTMLInputElement).value; },
              onKeydown: handleDateKeyDown,
              onBlur: () => commitDate(String(localValue.value ?? '')),
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
