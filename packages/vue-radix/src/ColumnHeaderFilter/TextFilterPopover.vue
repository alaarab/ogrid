<script setup lang="ts">
export interface TextFilterPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

const props = defineProps<TextFilterPopoverProps>();

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    props.onApply();
  }
};
</script>

<template>
  <div>
    <div class="popover-search">
      <input
        type="text"
        class="search-input"
        placeholder="Enter search term..."
        :value="value"
        @input="onValueChange(($event.target as HTMLInputElement).value)"
        @keydown="handleKeyDown"
        autocomplete="off"
      />
    </div>
    <div class="popover-actions">
      <button
        type="button"
        class="clear-button"
        @click="onClear"
        :disabled="!value"
      >
        Clear
      </button>
      <button type="button" class="apply-button" @click="onApply">
        Apply
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import './ColumnHeaderFilter.module.scss';
</style>
