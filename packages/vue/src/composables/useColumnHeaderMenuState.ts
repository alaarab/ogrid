import { ref, computed, type Ref } from 'vue';

export interface UseColumnHeaderMenuStateParams {
  pinnedColumns: Ref<Record<string, 'left' | 'right'>>;
  onPinColumn: (columnId: string, side: 'left' | 'right') => void;
  onUnpinColumn: (columnId: string) => void;
}

export interface UseColumnHeaderMenuStateResult {
  isOpen: Ref<boolean>;
  openForColumn: Ref<string | null>;
  anchorElement: Ref<HTMLElement | null>;
  open: (columnId: string, anchorEl: HTMLElement) => void;
  close: () => void;
  handlePinLeft: () => void;
  handlePinRight: () => void;
  handleUnpin: () => void;
  canPinLeft: Ref<boolean>;
  canPinRight: Ref<boolean>;
  canUnpin: Ref<boolean>;
}

/**
 * Manages state for the column header menu (pin left/right/unpin actions).
 * Tracks which column's menu is open, anchor element, and action handlers.
 */
export function useColumnHeaderMenuState(
  params: UseColumnHeaderMenuStateParams
): UseColumnHeaderMenuStateResult {
  const { pinnedColumns, onPinColumn, onUnpinColumn } = params;

  const isOpen = ref(false);
  const openForColumn = ref<string | null>(null);
  const anchorElement = ref<HTMLElement | null>(null);

  const open = (columnId: string, anchorEl: HTMLElement) => {
    openForColumn.value = columnId;
    anchorElement.value = anchorEl;
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
    openForColumn.value = null;
    anchorElement.value = null;
  };

  const currentPinState = computed(() =>
    openForColumn.value ? pinnedColumns.value[openForColumn.value] : undefined
  );
  const canPinLeft = computed(() => currentPinState.value !== 'left');
  const canPinRight = computed(() => currentPinState.value !== 'right');
  const canUnpin = computed(() => !!currentPinState.value);

  const handlePinLeft = () => {
    if (openForColumn.value && canPinLeft.value) {
      onPinColumn(openForColumn.value, 'left');
      close();
    }
  };

  const handlePinRight = () => {
    if (openForColumn.value && canPinRight.value) {
      onPinColumn(openForColumn.value, 'right');
      close();
    }
  };

  const handleUnpin = () => {
    if (openForColumn.value && canUnpin.value) {
      onUnpinColumn(openForColumn.value);
      close();
    }
  };

  return {
    isOpen,
    openForColumn,
    anchorElement,
    open,
    close,
    handlePinLeft,
    handlePinRight,
    handleUnpin,
    canPinLeft,
    canPinRight,
    canUnpin,
  };
}
