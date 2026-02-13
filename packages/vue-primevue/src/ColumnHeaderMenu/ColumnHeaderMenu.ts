import { defineComponent, h, ref, computed, onMounted, onBeforeUnmount, type PropType } from 'vue';
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

    const getHandler = (itemId: string) => handlers[itemId] || (() => {});

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

    return () => {
      if (!props.isOpen || !props.anchorElement) return null;

      // Position the menu relative to the anchor element
      const rect = props.anchorElement.getBoundingClientRect();

      const children: any[] = [];
      items.value.forEach((item, index) => {
        // Add divider before item if needed (but not at the start)
        if (item.divider && index > 0) {
          children.push(h('div', {
            key: `divider-${item.id}`,
            role: 'separator',
            style: {
              height: '1px',
              backgroundColor: 'rgba(0,0,0,0.12)',
              margin: '4px 0',
            },
          }));
        }

        const disabled = item.disabled ?? false;
        children.push(h('div', {
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
            if (!disabled) getHandler(item.id)();
          },
        }, item.label));
      });

      return h('div', {
        ref: (el: unknown) => { menuRef.value = el as HTMLDivElement; },
        role: 'menu',
        'aria-label': 'Column options',
        style: {
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${rect.left}px`,
          zIndex: '9999',
          backgroundColor: '#fff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '160px',
          padding: '4px 0',
        },
      }, children);
    };
  },
});
