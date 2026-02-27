<script setup lang="ts">
export interface MultiSelectFilterPopoverProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  options: string[];
  filteredOptions: string[];
  selected: Set<string>;
  onOptionToggle: (option: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApply: () => void;
  isLoading: boolean;
}

const props = defineProps<MultiSelectFilterPopoverProps>();
</script>

<template>
  <div>
    <div class="popover-search">
      <input
        type="text"
        class="search-input"
        placeholder="Search..."
        :value="searchText"
        @input="onSearchChange(($event.target as HTMLInputElement).value)"
        autocomplete="off"
      />
      <div class="result-count">
        {{ filteredOptions.length }} of {{ options.length }} options
      </div>
    </div>
    <div class="select-all-row">
      <button type="button" class="select-all-button" @click="onSelectAll">
        Select All ({{ filteredOptions.length }})
      </button>
      <button type="button" class="select-all-button" @click="onClearSelection">
        Clear
      </button>
    </div>
    <div class="popover-options">
      <div v-if="isLoading" class="loading-container">Loading...</div>
      <div v-else-if="filteredOptions.length === 0" class="no-results">
        No options found
      </div>
      <div
        v-else
        v-for="option in filteredOptions"
        :key="option"
        class="popover-option"
      >
        <input
          type="checkbox"
          :checked="selected.has(option)"
          @change="onOptionToggle(option, ($event.target as HTMLInputElement).checked)"
          class="filter-checkbox"
        />
        <label style="margin-left: 8px; cursor: pointer; font-size: 13px">{{ option }}</label>
      </div>
    </div>
    <div class="popover-actions">
      <button type="button" class="clear-button" @click="onClearSelection">
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
