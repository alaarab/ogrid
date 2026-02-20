import { defineComponent, h, type PropType, type Component } from 'vue';
import { VMenu, VList, VListItem, VDivider } from 'vuetify/components';
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

    const isDisabled = (item: (typeof GRID_CONTEXT_MENU_ITEMS)[number]) => {
      if (item.disabledWhenNoSelection && !props.hasSelection) return true;
      if (item.id === 'undo' && !props.canUndo) return true;
      if (item.id === 'redo' && !props.canRedo) return true;
      return false;
    };

    return () =>
      h(VMenu as Component, {
        modelValue: true,
        'onUpdate:modelValue': (v: boolean) => { if (!v) props.onClose(); },
        target: [props.x, props.y] as [number, number],
        location: 'bottom start',
      }, {
        default: () =>
          h(VList as Component, { density: 'compact', 'aria-label': 'Grid context menu' }, () =>
            GRID_CONTEXT_MENU_ITEMS.map((item) => [
              ...(item.dividerBefore ? [h(VDivider as Component, { key: `${item.id}-div` })] : []),
              h(VListItem as Component, {
                key: item.id,
                disabled: isDisabled(item),
                onClick: () => { handlers[item.id](); },
              }, () =>
                h('div', { style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
                  h('span', { style: { flex: '1' } }, item.label),
                  ...(item.shortcut ? [
                    h('span', {
                      style: { marginLeft: '24px', color: 'rgba(0,0,0,0.4)', fontSize: '0.8em' },
                    }, formatShortcut(item.shortcut)),
                  ] : []),
                ])
              ),
            ]).flat()
          ),
      });
  },
});
