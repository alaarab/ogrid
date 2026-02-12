<script setup lang="ts">
import { Menu, MenuItems, MenuItem } from '@headlessui/vue';
import {
  GRID_CONTEXT_MENU_ITEMS,
  getContextMenuHandlers,
  formatShortcut,
} from '@alaarab/ogrid-vue';

export interface GridContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClose: () => void;
}

const props = defineProps<GridContextMenuProps>();

const handlers = getContextMenuHandlers(props);

const isDisabled = (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
  if (item.disabledWhenNoSelection && !props.hasSelection) return true;
  if (item.id === 'undo' && !props.canUndo) return true;
  if (item.id === 'redo' && !props.canRedo) return true;
  return false;
};

const handleItemClick = (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
  if (!isDisabled(item)) {
    handlers[item.id]();
  }
};
</script>

<template>
  <Menu as="div" class="context-menu-wrapper">
    <MenuItems
      static
      class="context-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      aria-label="Grid context menu"
      @click.stop
    >
      <template v-for="item in GRID_CONTEXT_MENU_ITEMS" :key="item.id">
        <div v-if="item.dividerBefore" class="divider" />
        <MenuItem v-slot="{ active }" as="template">
          <button
            type="button"
            class="menu-item"
            :class="{ active, disabled: isDisabled(item) }"
            :disabled="isDisabled(item)"
            @click="handleItemClick(item)"
          >
            <span class="menu-item-label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="menu-item-shortcut">
              {{ formatShortcut(item.shortcut) }}
            </span>
          </button>
        </MenuItem>
      </template>
    </MenuItems>
  </Menu>
</template>

<style scoped lang="scss">
.context-menu-wrapper {
  position: relative;
  z-index: 9999;
}

.context-menu {
  position: fixed;
  min-width: 200px;
  background: white;
  border: 1px solid var(--ogrid-border-color, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  outline: none;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: var(--ogrid-text-primary, #000);
  transition: background-color 0.1s ease;

  &.active:not(.disabled) {
    background-color: var(--ogrid-bg-hover, #f5f5f5);
  }

  &.disabled {
    color: var(--ogrid-text-disabled, #999);
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.menu-item-label {
  flex: 1;
}

.menu-item-shortcut {
  margin-left: 24px;
  font-size: 0.8em;
  color: var(--ogrid-text-secondary, rgba(0, 0, 0, 0.4));
}

.divider {
  height: 1px;
  margin: 4px 0;
  background-color: var(--ogrid-border-color, #e0e0e0);
}
</style>
