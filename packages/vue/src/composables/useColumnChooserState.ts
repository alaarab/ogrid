import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import type { IColumnDefinition } from '../types';

export interface UseColumnChooserStateParams {
  columns: Ref<IColumnDefinition[]>;
  visibleColumns: Ref<Set<string>>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
}

export interface UseColumnChooserStateResult {
  open: Ref<boolean>;
  setOpen: (open: boolean) => void;
  handleToggle: () => void;
  handleClose: () => void;
  handleCheckboxChange: (columnKey: string) => (visible: boolean) => void;
  handleSelectAll: () => void;
  handleClearAll: () => void;
  visibleCount: Ref<number>;
  totalCount: Ref<number>;
}

/**
 * Returns open/setOpen, handleToggle, handleClose, handleCheckboxChange, handleSelectAll, handleClearAll.
 */
export function useColumnChooserState(
  params: UseColumnChooserStateParams
): UseColumnChooserStateResult {
  const { columns, visibleColumns, onVisibilityChange } = params;
  const open = ref(false);

  let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;

  const setupEscapeHandler = () => {
    cleanupEscapeHandler();
    keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        open.value = false;
      }
    };
    document.addEventListener('keydown', keyDownHandler, true);
  };

  const cleanupEscapeHandler = () => {
    if (keyDownHandler) {
      document.removeEventListener('keydown', keyDownHandler, true);
      keyDownHandler = null;
    }
  };

  watch(open, (isOpen) => {
    if (isOpen) setupEscapeHandler();
    else cleanupEscapeHandler();
  });

  onUnmounted(() => cleanupEscapeHandler());

  const setOpen = (value: boolean) => {
    open.value = value;
  };

  const handleToggle = () => {
    open.value = !open.value;
  };

  const handleClose = () => {
    open.value = false;
  };

  const handleCheckboxChange = (columnKey: string) => {
    return (visible: boolean) => {
      onVisibilityChange(columnKey, visible);
    };
  };

  const handleSelectAll = () => {
    columns.value.forEach((col) => {
      if (!visibleColumns.value.has(col.columnId)) {
        onVisibilityChange(col.columnId, true);
      }
    });
  };

  const handleClearAll = () => {
    // Required columns are silently skipped  -  no feedback is provided to the user
    columns.value.forEach((col) => {
      if (!col.required && visibleColumns.value.has(col.columnId)) {
        onVisibilityChange(col.columnId, false);
      }
    });
  };

  const visibleCount = computed(() => visibleColumns.value.size);
  const totalCount = computed(() => columns.value.length);

  return {
    open,
    setOpen,
    handleToggle,
    handleClose,
    handleCheckboxChange,
    handleSelectAll,
    handleClearAll,
    visibleCount,
    totalCount,
  };
}
