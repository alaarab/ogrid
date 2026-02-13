import { defineComponent, h, computed, type PropType } from 'vue';
import { VMenu, VList, VListItem, VDivider } from 'vuetify/components';
import { getColumnHeaderMenuItems } from '@alaarab/ogrid-vue';

export interface ColumnHeaderMenuProps {
  isOpen: boolean;
  anchorElement: HTMLElement | null;
  onClose: () => void;
  onPinLeft: () => void;
  onPinRight: () => void;
  onUnpin: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  onAutosizeThis: () => void;
  onAutosizeAll: () => void;
  canPinLeft: boolean;
  canPinRight: boolean;
  canUnpin: boolean;
  currentSort: 'asc' | 'desc' | null;
  isSortable: boolean;
  isResizable: boolean;
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
    onSortAsc: { type: Function as PropType<() => void>, required: true },
    onSortDesc: { type: Function as PropType<() => void>, required: true },
    onClearSort: { type: Function as PropType<() => void>, required: true },
    onAutosizeThis: { type: Function as PropType<() => void>, required: true },
    onAutosizeAll: { type: Function as PropType<() => void>, required: true },
    canPinLeft: { type: Boolean, required: true },
    canPinRight: { type: Boolean, required: true },
    canUnpin: { type: Boolean, required: true },
    currentSort: { type: String as PropType<'asc' | 'desc' | null>, default: null },
    isSortable: { type: Boolean, default: true },
    isResizable: { type: Boolean, default: true },
  },
  setup(props) {
    const handleOpenChange = (open: boolean) => {
      if (!open) {
        props.onClose();
      }
    };

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

    const getHandler = (itemId: string) => handlers[itemId] || (() => {});

    return () =>
      h(VMenu as any, {
        modelValue: props.isOpen,
        'onUpdate:modelValue': handleOpenChange,
        activator: props.anchorElement || undefined,
        location: 'bottom start',
      }, {
        default: () =>
          h(VList as any, { density: 'compact', 'aria-label': 'Column options' }, () => {
            const children: any[] = [];
            items.value.forEach((item, index) => {
              // Add divider before item if needed (but not at the start)
              if (item.divider && index > 0) {
                children.push(h(VDivider as any, { key: `divider-${item.id}` }));
              }
              children.push(
                h(VListItem as any, {
                  key: item.id,
                  disabled: item.disabled,
                  onClick: () => { getHandler(item.id)(); },
                }, () => item.label)
              );
            });
            return children;
          }),
      });
  },
});
