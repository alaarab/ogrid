/**
 * TagsEditor — Premium multi-value tag/chip cell editor for OGrid (Vue).
 *
 * Usage:
 *   import { TagsEditor } from '@alaarab/ogrid-vue-inputs';
 *
 *   const columns = [{
 *     columnId: 'labels',
 *     cellEditor: TagsEditor,
 *     cellEditorPopup: true,
 *     cellEditorParams: {
 *       suggestions: ['Bug', 'Feature', 'Docs'],
 *       allowCreate: true,
 *     },
 *   }];
 *
 * Implements ICellEditorProps<T> — works with cellEditorPopup: true.
 */
import { defineComponent, ref, computed, onMounted, nextTick, h, type PropType, type CSSProperties } from 'vue';
import type { IColumnDef } from '@alaarab/ogrid-core';
import {
  parseTags,
  formatTags,
  getTagColor,
  filterTagSuggestions,
  DEFAULT_TAG_COLORS,
} from '@alaarab/ogrid-inputs';

// ── Styles ──

const rootStyle: CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '13px',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '8px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  padding: '8px',
  userSelect: 'none',
  width: '280px',
  boxSizing: 'border-box',
};

const tagsContainerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  padding: '4px',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.2))',
  borderRadius: '6px',
  marginBottom: '6px',
  minHeight: '36px',
  background: 'var(--ogrid-bg, #fff)',
  cursor: 'text',
  alignItems: 'center',
};

const tagInputStyle: CSSProperties = {
  border: 'none',
  outline: 'none',
  fontSize: '13px',
  background: 'transparent',
  color: 'inherit',
  flex: '1',
  minWidth: '80px',
  padding: '2px 4px',
};

const dropdownStyle: CSSProperties = {
  position: 'relative',
};

const suggestionListStyle: CSSProperties = {
  position: 'absolute',
  top: '2px',
  left: 0,
  right: 0,
  background: 'var(--ogrid-bg, #fff)',
  border: '1px solid var(--ogrid-border, rgba(0,0,0,0.12))',
  borderRadius: '6px',
  boxShadow: 'var(--ogrid-shadow, 0 4px 16px rgba(0,0,0,0.15))',
  zIndex: 10,
  maxHeight: '160px',
  overflowY: 'auto',
  listStyle: 'none',
  padding: '4px 0',
  margin: 0,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '6px',
  borderTop: '1px solid var(--ogrid-border, rgba(0,0,0,0.08))',
};

const countLabelStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--ogrid-muted, #888)',
};

const actionBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--ogrid-accent, #0078d4)',
  fontWeight: 500,
};

// ── Component ──

