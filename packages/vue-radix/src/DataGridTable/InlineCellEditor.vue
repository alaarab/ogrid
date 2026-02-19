<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import type { IColumnDefinition } from '@alaarab/ogrid-vue';
import {
  useInlineCellEditorState,
  useRichSelectState,
} from '@alaarab/ogrid-vue';

export interface InlineCellEditorProps<T = any> {
  value: unknown;
  item: T;
  column: IColumnDefinition;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

const props = defineProps<InlineCellEditorProps>();

const wrapperRef = ref<HTMLDivElement | null>(null);

const {
  localValue,
  setLocalValue,
  handleKeyDown,
  handleBlur,
  commit,
  cancel,
} = useInlineCellEditorState({
  value: props.value,
  editorType: props.editorType,
  onCommit: props.onCommit,
  onCancel: props.onCancel,
});

const richSelect = useRichSelectState({
  values: (props.column.cellEditorParams?.values as unknown[]) ?? [],
  formatValue: props.column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined,
  initialValue: props.value,
  onCommit: props.onCommit,
  onCancel: props.onCancel,
});

const selectValues = computed(() => (props.column.cellEditorParams?.values as unknown[]) ?? []);

const checkboxChecked = computed(() => props.value === true);

const handleCheckboxChange = (val: boolean) => {
  commit(val);
};

const selectWrapperRef = ref<HTMLDivElement | null>(null);
const selectDropdownRef = ref<HTMLDivElement | null>(null);
const highlightedIndex = ref(0);

// Initialize highlighted index to current value
const initIdx = selectValues.value.findIndex((v: unknown) => String(v) === String(props.value));
highlightedIndex.value = Math.max(initIdx, 0);

const getDisplayText = (value: unknown): string => {
  const formatValue = props.column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined;
  if (formatValue) return formatValue(value);
  return value != null ? String(value) : '';
};

const scrollHighlightedIntoView = () => {
  nextTick(() => {
    const dropdown = selectDropdownRef.value;
    if (!dropdown) return;
    const highlighted = dropdown.children[highlightedIndex.value] as HTMLElement | undefined;
    highlighted?.scrollIntoView({ block: 'nearest' });
  });
};

const handleSelectKeyDown = (e: KeyboardEvent) => {
  const options = selectValues.value;
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, options.length - 1);
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
      if (options.length > 0 && highlightedIndex.value < options.length) {
        commit(options[highlightedIndex.value]);
      }
      break;
    case 'Tab':
      e.preventDefault();
      if (options.length > 0 && highlightedIndex.value < options.length) {
        commit(options[highlightedIndex.value]);
      }
      break;
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      cancel();
      break;
  }
};

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
  if (selectWrapperRef.value) {
    selectWrapperRef.value.focus();
    positionDropdown();
    return;
  }
  const input = wrapperRef.value?.querySelector('input');
  if (input) {
    input.focus();
    input.select();
  }
});
</script>

<template>
  <!-- Rich Select -->
  <div v-if="editorType === 'richSelect'" ref="wrapperRef" class="rich-select-wrapper">
    <input
      type="text"
      :value="richSelect.searchText.value"
      @input="(e) => richSelect.setSearchText((e.target as HTMLInputElement).value)"
      @keydown="richSelect.handleKeyDown"
      placeholder="Search..."
      class="rich-select-input"
      autofocus
    />
    <div class="rich-select-dropdown" role="listbox">
      <div
        v-for="(v, i) in richSelect.filteredValues.value"
        :key="String(v)"
        role="option"
        :aria-selected="i === richSelect.highlightedIndex.value"
        :class="['rich-select-option', { highlighted: i === richSelect.highlightedIndex.value }]"
        @click="() => richSelect.selectValue(v)"
      >
        {{ richSelect.getDisplayText(v) }}
      </div>
      <div v-if="richSelect.filteredValues.value.length === 0" class="rich-select-no-matches">
        No matches
      </div>
    </div>
  </div>

  <!-- Checkbox -->
  <div v-else-if="editorType === 'checkbox'" class="checkbox-editor-wrapper">
    <input
      type="checkbox"
      :checked="checkboxChecked"
      @change="(e: Event) => handleCheckboxChange((e.target as HTMLInputElement).checked)"
      @keydown.esc.prevent="cancel"
      class="checkbox-editor"
      autofocus
    />
  </div>

  <!-- Select (custom dropdown) -->
  <div v-else-if="editorType === 'select'" ref="selectWrapperRef" tabindex="0" class="custom-select-wrapper" @keydown="handleSelectKeyDown">
    <div class="custom-select-display">
      <span>{{ getDisplayText(value) }}</span>
      <span class="custom-select-chevron">&#9662;</span>
    </div>
    <div ref="selectDropdownRef" role="listbox" class="custom-select-dropdown">
      <div
        v-for="(v, i) in selectValues"
        :key="String(v)"
        role="option"
        :aria-selected="i === highlightedIndex"
        :class="['custom-select-option', { highlighted: i === highlightedIndex }]"
        @click="() => commit(v)"
      >
        {{ getDisplayText(v) }}
      </div>
    </div>
  </div>

  <!-- Date -->
  <div v-else-if="editorType === 'date'" ref="wrapperRef" class="editor-wrapper">
    <input
      type="date"
      :value="localValue"
      @input="(e) => setLocalValue((e.target as HTMLInputElement).value)"
      @blur="handleBlur"
      @keydown="handleKeyDown"
      class="editor-input"
      autofocus
    />
  </div>

  <!-- Text (default) -->
  <div v-else ref="wrapperRef" class="editor-wrapper">
    <input
      type="text"
      :value="localValue"
      @input="(e) => setLocalValue((e.target as HTMLInputElement).value)"
      @blur="handleBlur"
      @keydown="handleKeyDown"
      class="editor-input"
      autofocus
    />
  </div>
</template>

<style scoped lang="scss">
.editor-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  box-sizing: border-box;
  overflow: hidden;
  min-width: 0;
}

.editor-input {
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.custom-select-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  box-sizing: border-box;
  min-width: 0;
  position: relative;
  outline: none;
}

.custom-select-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  font-size: 13px;
  color: inherit;
}

.custom-select-chevron {
  margin-left: 4px;
  font-size: 10px;
  opacity: 0.5;
}

.custom-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--ogrid-bg, #fff);
  border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.custom-select-option {
  padding: 6px 8px;
  cursor: pointer;
  color: var(--ogrid-fg, #242424);

  &.highlighted {
    background: var(--ogrid-bg-hover, #e8f0fe);
  }
}

.rich-select-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  box-sizing: border-box;
  overflow: hidden;
  min-width: 0;
  position: relative;
}

.rich-select-input {
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.rich-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--ogrid-bg, #fff);
  border: 1px solid var(--ogrid-border, #ccc);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.rich-select-option {
  padding: 6px 8px;
  cursor: pointer;
  color: var(--ogrid-fg, #242424);

  &.highlighted {
    background: var(--ogrid-bg-hover, #e8f0fe);
  }
}

.rich-select-no-matches {
  padding: 6px 8px;
  color: var(--ogrid-muted, #999);
}

.checkbox-editor-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.checkbox-editor {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--ogrid-primary, #0078d4);
}
</style>
