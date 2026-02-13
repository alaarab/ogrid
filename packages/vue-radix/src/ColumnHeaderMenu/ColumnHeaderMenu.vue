<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-vue';
import type { ColumnHeaderMenuProps } from './types';

const props = defineProps<ColumnHeaderMenuProps>();

const menuRef = ref<HTMLDivElement | null>(null);

const items = COLUMN_HEADER_MENU_ITEMS;

const getDisabled = (index: number) => {
  if (index === 0) return !props.canPinLeft;
  if (index === 1) return !props.canPinRight;
  if (index === 2) return !props.canUnpin;
  return false;
};

const getHandler = (index: number) => {
  if (index === 0) return props.onPinLeft;
  if (index === 1) return props.onPinRight;
  if (index === 2) return props.onUnpin;
  return () => {};
};

const handleClick = (index: number) => {
  if (!getDisabled(index)) {
    getHandler(index)();
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    props.onClose();
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <div
    v-if="isOpen && anchorElement"
    ref="menuRef"
    role="menu"
    aria-label="Column options"
    class="ogrid-column-header-menu"
    :style="{
      top: `${anchorElement.getBoundingClientRect().bottom + 4}px`,
      left: `${anchorElement.getBoundingClientRect().left}px`,
    }"
  >
    <div
      v-for="(item, index) in items"
      :key="item.id"
      role="menuitem"
      :aria-disabled="getDisabled(index) ? 'true' : undefined"
      :class="['ogrid-column-header-menu-item', { disabled: getDisabled(index) }]"
      @click="handleClick(index)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<style scoped>
.ogrid-column-header-menu {
  position: fixed;
  z-index: 9999;
  background-color: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  padding: 4px 0;
}

.ogrid-column-header-menu-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.875rem;
}

.ogrid-column-header-menu-item:hover:not(.disabled) {
  background-color: rgba(0, 0, 0, 0.04);
}

.ogrid-column-header-menu-item.disabled {
  cursor: default;
  opacity: 0.4;
}
</style>