export const TagsEditor = defineComponent({
  name: 'TagsEditor',
  props: {
    value: { default: undefined },
    onValueChange: { type: Function as PropType<(value: unknown) => void>, required: true },
    onCommit: { type: Function as PropType<() => void>, required: true },
    onCancel: { type: Function as PropType<() => void>, required: true },
    item: { type: Object, required: true },
    column: { type: Object as PropType<IColumnDef>, required: true },
    cellEditorParams: { type: Object, default: undefined },
  },
  setup(props) {
    const suggestions = computed<readonly string[]>(
      () => (props.cellEditorParams?.suggestions as string[] | undefined) ?? []
    );
    const allowCreate = computed<boolean>(
      () => (props.cellEditorParams?.allowCreate as boolean | undefined) ?? true
    );

    const tags = ref<string[]>(parseTags(props.value));
    const inputText = ref<string>('');
    const activeIndex = ref<number>(-1);
    const inputEl = ref<HTMLInputElement | null>(null);
    const rootEl = ref<HTMLDivElement | null>(null);

    const filteredSuggestions = computed<string[]>(() =>
      filterTagSuggestions(inputText.value, suggestions.value, tags.value)
    );
    const showDropdown = computed<boolean>(
      () => filteredSuggestions.value.length > 0
    );

    const emitChange = () => {
      props.onValueChange(formatTags(tags.value));
    };

    const addTag = (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      if (tags.value.includes(trimmed)) {
        inputText.value = '';
        activeIndex.value = -1;
        return;
      }
      if (!allowCreate.value && !suggestions.value.includes(trimmed)) return;
      tags.value = [...tags.value, trimmed];
      inputText.value = '';
      activeIndex.value = -1;
      emitChange();
    };

    const removeTag = (index: number) => {
      tags.value = tags.value.filter((_, i) => i !== index);
      emitChange();
      nextTick(() => inputEl.value?.focus());
    };

    const removeLastTag = () => {
      if (tags.value.length > 0) {
        removeTag(tags.value.length - 1);
      }
    };

    const handleInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        e.stopPropagation();
        if (showDropdown.value && activeIndex.value >= 0) {
          addTag(filteredSuggestions.value[activeIndex.value]);
        } else if (inputText.value.trim()) {
          addTag(inputText.value);
        } else if (e.key === 'Enter') {
          props.onCommit();
        }
        return;
      }
      if (e.key === 'Backspace' && inputText.value === '') {
        e.preventDefault();
        removeLastTag();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showDropdown.value) {
          inputText.value = '';
          activeIndex.value = -1;
        } else {
          props.onCancel();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (showDropdown.value) {
          activeIndex.value = Math.min(activeIndex.value + 1, filteredSuggestions.value.length - 1);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (showDropdown.value) {
          activeIndex.value = Math.max(activeIndex.value - 1, -1);
        }
      }
    };

    const handleInputChange = (e: Event) => {
      inputText.value = (e.target as HTMLInputElement).value;
      activeIndex.value = -1;
    };

    onMounted(() => {
      inputEl.value?.focus();
    });

    return () => {
      const tagChips = tags.value.map((tag, idx) => {
        const bg = getTagColor(tag, DEFAULT_TAG_COLORS);
        const chipStyle: CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '2px 8px 2px 8px',
          borderRadius: '12px',
          background: bg,
          color: 'var(--ogrid-fg, #242424)',
          fontSize: '12px',
          fontWeight: 500,
          maxWidth: '120px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          border: '1px solid rgba(0,0,0,0.08)',
        };

        const removeBtnStyle: CSSProperties = {
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 0 0 2px',
          fontSize: '12px',
          lineHeight: '1',
          color: 'var(--ogrid-fg, #242424)',
          opacity: 0.6,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        };

        return h('span', { key: `${tag}-${idx}`, style: chipStyle }, [
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, tag),
          h('button', {
            type: 'button',
            style: removeBtnStyle,
            onClick: (e: MouseEvent) => {
              e.stopPropagation();
              removeTag(idx);
            },
            tabindex: -1,
            'aria-label': `Remove ${tag}`,
          }, '\u00D7'),
        ]);
      });

      const inputNode = h('input', {
        ref: inputEl,
        type: 'text',
        value: inputText.value,
        onInput: handleInputChange,
        onKeydown: handleInputKeyDown,
        placeholder: tags.value.length === 0 ? 'Add tags...' : '',
        style: tagInputStyle,
      });

      const suggestionItems = showDropdown.value
        ? filteredSuggestions.value.map((s, idx) => {
            const isActive = idx === activeIndex.value;
            const itemStyle: CSSProperties = {
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              background: isActive ? 'var(--ogrid-bg-hover, #f0f0f0)' : 'transparent',
              color: 'var(--ogrid-fg, #242424)',
            };

            return h('li', {
              key: s,
              style: itemStyle,
              onMousedown: (e: MouseEvent) => {
                e.preventDefault();
                addTag(s);
              },
              onMouseenter: () => { activeIndex.value = idx; },
            }, s);
          })
        : [];

      const tagCount = tags.value.length;
      const countLabel = tagCount === 0
        ? 'No tags'
        : tagCount === 1
          ? '1 tag'
          : `${tagCount} tags`;

      return h(
        'div',
        {
          ref: rootEl,
          style: rootStyle,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
        },
        [
          // Tags input container
          h('div', {
            style: tagsContainerStyle,
            onClick: () => inputEl.value?.focus(),
          }, [
            ...tagChips,
            inputNode,
          ]),

          // Suggestion dropdown
          h('div', { style: dropdownStyle }, [
            showDropdown.value
              ? h('ul', { style: suggestionListStyle }, suggestionItems)
              : null,
          ]),

          // Footer
          h('div', { style: footerStyle }, [
            h('span', { style: countLabelStyle }, countLabel),
            h('div', { style: { display: 'flex', gap: '4px' } }, [
              h('button', {
                type: 'button',
                style: actionBtnStyle,
                onClick: props.onCancel,
                tabindex: -1,
              }, 'Cancel'),
              h('button', {
                type: 'button',
                style: { ...actionBtnStyle, background: 'var(--ogrid-accent, #0078d4)', color: '#fff' },
                onClick: props.onCommit,
                tabindex: -1,
              }, 'Apply'),
            ]),
          ]),
        ]
      );
    };
  },
});
