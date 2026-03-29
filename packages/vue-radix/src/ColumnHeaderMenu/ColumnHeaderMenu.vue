<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getColumnHeaderMenuItems } from '@alaarab/ogrid-vue';
import type { ColumnHeaderMenuProps } from './types';

const props = defineProps<ColumnHeaderMenuProps>();

const menuRef = ref<HTMLDivElement | null>(null);

const items = computed(() =>
  getColumnHeaderMenuItems({
    canPinLeft: props.canPinLeft,
    canPinRight: props.canPinRight,
    canUnpin: props.canUnpin,
    currentSort: props.currentSort,
    isSortable: props.isSortable,
    isResizable: props.isResizable,
  })
);

const handlers: Record<string, () => void> = {
  pinLeft: props.onPinLeft,
  pinRight: props.onPinRight,
  unpin: props.onUnpin,
  sortAsc: props.onSortAsc,
  sortDesc: props.onSortDesc,
  clearSort: props.onClearSort,
  autosizeThis: props.onAutosizeThis,
  autosizeAll: props.onAutosizeAll,
};

const handleClick = (itemId: string, disabled: boolean) => {
  if (!disabled && handlers[itemId]) {
    handlers[itemId]();
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
  <Teleport to="body">
  <div
    v-if="isOpen && anchorElement"
    ref="menuRef"
    role="menu"
    aria-label="Column options"
    class="ogrid-column-header-menu"
    :style="{
      position: 'fixed',
      zIndex: 9999,
      top: `${anchorElement.getBoundingClientRect().bottom + 4}px`,
      left: `${anchorElement.getBoundingClientRect().left}px`,
    }"
  >
    <template v-for="(item, index) in items" :key="item.id">
      <div
        v-if="item.divider && index > 0"
        class="ogrid-column-header-menu-divider"
        role="separator"
      ></div>
      <div
        role="menuitem"
        :aria-disabled="item.disabled ? 'true' : undefined"
        :class="['ogrid-column-header-menu-item', { disabled: item.disabled }]"
        @click="handleClick(item.id, item.disabled ?? false)"
      >
        {{ item.label }}
      </div>
    </template>
  </div>
  </Teleport>
</template>

<style scoped>
.ogrid-column-header-menu {
  position: fixed;
  z-index: 9999;
  background-color: var(--ogrid-bg, #ffffff);
  color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
  border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  padding: 4px 0;
}

.ogrid-column-header-menu-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
}

.ogrid-column-header-menu-item:hover:not(.disabled) {
  background-color: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
}

.ogrid-column-header-menu-item.disabled {
  cursor: default;
  opacity: 0.4;
}

.ogrid-column-header-menu-divider {
  height: 1px;
  background-color: var(--ogrid-border, rgba(0, 0, 0, 0.12));
  margin: 4px 0;
}
</style>
