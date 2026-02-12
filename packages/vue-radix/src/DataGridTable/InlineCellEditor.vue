<script setup lang="ts">
import { ref, computed, onMounted, type ComputedRef } from 'vue';
import { Checkbox, CheckboxIndicator } from '@headlessui/vue';
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
  value: () => props.value,
  editorType: () => props.editorType as ComputedRef<'text' | 'select' | 'checkbox' | 'richSelect' | 'date'>,
  onCommit: props.onCommit,
  onCancel: props.onCancel,
});

const richSelectValues = computed(() => (props.column.cellEditorParams?.values as unknown[]) ?? []);
const richSelectFormatValue = computed(() => props.column.cellEditorParams?.formatValue as ((v: unknown) => string) | undefined);

const richSelect = useRichSelectState({
  values: richSelectValues,
  formatValue: richSelectFormatValue,
  initialValue: () => props.value,
  onCommit: props.onCommit,
  onCancel: props.onCancel,
});

const selectValues = computed(() => (props.column.cellEditorParams?.values as unknown[]) ?? []);

const checkboxChecked = computed(() => props.value === true);

const handleCheckboxChange = (val: boolean) => {
  commit(val);
};

const handleSelectChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  commit(target.value);
};

onMounted(() => {
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
  <Checkbox
    v-else-if="editorType === 'checkbox'"
    :checked="checkboxChecked"
    @update:checked="handleCheckboxChange"
    @keydown.esc.prevent="cancel"
    class="checkbox-editor"
  >
    <CheckboxIndicator class="checkbox-indicator">✓</CheckboxIndicator>
  </Checkbox>

  <!-- Select -->
  <div v-else-if="editorType === 'select'" class="select-wrapper">
    <select
      :value="value !== null && value !== undefined ? String(value) : ''"
      @change="handleSelectChange"
      @keydown.esc.prevent="cancel"
      class="select-editor"
      autofocus
    >
      <option v-for="v in selectValues" :key="String(v)" :value="String(v)">
        {{ String(v) }}
      </option>
    </select>
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
.editor-wrapper,
.select-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  box-sizing: border-box;
  overflow: hidden;
  min-width: 0;
}

.editor-input,
.select-editor {
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

.select-editor {
  cursor: pointer;
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

.checkbox-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--ogrid-border, #ccc);
  border-radius: 3px;
  background: var(--ogrid-bg, #fff);
  cursor: pointer;

  &[data-state='checked'] {
    background: var(--ogrid-primary, #0078d4);
    border-color: var(--ogrid-primary, #0078d4);
  }
}

.checkbox-indicator {
  color: white;
  font-size: 14px;
  font-weight: bold;
}
</style>
