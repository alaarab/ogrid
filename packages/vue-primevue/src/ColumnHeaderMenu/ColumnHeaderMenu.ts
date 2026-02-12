import { defineComponent, h, ref, onMounted, onBeforeUnmount, type PropType } from 'vue';
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
          minWidth: '140px',
          padding: '4px 0',
        },
      },
        items.map((item, index) => {
          const disabled = getDisabled(index);
          return h('div', {
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
              if (!disabled) getHandler(index)();
            },
          }, item.label);
        })
      );
    };
  },
});
