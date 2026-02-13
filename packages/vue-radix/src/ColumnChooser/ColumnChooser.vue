<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
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
  columns: () => props.columns,
  visibleColumns: () => props.visibleColumns,
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
            <MenuItem
              v-for="column in columns"
              :key="column.columnId"
              as="div"
              class="option-item"
            >
              <input
                :id="`col-${column.columnId}`"
                type="checkbox"
                :checked="visibleColumns.has(column.columnId)"
                :disabled="column.required === true"
                class="checkbox-input"
                @change="handleCheckboxChange(column.columnId)"
              />
              <label
                :for="`col-${column.columnId}`"
                class="checkbox-label"
              >
                {{ column.name }}
              </label>
            </MenuItem>
          </div>

          <div class="actions">
            <button type="button" class="clear-button" @click="handleClearAll">
              Clear All
            </button>
            <button type="button" class="select-all-button" @click="handleSelectAll">
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
