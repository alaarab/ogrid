import { defineComponent, h, ref, onMounted, onBeforeUnmount, type PropType } from 'vue';
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

export const GridContextMenu = defineComponent({
  name: 'GridContextMenu',
  props: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    hasSelection: { type: Boolean, required: true },
    canUndo: { type: Boolean, required: true },
    canRedo: { type: Boolean, required: true },
    onUndo: { type: Function as PropType<() => void>, required: true },
    onRedo: { type: Function as PropType<() => void>, required: true },
    onCopy: { type: Function as PropType<() => void>, required: true },
    onCut: { type: Function as PropType<() => void>, required: true },
    onPaste: { type: Function as PropType<() => void>, required: true },
    onSelectAll: { type: Function as PropType<() => void>, required: true },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const handlers = getContextMenuHandlers(props);
    const menuRef = ref<HTMLDivElement | null>(null);

    const isDisabled = (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
      if (item.disabledWhenNoSelection && !props.hasSelection) return true;
      if (item.id === 'undo' && !props.canUndo) return true;
      if (item.id === 'redo' && !props.canRedo) return true;
      return false;
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

    return () =>
      h('div', {
        ref: (el: unknown) => { menuRef.value = el as HTMLDivElement; },
        role: 'menu',
        'aria-label': 'Grid context menu',
        style: {
          position: 'fixed',
          top: `${props.y}px`,
          left: `${props.x}px`,
          zIndex: '9999',
          backgroundColor: '#fff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '180px',
          padding: '4px 0',
        },
      },
        GRID_CONTEXT_MENU_ITEMS.flatMap((item) => {
          const disabled = isDisabled(item);
          return [
            ...(item.dividerBefore ? [
              h('div', {
                key: `${item.id}-div`,
                style: { borderTop: '1px solid rgba(0,0,0,0.12)', margin: '4px 0' },
              }),
            ] : []),
            h('div', {
              key: item.id,
              role: 'menuitem',
              'aria-disabled': disabled ? 'true' : undefined,
              style: {
                display: 'flex',
                alignItems: 'center',
                padding: '6px 12px',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? '0.4' : '1',
                fontSize: '0.875rem',
              },
              onMouseenter: (e: MouseEvent) => {
                if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)';
              },
              onMouseleave: (e: MouseEvent) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '';
              },
              onClick: () => {
                if (!disabled) handlers[item.id]();
              },
            }, [
              h('span', { style: { flex: '1' } }, item.label),
              ...(item.shortcut ? [
                h('span', {
                  style: { marginLeft: '24px', color: 'rgba(0,0,0,0.4)', fontSize: '0.8em' },
                }, formatShortcut(item.shortcut)),
              ] : []),
            ]),
          ];
        })
      );
  },
});
