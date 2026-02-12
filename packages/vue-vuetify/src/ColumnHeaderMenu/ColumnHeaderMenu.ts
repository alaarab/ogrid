import { defineComponent, h, type PropType } from 'vue';
import { VMenu, VList, VListItem } from 'vuetify/components';
import { COLUMN_HEADER_MENU_ITEMS } from '@alaarab/ogrid-vue';

export interface ColumnHeaderMenuProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  onClose: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
}

export const ColumnHeaderMenu = defineComponent({
  name: 'ColumnHeaderMenu',
  props: {
    isOpen: { type: Boolean, required: true },
    anchorElement: { type: Object as PropType<HTMLElement | null>, default: null },
    onClose: { type: Function as PropType<() => void>, required: true },
    onPinLeft: { type: Function as PropType<() => void>, required: true },
    onPinRight: { type: Function as PropType<() => void>, required: true },
    onUnpin: { type: Function as PropType<() => void>, required: true },
    canPinLeft: { type: Boolean, required: true },
    canPinRight: { type: Boolean, required: true },
    canUnpin: { type: Boolean, required: true },
  },
  setup(props) {
    const handleOpenChange = (open: boolean) => {
      if (!open) {
        props.onClose();
      }
    };

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

    return () =>
      h(VMenu as any, {
        modelValue: props.isOpen,
        'onUpdate:modelValue': handleOpenChange,
        activator: props.anchorElement || undefined,
        location: 'bottom start',
      }, {
        default: () =>
          h(VList as any, { density: 'compact', 'aria-label': 'Column options' }, () =>
            items.map((item, index) =>
              h(VListItem as any, {
                key: item.id,
                disabled: getDisabled(index),
                onClick: () => { getHandler(index)(); },
              }, () => item.label)
            )
          ),
      });
  },
});
