<script setup lang="ts">
import { computed } from 'vue';
import { Menu, MenuButton, MenuItems } from '@headlessui/vue';
import { useColumnChooserState } from '@alaarab/ogrid-vue';
import type { IColumnChooserProps } from './types';

const props = withDefaults(defineProps<IColumnChooserProps>(), {
  className: '',
});

const {
  open,
  setOpen,
  handleCheckboxChange: setColumnVisible,
  handleSelectAll,
  handleClearAll,
  visibleCount,
  totalCount,
} = useColumnChooserState({
  columns: computed(() => props.columns),
  visibleColumns: computed(() => props.visibleColumns),
  onVisibilityChange: props.onVisibilityChange,
});

const handleCheckboxChange = (columnKey: string) => (e: Event) => {
  const target = e.target as HTMLInputElement;
  setColumnVisible(columnKey)(target.checked);
};
</script>

<template>
  <div :class="['container', className]">
    <Menu v-slot="{ open: isOpen }">
      <MenuButton
        class="trigger-button"
        :aria-expanded="isOpen"
        aria-haspopup="listbox"
        @click="setOpen(!open)"
      >
        <span class="button-icon" aria-hidden>⚙</span>
        <span>Column Visibility ({{ visibleCount }} of {{ totalCount }})</span>
        <span class="chevron" aria-hidden>{{ isOpen ? '▲' : '▼' }}</span>
      </MenuButton>

      <transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <MenuItems class="dropdown">
          <div class="header">Select Columns ({{ visibleCount }} of {{ totalCount }})</div>

          <div class="options-list">
            <div
              v-for="column in columns"
              :key="column.columnId"
              class="option-item"
              role="menuitemcheckbox"
              :aria-checked="visibleColumns.has(column.columnId)"
              :aria-disabled="column.required === true"
            >
              <input
                :id="`col-${column.columnId}`"
                type="checkbox"
                :checked="visibleColumns.has(column.columnId)"
                :disabled="column.required === true"
                class="checkbox-input"
                @click.stop
                @change="handleCheckboxChange(column.columnId)($event)"
              />
              <label
                :for="`col-${column.columnId}`"
                class="checkbox-label"
                @click.stop
              >
                {{ column.name }}
              </label>
            </div>
          </div>

          <div class="actions">
            <button type="button" class="clear-button" @click.stop="handleClearAll">
              Clear All
            </button>
            <button type="button" class="select-all-button" @click.stop="handleSelectAll">
              Select All
            </button>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<style scoped lang="scss">
@import './ColumnChooser.module.scss';
</style>
